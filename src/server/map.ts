import { isDemoMode } from "@/lib/env";
import type {
  EquipmentStatus,
  EquipmentStatusCounts,
  MapBounds,
  MapPin,
  Result,
} from "@/lib/types";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { buildingsFixture, demoClient, equipmentFixture } from "./_demo";
import { failWith, ok } from "./_shared";

/**
 * Dados do Mapa de Equipamentos numa consulta só: prédios com coordenada,
 * cliente mínimo e o status de cada equipamento embutido (só a coluna
 * status), agregados aqui em contagens. Sem paginação sequencial.
 *
 * Volume esperado na Fase 1: centenas de prédios. O teto abaixo protege a
 * tela; se for atingido, passe `bounds` (recorte do viewport) para filtrar.
 */
export const MAP_MAX_BUILDINGS = 3000;

const MAP_SELECT =
  "id,nome,lat,lng,logradouro,numero,bairro,cidade,uf,client:clients(id,razao_social,nome_fantasia),equipment(status)";

export function emptyEquipmentStatusCounts(): EquipmentStatusCounts {
  return { operacional: 0, chamado_aberto: 0, tecnico_em_campo: 0, inativo: 0 };
}

function countStatuses(statuses: EquipmentStatus[]): EquipmentStatusCounts {
  const counts = emptyEquipmentStatusCounts();
  for (const s of statuses) if (s in counts) counts[s] += 1;
  return counts;
}

function inBounds(lat: number, lng: number, b?: MapBounds): boolean {
  if (!b) return true;
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}

type MapRow = Omit<MapPin, "equipment_total" | "status_counts" | "lat" | "lng"> & {
  lat: number | null;
  lng: number | null;
  client: MapPin["client"] | null;
  equipment: Array<{ status: EquipmentStatus }> | null;
};

/** Pinos do mapa (opcionalmente só os dentro de `bounds`). */
export async function listMapPins(bounds?: MapBounds): Promise<Result<MapPin[]>> {
  try {
    if (isDemoMode) {
      const pins: MapPin[] = [];
      for (const b of buildingsFixture) {
        if (b.lat === null || b.lng === null || !inBounds(b.lat, b.lng, bounds)) continue;
        const client = demoClient(b.client_id);
        if (!client) continue;
        const statuses = equipmentFixture
          .filter((e) => e.building_id === b.id)
          .map((e) => e.status);
        pins.push({
          id: b.id,
          nome: b.nome,
          lat: b.lat,
          lng: b.lng,
          logradouro: b.logradouro,
          numero: b.numero,
          bairro: b.bairro,
          cidade: b.cidade,
          uf: b.uf,
          client: {
            id: client.id,
            razao_social: client.razao_social,
            nome_fantasia: client.nome_fantasia,
          },
          equipment_total: statuses.length,
          status_counts: countStatuses(statuses),
        });
      }
      return ok(pins);
    }

    const supabase = await createSupabase();
    let query = supabase
      .from("buildings")
      .select(MAP_SELECT)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .order("nome", { ascending: true })
      .limit(MAP_MAX_BUILDINGS);
    if (bounds) {
      query = query
        .gte("lat", bounds.south)
        .lte("lat", bounds.north)
        .gte("lng", bounds.west)
        .lte("lng", bounds.east);
    }

    const { data, error } = await query;
    if (error) {
      return failWith("listMapPins", error, "Não foi possível carregar o mapa de prédios. Tente novamente.");
    }
    const rows = (data ?? []) as unknown as MapRow[];
    if (rows.length >= MAP_MAX_BUILDINGS) {
      console.warn(
        `[data-layer] listMapPins: teto de ${MAP_MAX_BUILDINGS} prédios atingido; considere filtrar por bounds.`,
      );
    }
    const pins: MapPin[] = [];
    for (const { equipment, client, lat, lng, ...rest } of rows) {
      if (lat === null || lng === null || !client) continue;
      const statuses = (equipment ?? []).map((e) => e.status);
      pins.push({
        ...rest,
        lat: Number(lat),
        lng: Number(lng),
        client,
        equipment_total: statuses.length,
        status_counts: countStatuses(statuses),
      });
    }
    return ok(pins);
  } catch (error) {
    return failWith("listMapPins", error, "Não foi possível carregar o mapa de prédios. Tente novamente.");
  }
}
