/**
 * Schemas zod dos cadastros (clientes, dados fiscais, prédios, equipamentos,
 * leads e planos PMOC). Puros: os formulários usam para validar antes de
 * enviar e as server actions revalidam tudo no servidor.
 *
 * Entrada sempre em string (campos de formulário); os transforms entregam o
 * formato do banco (null para vazio, números, datas ISO).
 */

import { z } from "zod"

import {
  canonicalDocumento,
  isValidCep,
  isValidDocumento,
  isValidLat,
  isValidLng,
  isValidUf,
  maskCep,
  onlyDigits,
  parseDateBR,
  parseDecimalBR,
  parseIntBR,
} from "./validators"

/** "" → null; senão o texto aparado. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: máximo de ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v))

const idOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.uuid("Identificador inválido.").optional())

const uuidObrigatorio = (msg: string) => z.string().trim().pipe(z.uuid(msg))

// ---------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------

export const SEGMENTOS = [
  "shopping",
  "hospital",
  "industria",
  "condominio",
  "varejo",
  "educacao",
  "hotelaria",
] as const

export const clientSchema = z.object({
  id: idOpcional,
  razao_social: z
    .string()
    .trim()
    .min(3, "Informe a razão social (mínimo 3 caracteres).")
    .max(200, "Razão social muito longa."),
  nome_fantasia: optionalText(200, "Nome fantasia"),
  documento: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidDocumento(v), {
      message: "CPF/CNPJ inválido. Confira os dígitos.",
    })
    .transform((v) => (v === "" ? null : canonicalDocumento(v))),
  segmento: z
    .string()
    .trim()
    .max(40, "Segmento muito longo.")
    .transform((v) => (v === "" ? null : v.toLowerCase())),
  contato_nome: optionalText(120, "Contato"),
  contato_email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.email().safeParse(v).success, { message: "E-mail inválido." })
    .transform((v) => (v === "" ? null : v.toLowerCase())),
  contato_telefone: z
    .string()
    .trim()
    .refine((v) => v === "" || onlyDigits(v).length >= 10, {
      message: "Telefone incompleto. Use DDD + número.",
    })
    .transform((v) => (v === "" ? null : v)),
  observacoes: optionalText(2000, "Observações"),
})
export type ClientInput = z.input<typeof clientSchema>

export const fiscalSchema = z.object({
  client_id: uuidObrigatorio("Cliente inválido."),
  codigo_servico_municipal: optionalText(20, "Código do serviço"),
  aliquota_iss: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = parseDecimalBR(v)
      if (n === null || n < 0 || n > 100) {
        ctx.addIssue({ code: "custom", message: "Alíquota entre 0 e 100%." })
        return z.NEVER
      }
      return Math.round(n * 100) / 100
    }),
  reter_iss: z.boolean(),
})
export type FiscalInput = z.input<typeof fiscalSchema>

// ---------------------------------------------------------------------------
// Prédio
// ---------------------------------------------------------------------------

const coordenada = (label: string, valid: (n: number) => boolean) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null
      const n = parseDecimalBR(v)
      if (n === null || !valid(n)) {
        ctx.addIssue({ code: "custom", message: `${label} inválida.` })
        return z.NEVER
      }
      return n
    })

export const buildingFields = z.object({
    id: idOpcional,
    client_id: uuidObrigatorio("Cliente inválido."),
    nome: z
      .string()
      .trim()
      .min(2, "Informe o nome do prédio/unidade.")
      .max(120, "Nome muito longo."),
    logradouro: optionalText(200, "Logradouro"),
    numero: optionalText(20, "Número"),
    bairro: optionalText(80, "Bairro"),
    cidade: z.string().trim().min(2, "Informe a cidade.").max(80, "Cidade muito longa."),
    uf: z
      .string()
      .trim()
      .toUpperCase()
      .refine(isValidUf, { message: "UF inválida." }),
    cep: z
      .string()
      .trim()
      .refine((v) => v === "" || isValidCep(v), { message: "CEP inválido. Use 00000-000." })
      .transform((v) => (v === "" ? null : maskCep(v))),
    regiao: z
      .string()
      .trim()
      .max(40, "Região muito longa.")
      .transform((v) => (v === "" ? null : v.toLowerCase())),
    lat: coordenada("Latitude", isValidLat),
    lng: coordenada("Longitude", isValidLng),
  })

/** Latitude e longitude andam juntas (ou ambas vazias). */
export function refineLatLng(
  b: { lat: number | null; lng: number | null },
  ctx: z.RefinementCtx,
) {
  if ((b.lat === null) !== (b.lng === null)) {
    ctx.addIssue({
      code: "custom",
      path: [b.lat === null ? "lat" : "lng"],
      message: "Informe latitude e longitude juntas.",
    })
  }
}

export const buildingSchema = buildingFields.superRefine(refineLatLng)
export type BuildingInput = z.input<typeof buildingSchema>

// ---------------------------------------------------------------------------
// Equipamento
// ---------------------------------------------------------------------------

export const EQUIPMENT_TYPES = ["split", "vrf", "chiller", "self", "janela"] as const

