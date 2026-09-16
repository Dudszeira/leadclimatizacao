import type { Metadata } from "next"
import { MapPinnedIcon } from "lucide-react"

import type { EquipmentWithBuilding, Result } from "@/lib/types"
import { listBuildingsForMap } from "@/server/buildings"
import { listEquipment } from "@/server/equipment"
import { DataError } from "@/components/clientes/data-error"
import { MapaView } from "@/components/mapa/mapa-view"
import {
  derivePinStatus,
  emptyStatusCounts,
  type MapaBuilding,
  type StatusCounts,
} from "@/components/mapa/status"

export const metadata: Metadata = {
  title: "Mapa de Equipamentos",
}

const EQUIPMENT_PAGE_SIZE = 100
const MAX_EQUIPMENT_PAGES = 20

/** Todos os equipamentos (percorre a paginação do data layer). */
async function listAllEquipment(): Promise<Result<EquipmentWithBuilding[]>> {
  const first = await listEquipment({ page: 1, pageSize: EQUIPMENT_PAGE_SIZE })
  if (first.error !== null) return first
  const all = [...first.data.items]
  const pageCount = Math.min(first.data.pageCount, MAX_EQUIPMENT_PAGES)
  for (let page = 2; page <= pageCount; page++) {
    const res = await listEquipment({ page, pageSize: EQUIPMENT_PAGE_SIZE })
    if (res.error !== null) return res
    all.push(...res.data.items)
  }
  return { data: all, error: null }
}

export default async function MapaPage() {
  const [buildingsRes, equipmentRes] = await Promise.all([
    listBuildingsForMap(),
    listAllEquipment(),
  ])

  if (buildingsRes.error !== null) {
    return <DataError message={buildingsRes.error} />
  }
  if (equipmentRes.error !== null) {
    return <DataError message={equipmentRes.error} />
  }

  const countsByBuilding = new Map<string, StatusCounts>()
  for (const eq of equipmentRes.data) {
    const counts = countsByBuilding.get(eq.building_id) ?? emptyStatusCounts()
    counts[eq.status] += 1
    countsByBuilding.set(eq.building_id, counts)
  }

  const buildings: MapaBuilding[] = buildingsRes.data
    .map((b) => {
      const status_counts = countsByBuilding.get(b.id) ?? emptyStatusCounts()
      return { ...b, status_counts, pin_status: derivePinStatus(status_counts) }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))

  if (buildings.length === 0) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-console/50 px-6 py-16 text-center">
        <div
          className="flex size-16 items-center justify-center rounded-2xl border border-line-soft bg-console-2"
          aria-hidden="true"
        >
          <MapPinnedIcon className="size-8 text-ink-faint" />
        </div>
        <h2 className="mt-6 font-display text-lg font-bold tracking-tight text-ink">
          Nenhum prédio no mapa
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
          Cadastre prédios com endereço e coordenadas para vê-los aqui, com o
          status dos equipamentos de cada unidade.
        </p>
      </section>
    )
  }

  return <MapaView buildings={buildings} />
}
