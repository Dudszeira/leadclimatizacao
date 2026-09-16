import type { EquipmentType, PmocSituacao } from "@/lib/types"

/**
 * Modelo de evento do Calendário PMOC (serializável, server → client).
 * Situação POR EVENTO — difere da situação do plano: ocorrências projetadas
 * pela periodicidade são sempre "futura" e OS concluídas viram "concluida".
 */
export type PmocEventoSituacao = "futura" | "vencendo" | "atrasada" | "concluida"

export interface PmocEvento {
  /** Dia do evento no mês consultado, "YYYY-MM-DD". */
  data: string
  pmoc_plan_id: string | null
  codigo_interno: string
  equipamento_tipo: EquipmentType
  cliente: string
  predio: string
  situacao: PmocEventoSituacao
  /** true quando é projeção (proxima_data + n × periodicidade). */
  projetada: boolean
  /** OS ligada ao evento (gerada/em andamento ou concluída), quando existir. */
  os_id: string | null
  os_numero: number | null
}

/** Situação do evento a partir da situação do plano (visita não projetada). */
export function situacaoDoEvento(
  situacaoPlano: PmocSituacao,
  projetada: boolean,
): PmocEventoSituacao {
  if (projetada) return "futura"
  if (situacaoPlano === "atrasado") return "atrasada"
  if (situacaoPlano === "vencendo") return "vencendo"
  return "futura"
}

export const EVENTO_META: Record<
  PmocEventoSituacao,
  { label: string; chip: string; dot: string; badge: string; text: string }
> = {
  futura: {
    label: "Prevista",
    chip: "bg-signal-dim text-signal hover:bg-signal/25",
    dot: "bg-signal",
    badge: "border-transparent bg-signal-dim text-signal",
    text: "text-signal",
  },
  vencendo: {
    label: "Vencendo",
    chip: "bg-amber-dim text-amber hover:bg-amber/25",
    dot: "bg-amber",
    badge: "border-transparent bg-amber-dim text-amber",
    text: "text-amber",
  },
  atrasada: {
    label: "Atrasada",
    chip: "bg-danger-dim text-danger hover:bg-danger/25",
    dot: "bg-danger",
    badge: "border-transparent bg-danger-dim text-danger",
    text: "text-danger",
  },
  concluida: {
    label: "Concluída",
    chip: "bg-clear-dim text-clear hover:bg-clear/25",
    dot: "bg-clear",
    badge: "border-transparent bg-clear-dim text-clear",
    text: "text-clear",
  },
}

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  split: "Split",
  vrf: "VRF",
  chiller: "Chiller",
  self: "Self",
  janela: "Janela",
}

/** "YYYY-MM-DD" → Date local (sem deriva de fuso). */
export function parseDia(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** Plural pt-BR do rótulo de acessibilidade das células. */
export function rotuloManutencoes(total: number): string {
  if (total === 0) return "sem manutenções"
  return total === 1 ? "1 manutenção" : `${total} manutenções`
}