export const equipmentFields = z.object({
  id: idOpcional,
  building_id: uuidObrigatorio("Selecione o prédio."),
  tipo: z.enum(EQUIPMENT_TYPES, "Selecione o tipo."),
  marca: optionalText(80, "Marca"),
  modelo: optionalText(80, "Modelo"),
  capacidade_btu: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null
      const n = parseIntBR(v)
      if (n === null || n <= 0 || n > 50_000_000) {
        ctx.addIssue({ code: "custom", message: "Capacidade em BTU/h inválida." })
        return z.NEVER
      }
      return n
    }),
  numero_serie: optionalText(60, "Número de série"),
  codigo_interno: z
    .string()
    .trim()
    .min(1, "Informe o código interno (ex.: 04-B7).")
    .max(30, "Código interno muito longo."),
  ambiente: optionalText(120, "Ambiente"),
  data_instalacao: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null
      const iso = parseDateBR(v)
      if (!iso) {
        ctx.addIssue({ code: "custom", message: "Data de instalação inválida." })
        return z.NEVER
      }
      return iso
    }),
  observacoes: optionalText(2000, "Observações"),
})
export const equipmentSchema = equipmentFields
export type EquipmentInput = z.input<typeof equipmentSchema>

// ---------------------------------------------------------------------------
// Lead
// ---------------------------------------------------------------------------

export const LEAD_ORIGINS = ["indicacao", "site", "whatsapp"] as const
export const LEAD_STAGES = [
  "lead",
  "reuniao_marcada",
  "reuniao_realizada",
  "venda",
  "perdido",
] as const

export const leadSchema = z
  .object({
    id: idOpcional,
    nome_contato: z.string().trim().min(2, "Informe o nome do contato.").max(120, "Nome muito longo."),
    empresa: optionalText(200, "Empresa"),
    telefone: z
      .string()
      .trim()
      .refine((v) => v === "" || onlyDigits(v).length >= 10, {
        message: "Telefone incompleto. Use DDD + número.",
      })
      .transform((v) => (v === "" ? null : v)),
    email: z
      .string()
      .trim()
      .refine((v) => v === "" || z.email().safeParse(v).success, { message: "E-mail inválido." })
      .transform((v) => (v === "" ? null : v.toLowerCase())),
    origem: z.enum(LEAD_ORIGINS, "Selecione a origem."),
    estagio: z.enum(LEAD_STAGES, "Selecione a etapa."),
    valor_estimado: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (v === "") return null
        const n = parseDecimalBR(v.replace(/^R\$\s*/, ""))
        if (n === null || n < 0 || n > 9_999_999_999) {
          ctx.addIssue({ code: "custom", message: "Valor estimado inválido." })
          return z.NEVER
        }
        return Math.round(n * 100) / 100
      }),
    motivo_perda: optionalText(500, "Motivo da perda"),
    observacoes: optionalText(2000, "Observações"),
  })
  .superRefine((l, ctx) => {
    if (l.estagio === "perdido" && !l.motivo_perda) {
      ctx.addIssue({
        code: "custom",
        path: ["motivo_perda"],
        message: "Informe o motivo da perda.",
      })
    }
  })
export type LeadInput = z.input<typeof leadSchema>

export const moveLeadSchema = z
  .object({
    id: uuidObrigatorio("Lead inválido."),
    estagio: z.enum(LEAD_STAGES, "Etapa inválida."),
    motivo_perda: optionalText(500, "Motivo da perda").optional(),
  })
  .superRefine((l, ctx) => {
    if (l.estagio === "perdido" && !l.motivo_perda) {
      ctx.addIssue({ code: "custom", path: ["motivo_perda"], message: "Informe o motivo da perda." })
    }
  })

// ---------------------------------------------------------------------------
// Plano PMOC
// ---------------------------------------------------------------------------

export const pmocPlanSchema = z.object({
  id: idOpcional,
  equipment_id: uuidObrigatorio("Selecione o equipamento."),
  periodicidade_dias: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const n = parseIntBR(v)
      if (n === null || n < 1 || n > 730) {
        ctx.addIssue({ code: "custom", message: "Periodicidade entre 1 e 730 dias." })
        return z.NEVER
      }
      return n
    }),
  proxima_data: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const iso = parseDateBR(v)
      if (!iso) {
        ctx.addIssue({ code: "custom", message: "Informe a próxima data." })
        return z.NEVER
      }
      return iso
    }),
  responsavel_tecnico: z
    .string()
    .trim()
    .min(3, "Informe o responsável técnico (nome / CREA).")
    .max(120, "Responsável técnico muito longo."),
  checklist_template_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid("Checklist inválido.").nullable()),
  observacoes: optionalText(2000, "Observações"),
})
export type PmocPlanInput = z.input<typeof pmocPlanSchema>

// ---------------------------------------------------------------------------
// Erros por campo
// ---------------------------------------------------------------------------

export type FieldErrors = Record<string, string>

/** Primeiro erro de cada campo, para exibir abaixo do input. */
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_")
    if (!out[key]) out[key] = issue.message
  }
  return out
}
