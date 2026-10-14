"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { todayBRT } from "@/lib/asaas/dates"
import { isDemoMode } from "@/lib/env"
import { createClient as createSupabase } from "@/lib/supabase/server"
import { authorizeAction } from "@/server/auth"

/**
 * CRUD de contratos (aba Contratos de /financeiro). Só admin. Contrato não é
 * apagado (faturas referenciam com on delete restrict): "Encerrar" muda o
 * status para encerrado e fecha a vigência em hoje (BRT).
 */

export type ContractField =
  | "client_id"
  | "tipo"
  | "valor_mensal"
  | "dia_vencimento"
  | "inicio"
  | "fim"
  | "status"
  | "observacoes"

export type ContractFieldErrors = Partial<Record<ContractField, string>>

export interface ContractActionState {
  status: "idle" | "success" | "error" | "info"
  message?: string
  fieldErrors?: ContractFieldErrors
}

const DEMO_MESSAGE =
  "Modo demonstração — contratos não são gravados até o banco do cliente (Supabase) ser conectado."

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")

/** "1.234,56" | "1234.56" | "1234" → número. */
function parseValor(raw: unknown): number {
  const text = String(raw ?? "").trim().replace(/[R$\s]/g, "")
  if (!text) return NaN
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text
  return Number(normalized)
}

const contractSchema = z
  .object({
    id: z.uuid().optional(),
    client_id: z.uuid("Selecione o cliente."),
    tipo: z.enum(["pmoc_recorrente", "corretiva_avulsa", "instalacao"], "Selecione o tipo."),
    valor_mensal: z
      .number("Informe o valor mensal.")
      .finite("Informe o valor mensal.")
      .min(0, "O valor não pode ser negativo.")
      .max(10_000_000, "Valor acima do limite."),
    dia_vencimento: z
      .number("Informe o dia de vencimento.")
      .int("Use um dia inteiro.")
      .min(1, "Use um dia entre 1 e 28.")
      .max(28, "Use um dia entre 1 e 28."),
    inicio: isoDate,
    fim: isoDate.nullable(),
    status: z.enum(["ativo", "suspenso", "encerrado"], "Selecione o status."),
    observacoes: z.string().max(1000, "Máximo de 1000 caracteres.").nullable(),
  })
  .refine((v) => v.fim === null || v.fim >= v.inicio, {
    path: ["fim"],
    message: "O fim deve ser igual ou posterior ao início.",
  })

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim()
}

/** Cria (sem id) ou edita (com id) um contrato. */
export async function saveContract(
  _prev: ContractActionState,
  formData: FormData,
): Promise<ContractActionState> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return { status: "error", message: auth.error }

  const idRaw = text(formData, "id")
  const parsed = contractSchema.safeParse({
    id: idRaw || undefined,
    client_id: text(formData, "client_id"),
    tipo: text(formData, "tipo"),
    valor_mensal: parseValor(formData.get("valor_mensal")),
    dia_vencimento: Number(text(formData, "dia_vencimento") || NaN),
    inicio: text(formData, "inicio"),
    fim: text(formData, "fim") || null,
    status: text(formData, "status") || "ativo",
    observacoes: text(formData, "observacoes") || null,
  })
  if (!parsed.success) {
    const fieldErrors: ContractFieldErrors = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as ContractField | undefined
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { status: "error", message: "Revise os campos destacados.", fieldErrors }
  }
  if (isDemoMode) return { status: "info", message: DEMO_MESSAGE }

  const { id, ...values } = parsed.data
  try {
    const supabase = await createSupabase()
    if (id) {
      const { data, error } = await supabase
        .from("contracts")
        .update(values)
        .eq("id", id)
        .select("id")
      if (error) {
        console.error("[actions/contracts] update:", error)
        return { status: "error", message: "Não foi possível salvar o contrato. Tente novamente." }
      }
      if (!data || data.length === 0) {
        return { status: "error", message: "Contrato não encontrado ou sem permissão — atualize a página." }
      }
    } else {
      const { data, error } = await supabase.from("contracts").insert(values).select("id")
      if (error) {
        console.error("[actions/contracts] insert:", error)
        const fk = (error as { code?: string }).code === "23503"
        return {
          status: "error",
          message: fk
            ? "Cliente não encontrado — atualize a página e selecione outro."
            : "Não foi possível cadastrar o contrato. Tente novamente.",
        }
      }
      if (!data || data.length === 0) {
        return { status: "error", message: "Sem permissão para cadastrar contratos." }
      }
    }
  } catch (error) {
    console.error("[actions/contracts] saveContract:", error)
    return { status: "error", message: "Não foi possível salvar o contrato. Tente novamente." }
  }

  revalidatePath("/financeiro")
  return { status: "success", message: id ? "Contrato atualizado." : "Contrato cadastrado." }
}

/** Encerra o contrato: status encerrado e fim = hoje (BRT) se ainda aberto/futuro. */
export async function closeContract(contractId: string): Promise<ContractActionState> {
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return { status: "error", message: auth.error }
  const id = z.uuid().safeParse(contractId)
  if (!id.success) return { status: "error", message: "Dados inválidos — recarregue a página." }
  if (isDemoMode) return { status: "info", message: DEMO_MESSAGE }

  try {
    const supabase = await createSupabase()
    const hoje = todayBRT()
    const { data: current, error: readError } = await supabase
      .from("contracts")
      .select("inicio, fim, status")
      .eq("id", id.data)
      .maybeSingle()
    if (readError) {
      console.error("[actions/contracts] closeContract read:", readError)
      return { status: "error", message: "Não foi possível encerrar o contrato. Tente novamente." }
    }
    if (!current) return { status: "error", message: "Contrato não encontrado — atualize a página." }
    if (current.status === "encerrado") {
      return { status: "error", message: "Este contrato já está encerrado." }
    }
    // fim precisa ser >= início; contrato que começa no futuro encerra no próprio início.
    const fimAtual = current.fim as string | null
    const inicio = current.inicio as string
    const fim = fimAtual && fimAtual <= hoje ? fimAtual : hoje < inicio ? inicio : hoje

    const { data, error } = await supabase
      .from("contracts")
      .update({ status: "encerrado", fim })
      .eq("id", id.data)
      .neq("status", "encerrado")
      .select("id")
    if (error) {
      console.error("[actions/contracts] closeContract:", error)
      return { status: "error", message: "Não foi possível encerrar o contrato. Tente novamente." }
    }
    if (!data || data.length === 0) {
      return { status: "error", message: "O contrato já foi encerrado ou você não tem permissão." }
    }
  } catch (error) {
    console.error("[actions/contracts] closeContract:", error)
    return { status: "error", message: "Não foi possível encerrar o contrato. Tente novamente." }
  }

  revalidatePath("/financeiro")
  return { status: "success", message: "Contrato encerrado — ele não gera mais faturas." }
}
