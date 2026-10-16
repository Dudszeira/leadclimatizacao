import type { Metadata } from "next"
import { MapPinnedIcon } from "lucide-react"

import { requireRole } from "@/server/auth"
import { listMapPins } from "@/server/map"
import { DataError } from "@/components/data-error"
import { MapaView } from "@/components/mapa/mapa-view"
import { derivePinStatus, type MapaBuilding } from "@/components/mapa/status"

export const metadata: Metadata = {
  title: "Mapa de Equipamentos",
}

export default async function MapaPage() {
  // Mapa é do escritório (nav.ts: admin e atendente); técnico usa /campo.
  await requireRole("admin", "atendente")

  const result = await listMapPins()
  if (result.error !== null) {
    return <DataError message={result.error} />
  }

  const buildings: MapaBuilding[] = result.data
    .map((pin) => ({ ...pin, pin_status: derivePinStatus(pin.status_counts) }))
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
