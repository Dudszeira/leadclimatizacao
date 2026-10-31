import type {
  ContractStatus,
  ContractType,
  ConversationStatus,
  EquipmentStatus,
  EquipmentType,
  InvoiceStatus,
  OsOrigin,
  OsPriority,
  OsStatus,
  OsType,
  PaymentMethod,
  QuoteServiceType,
  QuoteStatus,
} from "@/lib/types"

/**
 * Metadados compartilhados de enum → { label, classes } (cores sempre pelos
 * tokens do design system — nada hardcoded).
 *
 * Semântica de cores de status (design-system/MASTER.md):
 * - "Cancelado" é NEUTRO (ink-faint) em OS e faturas — danger fica reservado
 *   pra atrasado/urgente/risco.
 * - "Em campo / técnico em campo" é SIGNAL (azul) em todas as telas.
 * - Tipo de OS e de contrato são NEUTROS (pílula contornada): no mundo
 *   grafite a cor fica só para estado, prioridade e marca.
 */

// ---------------------------------------------------------------------------
// Clientes: segmento, região e status
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

// ---------------------------------------------------------------------------
// Contratos
// ---------------------------------------------------------------------------

export const CONTRACT_TYPE_META: Record<
  ContractType,
  { label: string; badgeClassName: string }
> = {
  pmoc_recorrente: {
    label: "PMOC recorrente",
    badgeClassName: "border-line bg-transparent text-ink-dim",
  },
  corretiva_avulsa: {
    label: "Corretiva avulsa",
    badgeClassName: "border-line bg-transparent text-ink-dim",
  },
  instalacao: {
    label: "Instalação",
    badgeClassName: "border-line bg-transparent text-ink-dim",
  },
}

export const CONTRACT_TYPE_LABELS = Object.fromEntries(
  Object.entries(CONTRACT_TYPE_META).map(([value, meta]) => [value, meta.label]),
) as Record<ContractType, string>

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

// ---------------------------------------------------------------------------
// Equipamentos
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Ordens de serviço (chamados)
// ---------------------------------------------------------------------------

export const OS_TYPE_META: Record<
  OsType,
  { label: string; badgeClassName: string }
> = {
  preventiva_pmoc: {
    label: "Preventiva PMOC",
    badgeClassName: "border-line bg-transparent text-ink-dim",
  },
  corretiva: {
    label: "Corretiva",
    badgeClassName: "border-line bg-transparent text-ink-dim",
  },
  instalacao: {
    label: "Instalação",
    badgeClassName: "border-line bg-transparent text-ink-dim",
  },
  orcamento: {
    label: "Orçamento",
    badgeClassName: "border-line bg-transparent text-ink-dim",
  },
}

export const OS_PRIORITY_META: Record<
  OsPriority,
  { label: string; dotClassName: string }
> = {
  urgente: { label: "Urgente", dotClassName: "bg-danger" },
  alta: { label: "Alta", dotClassName: "bg-amber" },
  media: { label: "Média", dotClassName: "bg-ink-dim" },
  baixa: { label: "Baixa", dotClassName: "bg-ink-faint" },
}

export const OS_STATUS_META: Record<
  OsStatus,
  { label: string; badgeClassName: string }
> = {
  aberto: {
    label: "Aberto",
    badgeClassName: "border-transparent bg-amber-dim text-amber",
  },
  agendado: {
    label: "Agendado",
    badgeClassName: "border-transparent bg-console-3 text-ink",
  },
  em_campo: {
    label: "Em campo",
    badgeClassName: "border-transparent bg-signal-dim text-signal",
  },
  concluido: {
    label: "Concluído",
    badgeClassName: "border-transparent bg-clear-dim text-clear",
  },
  cancelado: {
    label: "Cancelado",
    badgeClassName: "border-line bg-console-2 text-ink-faint",
  },
}

export const OS_ORIGIN_META: Record<OsOrigin, { label: string }> = {
  manual: { label: "Abertura manual" },
  pmoc_auto: { label: "Gerado pelo plano PMOC" },
  ia_whatsapp: { label: "Aberto pela IA no WhatsApp" },
}

// ---------------------------------------------------------------------------
// Faturas
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
    badgeClassName: "border-line bg-console-2 text-ink-faint",
  },
}

export const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string }> = {
  pix: { label: "Pix" },
  boleto: { label: "Boleto" },
}

// ---------------------------------------------------------------------------
// Conversas (Atendimento IA)
// ---------------------------------------------------------------------------

export const CONVERSATION_STATUS_META: Record<
  ConversationStatus,
  { label: string; badgeClassName: string; dotClassName: string }
> = {
  ia: {
    label: "IA",
    badgeClassName: "border-transparent bg-signal-dim text-signal",
    dotClassName: "bg-signal",
  },
  transferido: {
    label: "Transferido",
    badgeClassName: "border-transparent bg-amber-dim text-amber",
    dotClassName: "bg-amber",
  },
  encerrado: {
    label: "Encerrado",
    badgeClassName: "border-line bg-console-2 text-ink-dim",
    dotClassName: "bg-ink-faint",
  },
}

// ---------------------------------------------------------------------------
// Orçamentos
// ---------------------------------------------------------------------------

export const QUOTE_SERVICE_TYPE_LABEL: Record<QuoteServiceType, string> = {
  diagnostico: "Diagnóstico",
  instalacao: "Instalação",
  corretiva: "Corretiva",
  preventiva: "Preventiva",
}

export const QUOTE_STATUS_META: Record<
  QuoteStatus,
  { label: string; badgeClassName: string }
> = {
  aguardando: {
    label: "Aguardando resposta",
    badgeClassName: "border-transparent bg-amber-dim text-amber",
  },
  aprovado: {
    label: "Aprovado",
    badgeClassName: "border-transparent bg-clear-dim text-clear",
  },
  declinado: {
    label: "Declinado",
    badgeClassName: "border-line bg-console-2 text-ink-faint",
  },
}

/** "ORC-1004" (mesmo padrão de "OS-1004"). */
export function quoteNumeroLabel(numero: number): string {
  return `ORC-${numero}`
}
