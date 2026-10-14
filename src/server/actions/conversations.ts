"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isDemoMode } from "@/lib/env"
import {
  MESSAGING_NOT_CONFIGURED,
  deliverAndPersist,
  getMessagingAdapter,
  isMessagingConfigured,
} from "@/lib/messaging"
import { createClient as createSupabase } from "@/lib/supabase/server"
import { authorizeAction } from "@/server/auth"
import { safeErrorLog } from "@/server/_shared"

/**
 * Server actions do Atendimento, mesmo padrão de actions/service-orders.ts:
 * authorizeAction + validação zod no servidor, modo demo devolve mensagem
 * amigável (toast na UI) e com Supabase real persiste + revalidatePath.
 *
 * Envio: WhatsApp fora do go-live. Sem provedor configurado o envio é
 * BLOQUEADO antes de qualquer consulta e nada é gravado como enviado. Com
 * provedor, passa por deliverAndPersist (provedor primeiro, banco depois).
 */

export interface ConversationActionResult {
  status: "success" | "error"
  message: string
}

const DEMO_MESSAGE =
  "Modo demonstração: o envio real de mensagens será habilitado quando o WhatsApp for conectado."

const conversationIdSchema = z.uuid()

function revalidateAtendimento() {
  revalidatePath("/atendimento")
}

// ---------------------------------------------------------------------------
// Envio de resposta (equipe → cliente)
// ---------------------------------------------------------------------------

const sendSchema = z.object({
  conversationId: z.uuid(),
  texto: z
    .string({ error: "Escreva a mensagem antes de enviar." })
    .trim()
    .min(1, "Escreva a mensagem antes de enviar.")
    .max(4000, "A mensagem pode ter no máximo 4.000 caracteres."),
})

/** Envia uma resposta humana: adapter (provedor) + insert em messages. */
export async function sendConversationMessage(
  conversationId: string,
  texto: string,
): Promise<ConversationActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { status: "error", message: auth.error }
  const parsed = sendSchema.safeParse({ conversationId, texto })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      status: "error",
      message: issue?.message ?? "Dados inválidos — recarregue a página e tente novamente.",
    }
  }
  // Bloqueio do go-live: sem provedor real, nada é enviado nem gravado.
  if (!isMessagingConfigured()) return { status: "error", message: MESSAGING_NOT_CONFIGURED }
  if (isDemoMode) return { status: "error", message: DEMO_MESSAGE }

  try {
    const supabase = await createSupabase()
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id,telefone,status")
      .eq("id", parsed.data.conversationId)
      .maybeSingle()
    if (convError || !conversation) {
      console.error("[actions/conversations] send (busca conversa):", safeErrorLog(convError))
      return {
        status: "error",
        message: "Conversa não encontrada. Recarregue a página e tente novamente.",
      }
    }
    if (conversation.status === "encerrado") {
      return { status: "error", message: "Conversa encerrada: o envio está desativado." }
    }

    const outcome = await deliverAndPersist(
      getMessagingAdapter(),
      {
        conversationId: conversation.id,
        telefone: conversation.telefone,
        texto: parsed.data.texto,
      },
      async (receipt) => {
        const { error: insertError } = await supabase.from("messages").insert({
          conversation_id: conversation.id,
          direcao: "out",
          autor: "humano",
          texto: parsed.data.texto,
          metadata: receipt.externalId ? { wa_id: receipt.externalId } : {},
        })
        if (insertError) {
          console.error("[actions/conversations] send (insert):", safeErrorLog(insertError))
          return false
        }
        const { error: updateError } = await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversation.id)
        if (updateError) {
          // Mensagem já persistida: só loga, não falha o envio para o usuário.
          console.error("[actions/conversations] send (last_message_at):", safeErrorLog(updateError))
        }
        return true
      },
    )
    if (!outcome.ok) {
      const message =
        outcome.reason === "not_configured"
          ? MESSAGING_NOT_CONFIGURED
          : outcome.reason === "provider_error"
            ? "O WhatsApp recusou o envio. Tente novamente em instantes."
            : "A mensagem saiu pelo WhatsApp, mas não foi registrada no histórico. Avise o administrador."
      return { status: "error", message }
    }
  } catch (error) {
    console.error("[actions/conversations] sendConversationMessage:", safeErrorLog(error))
    return {
      status: "error",
      message: "Não foi possível enviar a mensagem. Tente novamente.",
    }
  }

  revalidateAtendimento()
  return { status: "success", message: "Mensagem enviada." }
}

// ---------------------------------------------------------------------------
// Transições de status da conversa
// ---------------------------------------------------------------------------

/** Transfere a conversa da IA para a equipe (status "transferido"). */
export async function transferConversation(
  conversationId: string,
): Promise<ConversationActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { status: "error", message: auth.error }
  const id = conversationIdSchema.safeParse(conversationId)
  if (!id.success) {
    return { status: "error", message: "Dados inválidos — recarregue a página e tente novamente." }
  }
  if (isDemoMode) {
    return {
      status: "error",
      message:
        "Modo demonstração — a transferência será habilitada quando o banco do cliente for conectado.",
    }
  }

  try {
    const supabase = await createSupabase()
    const { error } = await supabase
      .from("conversations")
      .update({ status: "transferido" })
      .eq("id", id.data)
    if (error) {
      console.error("[actions/conversations] transfer:", safeErrorLog(error))
      return { status: "error", message: "Não foi possível transferir a conversa. Tente novamente." }
    }
  } catch (error) {
    console.error("[actions/conversations] transferConversation:", safeErrorLog(error))
    return { status: "error", message: "Não foi possível transferir a conversa. Tente novamente." }
  }

  revalidateAtendimento()
  return { status: "success", message: "Conversa transferida para a equipe." }
}

/** Encerra a conversa (status "encerrado"). */
export async function closeConversation(
  conversationId: string,
): Promise<ConversationActionResult> {
  const auth = await authorizeAction("admin", "atendente")
  if (auth.error !== null) return { status: "error", message: auth.error }
  const id = conversationIdSchema.safeParse(conversationId)
  if (!id.success) {
    return { status: "error", message: "Dados inválidos — recarregue a página e tente novamente." }
  }
  if (isDemoMode) {
    return {
      status: "error",
      message:
        "Modo demonstração — o encerramento será habilitado quando o banco do cliente for conectado.",
    }
  }

  try {
    const supabase = await createSupabase()
    const { error } = await supabase
      .from("conversations")
      .update({ status: "encerrado" })
      .eq("id", id.data)
    if (error) {
      console.error("[actions/conversations] close:", safeErrorLog(error))
      return { status: "error", message: "Não foi possível encerrar a conversa. Tente novamente." }
    }
  } catch (error) {
    console.error("[actions/conversations] closeConversation:", safeErrorLog(error))
    return { status: "error", message: "Não foi possível encerrar a conversa. Tente novamente." }
  }

  revalidateAtendimento()
  return { status: "success", message: "Conversa encerrada." }
}
