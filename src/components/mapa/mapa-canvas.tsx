"use client"

import "leaflet/dist/leaflet.css"

import * as React from "react"
import Link from "next/link"
import L from "leaflet"
import {
  AttributionControl,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet"
import { cn } from "cn"
import { ArrowUpRightIcon } from "lucide-react"

import type { EquipmentStatus } from "@/lib/types"
import { EQUIPMENT_STATUS_META } from "@/lib/status-meta"
import { buttonVariants } from "@/components/ui/button"
import {
  buildingAddress,
  clientName,
  LEGEND_ORDER,
  type MapaBuilding,
} from "@/components/mapa/status"

/** Centro de Curitiba. */
const CURITIBA: L.LatLngTuple = [-25.4372, -49.2699]
const DEFAULT_ZOOM = 12
const FOCUS_ZOOM = 15

const iconCache = new Map<EquipmentStatus, L.DivIcon>()

function pinIcon(status: EquipmentStatus): L.DivIcon {
  let icon = iconCache.get(status)
  if (!icon) {
    icon = L.divIcon({
      className: "map-pin-wrap",
      html: `<span class="map-pin map-pin--${status}"></span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -12],
    })
    iconCache.set(status, icon)
  }
  return icon
}

type Focus = { id: string; nonce: number }

type FocusControllerProps = {
  focus: Focus | null
  markers: React.RefObject<Map<string, L.Marker>>
}

/** Voa até o prédio selecionado no painel e abre o popup do pino. */
function FocusController({ focus, markers }: FocusControllerProps) {
  const map = useMap()

  React.useEffect(() => {
    if (!focus) return
    const marker = markers.current?.get(focus.id)
    if (!marker) return

    const target = marker.getLatLng()
    const zoom = Math.max(map.getZoom(), FOCUS_ZOOM)
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches

    map.once("moveend", () => marker.openPopup())
    if (reduceMotion) {
      map.setView(target, zoom)
    } else {
      map.flyTo(target, zoom, { duration: 0.8 })
    }
  }, [focus, map, markers])

  return null
}

/**
 * O contêiner do mapa muda de tamanho depois de montar (altura calculada pela
 * área útil, painel lateral, rotação do celular): avisa o Leaflet para
 * recalcular e carregar os tiles que faltam.
 */
function SizeWatcher() {
  const map = useMap()
  React.useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])
  return null
}

function PinPopup({ building }: { building: MapaBuilding }) {
  const statuses = LEGEND_ORDER.filter((s) => building.status_counts[s] > 0)

  return (
    <div className="w-60 p-4 font-sans">
      <p className="font-display text-base leading-snug font-medium tracking-[-0.015em] text-ink">
        {building.nome}
      </p>
      <p className="mt-0.5 text-[0.8125rem] text-ink-dim">{clientName(building)}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-faint">
        {buildingAddress(building)}
      </p>

      <ul className="mt-3 space-y-2 border-t border-line pt-3">
        {statuses.map((status) => (
          <li key={status} className="flex items-center gap-2 text-[0.8125rem] text-ink-dim">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                EQUIPMENT_STATUS_META[status].dotClassName,
              )}
              aria-hidden="true"
            />
            <span className="flex-1">{EQUIPMENT_STATUS_META[status].label}</span>
            <span className="font-medium text-ink tabular-nums">
              {building.status_counts[status]}
            </span>
          </li>
        ))}
        {statuses.length === 0 && (
          <li className="text-[0.8125rem] text-ink-faint">Nenhum equipamento cadastrado</li>
        )}
      </ul>

      <Link
        href={`/clientes/${building.client.id}`}
        className={cn(buttonVariants(), "mt-4 w-full text-void! no-underline!")}
        aria-label={`Ver cliente ${clientName(building)}`}
      >
        Ver cliente
        <ArrowUpRightIcon aria-hidden="true" />
      </Link>
    </div>
  )
}

export type MapaCanvasProps = {
  buildings: MapaBuilding[]
  focus: Focus | null
}

/**
 * Mapa Leaflet (só cliente — importado com dynamic ssr:false).
 * Tiles OSM recebem .map-tiles (filtro CSS em escala de cinza escura).
 * Atribuição no canto superior direito: o rodapé fica com a alça da gaveta.
 */
export default function MapaCanvas({ buildings, focus }: MapaCanvasProps) {
  const markersRef = React.useRef<Map<string, L.Marker>>(new Map())

  return (
    <MapContainer
      center={CURITIBA}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      attributionControl={false}
      className="absolute inset-0 z-0 h-full w-full"
      aria-label="Mapa de prédios atendidos em Curitiba"
    >
      <TileLayer
        className="map-tiles"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <AttributionControl position="topright" />
      <SizeWatcher />
      <FocusController focus={focus} markers={markersRef} />
      {buildings.map((b) => (
        <Marker
          key={b.id}
          position={[b.lat as number, b.lng as number]}
          icon={pinIcon(b.pin_status)}
          alt={`${b.nome}, ${EQUIPMENT_STATUS_META[b.pin_status].label}`}
          ref={(marker) => {
            if (marker) markersRef.current.set(b.id, marker)
            else markersRef.current.delete(b.id)
          }}
        >
          <Popup minWidth={240} maxWidth={280} closeButton={false}>
            <PinPopup building={b} />
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
