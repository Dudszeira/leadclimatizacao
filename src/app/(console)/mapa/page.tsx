import type { Metadata } from "next"
import { MapPinnedIcon } from "lucide-react"

import { requireRole } from "@/server/auth"
import { listMapPins } from "@/server/map"
import { DataError } from "@/components/data-error"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { MapaView } from "@/components/mapa/mapa-view"
import {
  MAPA_TELA_CLASS,
  derivePinStatus,
  type MapaBuilding,
} from "@/components/mapa/status"

export const metadata: Metadata = {
  title: "Mapa de Equipamentos",
}

const HEADER = {
  title: "Mapa de equipamentos",
  description: "Prédios atendidos e a situação dos equipamentos de cada um.",
}

export default async function MapaPage() {
  // Mapa é do escritório (nav.ts: admin e atendente); técnico usa /campo.
  await requireRole("admin", "atendente")

  const result = await listMapPins()
  if (result.error !== null) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader {...HEADER} />
        <DataError message={result.error} />
      </div>
    )
  }

  const buildings: MapaBuilding[] = result.data
    .map((pin) => ({ ...pin, pin_status: derivePinStatus(pin.status_counts) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))

  if (buildings.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader {...HEADER} />
        <EmptyState
          icon={MapPinnedIcon}
          title="Nenhum prédio no mapa"
          description="Cadastre prédios com endereço e coordenadas no cliente para vê-los aqui, com a situação dos equipamentos de cada unidade."
        />
      </div>
    )
  }

  return (
    <div className={MAPA_TELA_CLASS}>
      <PageHeader {...HEADER} className="pb-4 md:pb-6" />
      <MapaView buildings={buildings} />
    </div>
  )
}
