"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isDemoMode } from "@/lib/env"
import { getMessagingAdapter } from "@/lib/messaging"
import { createClient as createSupabase } from "@/lib/supabase/server"
import { authorizeAction } from "@/server/auth"

/**
 * Server actions do Atendimento IA — mesmo padrão de actions/service-orders.ts:
 * validação zod no servidor, modo demo devolve mensagem amigável (toast na UI)
 * e com Supabase real persiste + revalidatePath. O envio de mensagem passa
 * SEMPRE pelo MessagingAdapter (src/lib/messaging) — hoje o adapter nulo, na
 * ativação o provedor de WhatsApp, sem mudar nada aqui além da factory.
 */

export interface ConversationActionResult {
  status: "success" | "error"
  message: string
}

const DEMO_MESSAGE =
  "Modo demonstração — o envio real de mensagens será habilitado quando o WhatsApp for conectado."

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
  if (isDemoMode) return { status: "error", message: DEMO_MESSAGE }

  try {
    const supabase = await createSupabase()
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id,telefone")
      .eq("id", parsed.data.conversationId)
      .maybeSingle()
    if (convError || !conversation) {
      console.error("[actions/conversations] send (busca conversa):", convError)
      return {
        status: "error",
        message: "Conversa não encontrada — recarregue a página e tente novamente.",
      }
    }

    // Envio pelo provedor (hoje: adapter nulo, que só loga e resolve).
    const adapter = getMessagingAdapter()
    const receipt = await adapter.sendMessage({
      conversationId: conversation.id,
      telefone: conversation.telefone,
      texto: parsed.data.texto,
    })

    const now = new Date().toISOString()
    const { error: insertError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      direcao: "out",
      autor: "humano",
      texto: parsed.data.texto,
      metadata: receipt.externalId ? { wa_id: receipt.externalId } : {},
    })
    if (insertError) {
      console.error("[actions/conversations] send (insert):", insertError)
      return {
        status: "error",
        message: "Não foi possível enviar a mensagem. Tente novamente.",
      }
    }

    const { error: updateError } = await supabase
      .from("conversations")
      .update({ last_message_at: now })
      .eq("id", conversation.id)
    if (updateError) {
      // Mensagem já persistida: só loga, não falha o envio para o usuário.
      console.error("[actions/conversations] send (last_message_at):", updateError)
    }
  } catch (error) {
    console.error("[actions/conversations] sendConversationMessage:", error)
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
      console.error("[actions/conversations] transfer:", error)
      return { status: "error", message: "Não foi possível transferir a conversa. Tente novamente." }
    }
  } catch (error) {
    console.error("[actions/conversations] transferConversation:", error)
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
      console.error("[actions/conversations] close:", error)
      return { status: "error", message: "Não foi possível encerrar a conversa. Tente novamente." }
    }
  } catch (error) {
    console.error("[actions/conversations] closeConversation:", error)
    return { status: "error", message: "Não foi possível encerrar a conversa. Tente novamente." }
  }

  revalidateAtendimento()
  return { status: "success", message: "Conversa encerrada." }
}
