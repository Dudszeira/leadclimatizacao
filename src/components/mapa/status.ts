import type { Building, BuildingMapItem, EquipmentStatus } from "@/lib/types"

/** Contagem de equipamentos por status dentro de um prédio. */
export type StatusCounts = Record<EquipmentStatus, number>

/** Pino do mapa: prédio + cliente + contagens e pior status derivado. */
export interface MapaBuilding extends BuildingMapItem {
  status_counts: StatusCounts
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
