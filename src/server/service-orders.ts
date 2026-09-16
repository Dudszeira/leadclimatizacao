import { isDemoMode } from "@/lib/env";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type {
  OsPriority,
  OsStatus,
  OsType,
  PageParams,
  Paginated,
  Result,
  ServiceOrderListItem,
  ServiceOrderWithRelations,
} from "@/lib/types";
import {
  demoServiceOrderListItem,
  demoServiceOrderWithRelations,
  serviceOrdersFixture,
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

export interface ListServiceOrdersParams extends PageParams {
  /** Busca por número da OS ou descrição. */
  search?: string;
  status?: OsStatus;
  tipo?: OsType;
  prioridade?: OsPriority;
  technicianId?: string;
  buildingId?: string;
}

const LIST_EMBED =
  "building:buildings(id,nome,bairro,regiao, client:clients(id,razao_social,nome_fantasia)), " +
  "equipment(id,codigo_interno,tipo,marca,modelo), " +
  "technician:profiles!service_orders_technician_id_fkey(id,full_name,phone)";

const DETAIL_EMBED =
  "building:buildings(*, client:clients(id,razao_social,nome_fantasia,segmento)), " +
  "equipment(*), " +
  "technician:profiles!service_orders_technician_id_fkey(*), " +
  "checklist_template:checklist_templates(*), " +
  "pmoc_plan:pmoc_plans(*)";

/** Lista paginada de OS com prédio/cliente, equipamento e técnico. */
export async function listServiceOrders(
  params: ListServiceOrdersParams = {},
): Promise<Result<Paginated<ServiceOrderListItem>>> {
  try {
    if (isDemoMode) {
      let items = serviceOrdersFixture.map(demoServiceOrderListItem);
      if (params.status) items = items.filter((o) => o.status === params.status);
      if (params.tipo) items = items.filter((o) => o.tipo === params.tipo);
      if (params.prioridade) items = items.filter((o) => o.prioridade === params.prioridade);
      if (params.technicianId) items = items.filter((o) => o.technician_id === params.technicianId);
      if (params.buildingId) items = items.filter((o) => o.building_id === params.buildingId);
      const term = params.search;
      if (term) {
        items = items.filter((o) =>
          matchesSearch(
            term,
            o.numero,
            o.descricao,
            o.building.nome,
            o.building.client.razao_social,
            o.building.client.nome_fantasia,
          ),
        );
      }
      items.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return ok(paginate(items, params));
    }

    const supabase = await createSupabase();
    const { from, to } = pageRange(params);
    let query = supabase
      .from("service_orders")
      .select(`*, ${LIST_EMBED}`, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (params.status) query = query.eq("status", params.status);
    if (params.tipo) query = query.eq("tipo", params.tipo);
    if (params.prioridade) query = query.eq("prioridade", params.prioridade);
    if (params.technicianId) query = query.eq("technician_id", params.technicianId);
    if (params.buildingId) query = query.eq("building_id", params.buildingId);
    const q = params.search ? sanitizeIlike(params.search) : "";
    if (q) {
      const numero = Number.parseInt(q.replace(/^os-?/i, ""), 10);
      query = Number.isFinite(numero)
        ? query.eq("numero", numero)
        : query.ilike("descricao", `%${q}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      return failWith("listServiceOrders", error, "Não foi possível carregar os chamados. Tente novamente.");
    }
    return ok(toPaginated((data ?? []) as ServiceOrderListItem[], count, params));
  } catch (error) {
    return failWith("listServiceOrders", error, "Não foi possível carregar os chamados. Tente novamente.");
  }
}

/** OS por id com equipamento, prédio (+cliente), técnico, checklist e plano. */
export async function getServiceOrder(
  id: string,
): Promise<Result<ServiceOrderWithRelations | null>> {
  try {
    if (isDemoMode) {
      const os = serviceOrdersFixture.find((o) => o.id === id);
      return ok(os ? demoServiceOrderWithRelations(os) : null);
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("service_orders")
      .select(`*, ${DETAIL_EMBED}`)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return failWith("getServiceOrder", error, "Não foi possível carregar o chamado. Tente novamente.");
    }
    return ok((data ?? null) as ServiceOrderWithRelations | null);
  } catch (error) {
    return failWith("getServiceOrder", error, "Não foi possível carregar o chamado. Tente novamente.");
  }
}

/** OS pelo número humano (ex.: 1004 para "OS-1004"). */
export async function getServiceOrderByNumero(
  numero: number,
): Promise<Result<ServiceOrderWithRelations | null>> {
  try {
    if (isDemoMode) {
      const os = serviceOrdersFixture.find((o) => o.numero === numero);
      return ok(os ? demoServiceOrderWithRelations(os) : null);
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("service_orders")
      .select(`*, ${DETAIL_EMBED}`)
      .eq("numero", numero)
      .maybeSingle();
    if (error) {
      return failWith("getServiceOrderByNumero", error, "Não foi possível carregar o chamado. Tente novamente.");
    }
    return ok((data ?? null) as ServiceOrderWithRelations | null);
  } catch (error) {
    return failWith("getServiceOrderByNumero", error, "Não foi possível carregar o chamado. Tente novamente.");
  }
}
