import type {
  ContractStatus,
  ContractType,
  EquipmentStatus,
  EquipmentType,
} from "@/lib/types"

/**
 * Helpers puros de formatação/validação do módulo de clientes.
 * Sem dependência de React — usados tanto na UI quanto na server action.
 */

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "")
}

/** Aplica a máscara 00.000.000/0000-00 progressivamente durante a digitação. */
export function maskCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14)
  let out = d
  if (d.length > 2) out = `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length > 5) out = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length > 8)
    out = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  if (d.length > 12)
    out = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  return out
}

/** Validação dos dígitos verificadores do CNPJ (módulo 11). */
export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false

  const digits = d.split("").map(Number)
  const calc = (length: number) => {
    let weight = length - 7
    let sum = 0
    for (let i = 0; i < length; i++) {
      sum += digits[i] * weight
      weight -= 1
      if (weight < 2) weight = 9
    }
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  return calc(12) === digits[12] && calc(13) === digits[13]
}

/** Máscara progressiva de telefone: (41) 3222-1010 ou (41) 99999-9999. */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length === 0) return ""
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

export function formatBRL(value: number): string {
  return brl.format(value)
}

const numberBR = new Intl.NumberFormat("pt-BR")

export function formatBtu(value: number | null): string {
  if (value == null) return "—"
  return `${numberBR.format(value)} BTU`
}

/** "YYYY-MM-DD" → "dd/mm/aaaa" sem risco de fuso deslocar o dia. */
export function formatDateBR(isoDate: string | null): string {
  if (!isoDate) return "—"
  const [y, m, d] = isoDate.split("-")
  if (!y || !m || !d) return isoDate
  return `${d}/${m}/${y}`
}

// ---------------------------------------------------------------------------
// Rótulos pt-BR e metadados de status (cores pelos tokens do design system)
// ---------------------------------------------------------------------------

export const SEGMENTO_LABELS: Record<string, string> = {
  shopping: "Shopping",
  hospital: "Hospital",
  industria: "Indústria",
  condominio: "Condomínio",
  varejo: "Varejo",
  educacao: "Educação",
  hotelaria: "Hotelaria",
}

export function segmentoLabel(segmento: string | null): string {
  if (!segmento) return "—"
  return (
    SEGMENTO_LABELS[segmento] ??
    segmento.charAt(0).toUpperCase() + segmento.slice(1)
  )
}

export function regiaoLabel(regiao: string | null): string {
  if (!regiao) return "—"
  return regiao.charAt(0).toUpperCase() + regiao.slice(1)
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  pmoc_recorrente: "PMOC recorrente",
  corretiva_avulsa: "Corretiva avulsa",
  instalacao: "Instalação",
}

export const CONTRACT_STATUS_META: Record<
  ContractStatus,
  { label: string; badgeClassName: string }
> = {
  ativo: {
    label: "Ativo",
    badgeClassName: "border-transparent bg-clear-dim text-clear",
  },
  suspenso: {
    label: "Suspenso",
    badgeClassName: "border-transparent bg-amber-dim text-amber",
  },
  encerrado: {
    label: "Encerrado",
    badgeClassName: "border-line bg-console-2 text-ink-dim",
  },
}

export const CLIENT_STATUS_META = {
  ativo: {
    label: "Ativo",
    badgeClassName: "border-transparent bg-clear-dim text-clear",
  },
  inativo: {
    label: "Inativo",
    badgeClassName: "border-line bg-console-2 text-ink-dim",
  },
} as const

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  split: "Split",
  vrf: "VRF",
  chiller: "Chiller",
  self: "Self",
  janela: "Janela",
}

export const EQUIPMENT_STATUS_META: Record<
  EquipmentStatus,
  { label: string; dotClassName: string }
> = {
  operacional: { label: "Operacional", dotClassName: "bg-clear" },
  chamado_aberto: { label: "Chamado aberto", dotClassName: "bg-amber" },
  tecnico_em_campo: { label: "Técnico em campo", dotClassName: "bg-signal" },
  inativo: { label: "Inativo", dotClassName: "bg-ink-faint" },
}
