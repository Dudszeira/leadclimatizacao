import { isDemoMode } from "@/lib/env";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type {
  Client,
  ClientWithRelations,
  ContractType,
  PageParams,
  Paginated,
  Result,
} from "@/lib/types";
import {
  buildingsFixture,
  clientsFixture,
  contractsFixture,
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

export interface ListClientsParams extends PageParams {
  /** Busca por razão social, nome fantasia, CNPJ ou contato. */
  search?: string;
  /** Filtro por status: ativo/inativo. Omitido = todos. */
  ativo?: boolean;
  segmento?: string;
}

/** Lista paginada de clientes, ordenada por razão social. */
export async function listClients(
  params: ListClientsParams = {},
): Promise<Result<Paginated<Client>>> {
  try {
    if (isDemoMode) {
      let items = [...clientsFixture];
      if (params.ativo !== undefined) items = items.filter((c) => c.ativo === params.ativo);
      if (params.segmento) items = items.filter((c) => c.segmento === params.segmento);
      const term = params.search;
      if (term) {
        items = items.filter((c) =>
          matchesSearch(term, c.razao_social, c.nome_fantasia, c.cnpj, c.contato_nome),
        );
      }
      items.sort((a, b) => a.razao_social.localeCompare(b.razao_social, "pt-BR"));
      return ok(paginate(items, params));
    }

    const supabase = await createSupabase();
    const { from, to } = pageRange(params);
    let query = supabase
      .from("clients")
      .select("*", { count: "exact" })
      .order("razao_social", { ascending: true })
      .range(from, to);
    if (params.ativo !== undefined) query = query.eq("ativo", params.ativo);
    if (params.segmento) query = query.eq("segmento", params.segmento);
    const q = params.search ? sanitizeIlike(params.search) : "";
    if (q) {
      query = query.or(
        `razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%,cnpj.ilike.%${q}%,contato_nome.ilike.%${q}%`,
      );
    }

    const { data, error, count } = await query;
    if (error) {
      return failWith("listClients", error, "Não foi possível carregar os clientes. Tente novamente.");
    }
    return ok(toPaginated((data ?? []) as Client[], count, params));
  } catch (error) {
    return failWith("listClients", error, "Não foi possível carregar os clientes. Tente novamente.");
  }
}

/** Resumo agregado por cliente para a listagem (regiões, contrato, equipamentos). */
export interface ClientSummary {
  /** Regiões distintas dos prédios do cliente. */
  regioes: string[];
  /** Contrato de referência: o ativo de maior valor, senão o de maior valor. */
  contrato: { tipo: ContractType; valor_mensal: number } | null;
  equip_count: number;
}

function emptySummary(): ClientSummary {
  return { regioes: [], contrato: null, equip_count: 0 };
}

/**
 * Resumos da lista de clientes em 3 consultas batch no total (em vez de
 * 3 por cliente): prédios, contratos e equipamentos agregados por client_id.
 */
export async function listClientsSummary(
  clientIds: string[],
): Promise<Result<Record<string, ClientSummary>>> {
  try {
    const summaries: Record<string, ClientSummary> = {};
    for (const id of clientIds) summaries[id] = emptySummary();
    if (clientIds.length === 0) return ok(summaries);
    const idSet = new Set(clientIds);

    // Contratos ordenados por valor desc: primeiro ativo do cliente, senão o 1º.
    const pickContract = (
      rows: Array<{ client_id: string; tipo: ContractType; valor_mensal: number; status: string }>,
    ) => {
      const sorted = [...rows].sort((a, b) => b.valor_mensal - a.valor_mensal);
      for (const status of ["ativo", null] as const) {
        for (const c of sorted) {
          const summary = summaries[c.client_id];
          if (!summary || summary.contrato) continue;
          if (status === "ativo" && c.status !== "ativo") continue;
          summary.contrato = { tipo: c.tipo, valor_mensal: c.valor_mensal };
        }
      }
    };

    if (isDemoMode) {
      const buildingClient = new Map<string, string>();
      const orderedBuildings = [...buildingsFixture].sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR"),
      );
      for (const b of orderedBuildings) {
        if (!idSet.has(b.client_id)) continue;
        buildingClient.set(b.id, b.client_id);
        if (b.regiao && !summaries[b.client_id].regioes.includes(b.regiao)) {
          summaries[b.client_id].regioes.push(b.regiao);
        }
      }
      pickContract(contractsFixture.filter((c) => idSet.has(c.client_id)));
      for (const e of equipmentFixture) {
        const clientId = buildingClient.get(e.building_id);
        if (clientId) summaries[clientId].equip_count += 1;
      }
      return ok(summaries);
    }

    const supabase = await createSupabase();
    const [buildings, contracts, equipment] = await Promise.all([
      supabase
        .from("buildings")
        .select("client_id, regiao")
        .in("client_id", clientIds)
        .order("nome", { ascending: true }),
      supabase
        .from("contracts")
        .select("client_id, tipo, valor_mensal, status")
        .in("client_id", clientIds),
      supabase
        .from("equipment")
        .select("id, building:buildings!inner(client_id)")
        .in("building.client_id", clientIds),
    ]);
    const error = buildings.error ?? contracts.error ?? equipment.error;
    if (error) {
      return failWith("listClientsSummary", error, "Não foi possível carregar os clientes. Tente novamente.");
    }

    for (const b of (buildings.data ?? []) as Array<{ client_id: string; regiao: string | null }>) {
      const summary = summaries[b.client_id];
      if (summary && b.regiao && !summary.regioes.includes(b.regiao)) {
        summary.regioes.push(b.regiao);
      }
    }
    pickContract(
      (contracts.data ?? []) as Array<{
        client_id: string;
        tipo: ContractType;
        valor_mensal: number;
        status: string;
      }>,
    );
    for (const e of (equipment.data ?? []) as unknown as Array<{
      building: { client_id: string } | null;
    }>) {
      const clientId = e.building?.client_id;
      if (clientId && summaries[clientId]) summaries[clientId].equip_count += 1;
    }
    return ok(summaries);
  } catch (error) {
    return failWith("listClientsSummary", error, "Não foi possível carregar os clientes. Tente novamente.");
  }
}

/** Cliente por id com prédios (+ equipamentos de cada prédio) e contratos. */
export async function getClient(
  id: string,
): Promise<Result<ClientWithRelations | null>> {
  try {
    if (isDemoMode) {
      const client = clientsFixture.find((c) => c.id === id);
      if (!client) return ok(null);
      const buildings = buildingsFixture
        .filter((b) => b.client_id === id)
        .map((b) => ({
          ...b,
          equipment: equipmentFixture.filter((e) => e.building_id === b.id),
        }));
      const contracts = contractsFixture.filter((c) => c.client_id === id);
      return ok({ ...client, buildings, contracts });
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("clients")
      .select("*, buildings(*, equipment(*)), contracts(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return failWith("getClient", error, "Não foi possível carregar o cliente. Tente novamente.");
    }
    return ok((data ?? null) as ClientWithRelations | null);
  } catch (error) {
    return failWith("getClient", error, "Não foi possível carregar o cliente. Tente novamente.");
  }
}
