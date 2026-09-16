import type { Metadata } from "next"
import { MapPinnedIcon } from "lucide-react"

import { EmptyState } from "@/components/empty-state"

export const metadata: Metadata = {
  title: "Mapa de Equipamentos",
}

export default function MapaPage() {
  return (
    <EmptyState
      icon={MapPinnedIcon}
      title="Mapa de equipamentos"
      description="Localização e status de cada equipamento instalado, organizado por cliente e por unidade."
      actionLabel="Mapear equipamento"
    />
  )
}
