/**
 * Schemas zod do módulo de Orçamentos (0010_orcamentos.sql). Puros (sem
 * "use server"): o formulário valida antes de enviar e as server actions de
 * src/server/actions/quotes.ts revalidam tudo no servidor.
 *
 * Números aceitam number ou string ("1.234,56" / "1234.56"); datas "YYYY-MM-DD".
 * subtotal/total NÃO entram: o banco calcula.
 */

import { z } from "zod"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** "1.234,56" | "1234.56" | 1234.56 → number (NaN se inválido). */
export function parseNumeroBR(value: unknown): number {
  if (typeof value === "number") return value
  if (typeof value !== "string") return Number.NaN
  const s = value.trim().replace(/^R\$\s*/, "")
  if (s === "") return Number.NaN
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s
  return Number(normalized)
}

const numero = (label: string) =>
  z.preprocess(
    parseNumeroBR,
    z.number({ error: `${label}: informe um número válido.` }).refine(Number.isFinite, {
      message: `${label}: informe um número válido.`,
    }),
  )

/** "" / null / undefined → null; senão texto aparado com limite. */
const textoOpcional = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: máximo de ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null))

const dataISO = (label: string) =>
  z
    .string()
    .trim()
    .regex(ISO_DATE, `${label}: data inválida.`)
    .refine((v) => !Number.isNaN(Date.parse(`${v}T12:00:00Z`)), `${label}: data inválida.`)

const uuidOpcional = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid("Item de catálogo inválido.").nullable())

export const QUOTE_SERVICE_TYPES = ["instalacao", "corretiva"] as const
export const QUOTE_STATUSES = ["aguardando", "aprovado", "declinado"] as const
export const PAYMENT_METHODS = ["pix", "boleto"] as const

export const MAX_QUOTE_ITEMS = 200

// ---------------------------------------------------------------------------
// Itens e cabeçalho
// ---------------------------------------------------------------------------

export const quoteItemSchema = z.object({
  catalog_item_id: uuidOpcional,
  descricao: z
    .string()
    .trim()
    .min(1, "Descreva o item.")
    .max(500, "Descrição do item: máximo de 500 caracteres."),
  unidade: z
    .string()
    .trim()
    .max(20, "Unidade: máximo de 20 caracteres.")
    .optional()
    .transform((v) => (v ? v : "un")),
  quantidade: numero("Quantidade")
    .pipe(z.number().gt(0, "Quantidade deve ser maior que zero.").max(999_999_999, "Quantidade muito alta."))
    .transform((v) => Math.round(v * 1000) / 1000),
  preco_unitario: numero("Preço unitário")
    .pipe(z.number().min(0, "Preço não pode ser negativo.").max(9_999_999_999, "Preço muito alto."))
    .transform((v) => Math.round(v * 100) / 100),
})

export const quoteSchema = z
  .object({
    client_id: z.string().trim().pipe(z.uuid("Selecione o cliente.")),
    building_id: z.string().trim().pipe(z.uuid("Selecione o prédio/unidade.")),
    tipo_servico: z.enum(QUOTE_SERVICE_TYPES, "Selecione o tipo de serviço.").default("instalacao"),
    titulo: z.string().trim().min(3, "Informe um título (mín. 3 caracteres).").max(200, "Título: máximo de 200 caracteres."),
    observacoes: textoOpcional(4000, "Observações"),
    validade: dataISO("Validade"),
    condicoes_pagamento: textoOpcional(1000, "Condições de pagamento"),
    prazo_execucao: textoOpcional(500, "Prazo de execução"),
    garantia: textoOpcional(500, "Garantia"),
    desconto: numero("Desconto")
      .pipe(z.number().min(0, "Desconto não pode ser negativo."))
      .transform((v) => Math.round(v * 100) / 100)
      .default(0),
    items: z
      .array(quoteItemSchema)
      .min(1, "Inclua pelo menos 1 item no orçamento.")
      .max(MAX_QUOTE_ITEMS, `Máximo de ${MAX_QUOTE_ITEMS} itens por orçamento.`),
  })
  .superRefine((q, ctx) => {
    const subtotal = quoteSubtotal(q.items)
    if (q.desconto > subtotal) {
      ctx.addIssue({
        code: "custom",
        path: ["desconto"],
        message: "O desconto não pode ser maior que o subtotal.",
      })
    }
  })

