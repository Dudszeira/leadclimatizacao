import { isDemoMode } from "@/lib/env";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type {
  EquipmentStatus,
  EquipmentType,
  EquipmentWithBuilding,
  EquipmentWithRelations,
  PageParams,
  Paginated,
  PmocPlan,
  Result,
} from "@/lib/types";
import {
  demoBuildingWithClient,
  demoPlanByEquipment,
  equipmentFixture,
} from "./_demo";
import {
  failWith,
  matchesSearch,
  ok,
  pageRange,
  paginate,
  sanitizeIlike,
  toPaginated,
} from "./_shared";

export interface ListEquipmentParams extends PageParams {
  /** Busca por código interno, marca, modelo ou ambiente. */
  search?: string;
  status?: EquipmentStatus;
  tipo?: EquipmentType;
  buildingId?: string;
  clientId?: string;
}

const BUILDING_EMBED =
  "building:buildings!inner(*, client:clients(id,razao_social,nome_fantasia,segmento))";

/** Lista paginada de equipamentos com prédio + cliente. */
export async function listEquipment(
  params: ListEquipmentParams = {},
): Promise<Result<Paginated<EquipmentWithBuilding>>> {
  try {
    if (isDemoMode) {
      let items = equipmentFixture.map((e) => ({
        ...e,
        building: demoBuildingWithClient(e.building_id),
      }));
      if (params.status) items = items.filter((e) => e.status === params.status);
      if (params.tipo) items = items.filter((e) => e.tipo === params.tipo);
      if (params.buildingId) items = items.filter((e) => e.building_id === params.buildingId);
      if (params.clientId) items = items.filter((e) => e.building.client_id === params.clientId);
      const term = params.search;
      if (term) {
        items = items.filter((e) =>
          matchesSearch(term, e.codigo_interno, e.marca, e.modelo, e.ambiente, e.building.nome),
        );
      }
      items.sort(
        (a, b) =>
          a.building.nome.localeCompare(b.building.nome, "pt-BR") ||
          a.codigo_interno.localeCompare(b.codigo_interno, "pt-BR"),
      );
      return ok(paginate(items, params));
    }

    const supabase = await createSupabase();
    const { from, to } = pageRange(params);
    let query = supabase
      .from("equipment")
      .select(`*, ${BUILDING_EMBED}`, { count: "exact" })
      .order("codigo_interno", { ascending: true })
      .range(from, to);
    if (params.status) query = query.eq("status", params.status);
    if (params.tipo) query = query.eq("tipo", params.tipo);
    if (params.buildingId) query = query.eq("building_id", params.buildingId);
    if (params.clientId) query = query.eq("building.client_id", params.clientId);
    const q = params.search ? sanitizeIlike(params.search) : "";
    if (q) {
      query = query.or(
        `codigo_interno.ilike.%${q}%,marca.ilike.%${q}%,modelo.ilike.%${q}%,ambiente.ilike.%${q}%`,
      );
    }

    const { data, error, count } = await query;
    if (error) {
      return failWith("listEquipment", error, "Não foi possível carregar os equipamentos. Tente novamente.");
    }
    return ok(toPaginated((data ?? []) as EquipmentWithBuilding[], count, params));
  } catch (error) {
    return failWith("listEquipment", error, "Não foi possível carregar os equipamentos. Tente novamente.");
  }
}

/** Equipamento por id com prédio, cliente e plano PMOC (se houver). */
export async function getEquipment(
  id: string,
): Promise<Result<EquipmentWithRelations | null>> {
  try {
    if (isDemoMode) {
      const equipment = equipmentFixture.find((e) => e.id === id);
      if (!equipment) return ok(null);
      return ok({
        ...equipment,
        building: demoBuildingWithClient(equipment.building_id),
        pmoc_plan: demoPlanByEquipment(id),
      });
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("equipment")
      .select(
        "*, building:buildings(*, client:clients(id,razao_social,nome_fantasia,segmento)), pmoc_plan:pmoc_plans(*)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return failWith("getEquipment", error, "Não foi possível carregar o equipamento. Tente novamente.");
    }
    if (!data) return ok(null);
    // pmoc_plans tem unique(equipment_id), mas o embed 1-N volta como array
    const row = data as Omit<EquipmentWithRelations, "pmoc_plan"> & {
      pmoc_plan: PmocPlan | PmocPlan[] | null;
    };
    const plan = Array.isArray(row.pmoc_plan) ? row.pmoc_plan[0] ?? null : row.pmoc_plan;
    return ok({ ...row, pmoc_plan: plan });
  } catch (error) {
    return failWith("getEquipment", error, "Não foi possível carregar o equipamento. Tente novamente.");
  }
}
