import type { Building, EquipmentStatus, MapPin } from "@/lib/types"

/** Contagem de equipamentos por status dentro de um prédio. */
export type StatusCounts = Record<EquipmentStatus, number>

/** Pino do mapa: dados enxutos de src/server/map.ts + pior status derivado. */
export interface MapaBuilding extends MapPin {
  /** Pior status entre os equipamentos do prédio (cor do pino). */
  pin_status: EquipmentStatus
}

/** Ordem de exibição da legenda (contrato visual da demo aceita). */
export const LEGEND_ORDER: readonly EquipmentStatus[] = [
  "operacional",
  "chamado_aberto",
  "tecnico_em_campo",
  "inativo",
]

export function emptyStatusCounts(): StatusCounts {
  return {
    operacional: 0,
    chamado_aberto: 0,
    tecnico_em_campo: 0,
    inativo: 0,
  }
}

/**
 * Pior status entre os equipamentos do prédio:
 * técnico em campo > chamado aberto > operacional; inativo se todos inativos
 * (ou sem equipamentos cadastrados).
 */
export function derivePinStatus(counts: StatusCounts): EquipmentStatus {
  if (counts.tecnico_em_campo > 0) return "tecnico_em_campo"
  if (counts.chamado_aberto > 0) return "chamado_aberto"
  if (counts.operacional > 0) return "operacional"
  return "inativo"
}

/** Endereço curto do prédio para popup e lista. */
export function buildingAddress(
  b: Pick<Building, "logradouro" | "numero" | "bairro" | "cidade" | "uf">,
): string {
  const rua = [b.logradouro, b.numero].filter(Boolean).join(", ")
  return [rua, b.bairro, `${b.cidade}/${b.uf}`].filter(Boolean).join(" · ")
}

/** Nome de exibição do cliente do prédio. */
export function clientName(b: MapaBuilding): string {
  return b.client.nome_fantasia ?? b.client.razao_social
}

/** Normaliza para busca em memória: minúsculas e sem acentos. */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/**
 * Altura da tela do mapa: a página cabe exatamente na área útil.
 * Celular: 100dvh menos o cabeçalho (3.5rem + área segura), o respiro do topo
 * (0.5rem) e a reserva da barra de abas (`.pb-tabbar`). Desktop: menos a
 * moldura (1rem), o cabeçalho (4rem), o respiro (1rem) e o rodapé (2rem).
 */
export const MAPA_TELA_CLASS =
  "flex min-h-[30rem] flex-col h-[calc(100dvh-3.5rem-env(safe-area-inset-top)-0.5rem-var(--tabbar-h)-env(safe-area-inset-bottom)-1.5rem)] md:h-[calc(100dvh-8rem)] md:min-h-[36rem]"