export type QuoteInput = z.input<typeof quoteSchema>
export type QuoteData = z.output<typeof quoteSchema>
export type QuoteItemInput = z.input<typeof quoteItemSchema>

/** Mesmo cálculo do banco: soma de round(qtd × preço, 2). */
export function quoteSubtotal(items: Array<{ quantidade: number; preco_unitario: number }>): number {
  const cents = items.reduce(
    (s, i) => s + Math.round(Math.round(i.quantidade * 1000) * Math.round(i.preco_unitario * 100) / 1000),
    0,
  )
  return cents / 100
}

// ---------------------------------------------------------------------------
// Decisão
// ---------------------------------------------------------------------------

export const approveQuoteSchema = z.object({
  vencimento: dataISO("Vencimento"),
  metodo: z.enum(PAYMENT_METHODS, "Selecione Pix ou boleto."),
})
export type ApproveQuoteInput = z.input<typeof approveQuoteSchema>

export const declineQuoteSchema = z.object({
  motivo: textoOpcional(1000, "Motivo"),
})
export type DeclineQuoteInput = z.input<typeof declineQuoteSchema>

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export const catalogItemSchema = z.object({
  id: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null))
    .pipe(z.uuid("Identificador inválido.").nullable()),
  nome: z.string().trim().min(2, "Informe o nome (mín. 2 caracteres).").max(200, "Nome: máximo de 200 caracteres."),
  descricao: textoOpcional(2000, "Descrição"),
  unidade: z
    .string()
    .trim()
    .max(20, "Unidade: máximo de 20 caracteres.")
    .optional()
    .transform((v) => (v ? v : "un")),
  preco: numero("Preço")
    .pipe(z.number().min(0, "Preço não pode ser negativo.").max(9_999_999_999, "Preço muito alto."))
    .transform((v) => Math.round(v * 100) / 100),
  ativo: z.boolean().default(true),
})
export type CatalogItemInput = z.input<typeof catalogItemSchema>

// ---------------------------------------------------------------------------
// Filtros da listagem
// ---------------------------------------------------------------------------

export const listQuotesSchema = z.object({
  status: z.enum(QUOTE_STATUSES).optional(),
  clientId: z.uuid().optional(),
  q: z.string().trim().max(100).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  inicio: z.string().regex(ISO_DATE).optional(),
  fim: z.string().regex(ISO_DATE).optional(),
})

/** Erros por campo ("items.0.quantidade", "desconto", "_" = geral). */
export type QuoteFieldErrors = Record<string, string>

export function quoteFieldErrors(error: z.ZodError): QuoteFieldErrors {
  const out: QuoteFieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_"
    if (!out[key]) out[key] = issue.message
  }
  return out
}

// ---------------------------------------------------------------------------
// Retorno das server actions (serializável)
// ---------------------------------------------------------------------------

export interface QuoteActionResult {
  ok: boolean
  message: string
  /** true quando validou mas não gravou (modo demonstração). */
  demo?: boolean
  /** id do orçamento/item de catálogo criado ou alterado (duplicar: o novo). */
  id?: string
  fieldErrors?: QuoteFieldErrors
  /** approveQuote: ids gerados na aprovação. */
  serviceOrderId?: string
  invoiceId?: string
  /** approveQuote: "gerada" | "pendente" (orçamento aprovado, cobrança a gerar no Financeiro). */
  cobranca?: "gerada" | "pendente"
}

/** Rotas do módulo (revalidação e links). */
export const QUOTES_PATH = "/orcamentos"
