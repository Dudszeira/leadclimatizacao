import { isDemoMode } from "@/lib/env";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type {
  Client,
  ClientWithRelations,
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
