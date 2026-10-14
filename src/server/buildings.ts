import { isDemoMode } from "@/lib/env";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type {
  BuildingWithClient,
  BuildingWithEquipment,
  Client,
  Result,
} from "@/lib/types";
import {
  buildingsFixture,
  clientsFixture,
  demoBuildingWithClient,
  equipmentFixture,
} from "./_demo";
import { failWith, matchesSearch, ok } from "./_shared";

export interface ListBuildingsParams {
  clientId?: string;
  regiao?: string;
  /** Busca por nome, bairro ou cliente. */
  search?: string;
}

const CLIENT_EMBED = "client:clients(id,razao_social,nome_fantasia,segmento)";

/** Prédios com o cliente embutido (lista/roteirização). */
export async function listBuildings(
  params: ListBuildingsParams = {},
): Promise<Result<BuildingWithClient[]>> {
  try {
    if (isDemoMode) {
      let items = buildingsFixture.map((b) => demoBuildingWithClient(b.id));
      if (params.clientId) items = items.filter((b) => b.client_id === params.clientId);
      if (params.regiao) items = items.filter((b) => b.regiao === params.regiao);
      const term = params.search;
      if (term) {
        items = items.filter((b) =>
          matchesSearch(term, b.nome, b.bairro, b.client.razao_social, b.client.nome_fantasia),
        );
      }
      items.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return ok(items);
    }

    const supabase = await createSupabase();
    let query = supabase
      .from("buildings")
      .select(`*, ${CLIENT_EMBED}`)
      .order("nome", { ascending: true });
    if (params.clientId) query = query.eq("client_id", params.clientId);
    if (params.regiao) query = query.eq("regiao", params.regiao);
    if (params.search) query = query.ilike("nome", `%${params.search.trim()}%`);

    const { data, error } = await query;
    if (error) {
      return failWith("listBuildings", error, "Não foi possível carregar os prédios. Tente novamente.");
    }
    return ok((data ?? []) as BuildingWithClient[]);
  } catch (error) {
    return failWith("listBuildings", error, "Não foi possível carregar os prédios. Tente novamente.");
  }
}

/** Prédio por id com cliente e equipamentos. */
export async function getBuilding(
  id: string,
): Promise<Result<(BuildingWithEquipment & { client: Client }) | null>> {
  try {
    if (isDemoMode) {
      const building = buildingsFixture.find((b) => b.id === id);
      if (!building) return ok(null);
      const client = clientsFixture.find((c) => c.id === building.client_id);
      if (!client) return ok(null);
      return ok({
        ...building,
        client,
        equipment: equipmentFixture.filter((e) => e.building_id === id),
      });
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("buildings")
      .select("*, client:clients(*), equipment(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return failWith("getBuilding", error, "Não foi possível carregar o prédio. Tente novamente.");
    }
    return ok((data ?? null) as (BuildingWithEquipment & { client: Client }) | null);
  } catch (error) {
    return failWith("getBuilding", error, "Não foi possível carregar o prédio. Tente novamente.");
  }
}
