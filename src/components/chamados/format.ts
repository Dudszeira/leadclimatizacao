import type { OsOrigin, OsPriority, OsStatus, OsType } from "@/lib/types"

/**
 * Helpers puros do módulo de chamados: rótulos pt-BR e metadados visuais
 * (cores sempre pelos tokens do design system — nada hardcoded).
 */

/** 1004 → "#1004" (exibido em mono). */
export function formatOsNumero(numero: number): string {
  return `#${numero}`
}

/** ISO → "dd/mm/aaaa" no fuso local. */
export function formatDateTimeBR(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("pt-BR")
}

/** ISO → "dd/mm/aaaa às 14h05". */
export function formatDateTimeFullBR(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const data = d.toLocaleDateString("pt-BR")
  const h = String(d.getHours()).padStart(2, "0")
  const m = String(d.getMinutes()).padStart(2, "0")
  return `${data} às ${h}h${m}`
}

/** ISO → "14h05". */
export function formatHourBR(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`
}

/** "Carlos Menezes" → "CM" (iniciais para o avatar do técnico). */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return `${first}${last}`.toUpperCase()
}

/** "50000000-.../antes/condensador-01.jpg" → "condensador-01.jpg". */
export function fileBasename(path: string): string {
  const clean = path.split("?")[0]
  return clean.slice(clean.lastIndexOf("/") + 1) || clean
}

// ---------------------------------------------------------------------------
// Metadados por enum
// ---------------------------------------------------------------------------

export const OS_TYPE_META: Record<
  OsType,
  { label: string; badgeClassName: string }
> = {
  preventiva_pmoc: {
    label: "Preventiva PMOC",
    badgeClassName: "border-transparent bg-clear-dim text-clear",
  },
  corretiva: {
    label: "Corretiva",
    badgeClassName: "border-transparent bg-amber-dim text-amber",
  },
  instalacao: {
    label: "Instalação",
    badgeClassName: "border-transparent bg-signal-dim text-signal",
  },
  orcamento: {
    label: "Orçamento",
    badgeClassName: "border-line bg-console-2 text-ink-dim",
  },
}

export const OS_PRIORITY_META: Record<
  OsPriority,
  { label: string; dotClassName: string }
> = {
  urgente: { label: "Urgente", dotClassName: "bg-danger" },
  alta: { label: "Alta", dotClassName: "bg-amber" },
  media: { label: "Média", dotClassName: "bg-signal" },
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
    badgeClassName: "border-transparent bg-signal-dim text-signal",
  },
  em_campo: {
    label: "Em campo",
    badgeClassName: "border-transparent bg-clear-dim text-clear",
  },
  concluido: {
    label: "Concluído",
    badgeClassName: "border-line bg-console-2 text-ink-dim",
  },
  cancelado: {
    label: "Cancelado",
    badgeClassName: "border-transparent bg-danger-dim text-danger",
  },
}

export const OS_ORIGIN_META: Record<OsOrigin, { label: string }> = {
  manual: { label: "Abertura manual" },
  pmoc_auto: { label: "Gerado pelo plano PMOC" },
  ia_whatsapp: { label: "Aberto pela IA no WhatsApp" },
}
