import type {
  ContractStatus,
  ContractType,
  InvoiceStatus,
  PaymentMethod,
} from "@/lib/types"

/**
 * Helpers puros do módulo financeiro: formatação BRL/datas e metadados
 * visuais por enum (cores sempre pelos tokens do design system).
 */

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

const moedaInteira = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
})

/** 8900 → "R$ 8.900,00". */
export function formatBRL(valor: number): string {
  return moeda.format(valor)
}

/** 45000 → "R$ 45.000" (KPIs, sem centavos). */
export function formatBRLInteiro(valor: number): string {
  return moedaInteira.format(valor)
}

/** 12.5 → "12,5%" — "—" quando null (denominador zero). */
export function formatPct(valor: number | null): string {
  if (valor === null) return "—"
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(valor)}%`
}

/** "2026-09-01" → "set/2026". */
export function formatCompetencia(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number)
  if (!y || !m) return "—"
  const label = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  })
  return label.replace(". de ", "/").replace(" de ", "/")
}

/** "2026-09-01" → "setembro de 2026" (opções do filtro). */
export function formatCompetenciaLonga(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number)
  if (!y || !m) return "—"
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  })
}

/** "2026-09-15" → "15/09/2026" (datas date-only, sem fuso). */
export function formatDateBR(isoDate: string | null): string {
  if (!isoDate) return "—"
  const [y, m, d] = isoDate.slice(0, 10).split("-")
  if (!y || !m || !d) return "—"
  return `${d}/${m}/${y}`
}

// ---------------------------------------------------------------------------
// Metadados por enum
// ---------------------------------------------------------------------------

export const INVOICE_STATUS_META: Record<
  InvoiceStatus,
  { label: string; badgeClassName: string }
> = {
  pendente: {
    label: "Pendente",
    badgeClassName: "border-transparent bg-amber-dim text-amber",
  },
  pago: {
    label: "Pago",
    badgeClassName: "border-transparent bg-clear-dim text-clear",
  },
  atrasado: {
    label: "Atrasado",
    badgeClassName: "border-transparent bg-danger-dim text-danger",
  },
  cancelado: {
    label: "Cancelado",
    badgeClassName: "border-line bg-console-2 text-ink-dim",
  },
}

export const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string }> = {
  pix: { label: "Pix" },
  boleto: { label: "Boleto" },
}

export const CONTRACT_TYPE_META: Record<
  ContractType,
  { label: string; badgeClassName: string }
> = {
  pmoc_recorrente: {
    label: "PMOC recorrente",
    badgeClassName: "border-transparent bg-signal-dim text-signal",
  },
  corretiva_avulsa: {
    label: "Corretiva avulsa",
    badgeClassName: "border-transparent bg-amber-dim text-amber",
  },
  instalacao: {
    label: "Instalação",
    badgeClassName: "border-transparent bg-clear-dim text-clear",
  },
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
