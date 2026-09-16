import { isDemoMode } from "@/lib/env";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type {
  ContractStatus,
  ContractType,
  ContractWithClient,
  ContractWithRelations,
  PageParams,
  Paginated,
  Result,
} from "@/lib/types";
import { contractsFixture, demoClient, invoicesFixture } from "./_demo";
import { failWith, ok, pageRange, paginate, toPaginated } from "./_shared";

export interface ListContractsParams extends PageParams {
  clientId?: string;
  status?: ContractStatus;
  tipo?: ContractType;
}

const CLIENT_EMBED = "client:clients(id,razao_social,nome_fantasia,cnpj)";

function demoContractWithClient(contractId: string): ContractWithClient {
  const contract = contractsFixture.find((c) => c.id === contractId);
  if (!contract) throw new Error(`Fixture inconsistente: contrato ${contractId} não existe`);
  const client = demoClient(contract.client_id);
  if (!client) throw new Error(`Fixture inconsistente: cliente ${contract.client_id} não existe`);
  return {
    ...contract,
    client: {
      id: client.id,
      razao_social: client.razao_social,
      nome_fantasia: client.nome_fantasia,
      cnpj: client.cnpj,
    },
  };
}

/** Lista paginada de contratos com o cliente, maiores valores primeiro. */
export async function listContracts(
  params: ListContractsParams = {},
): Promise<Result<Paginated<ContractWithClient>>> {
  try {
    if (isDemoMode) {
      let items = contractsFixture.map((c) => demoContractWithClient(c.id));
      if (params.clientId) items = items.filter((c) => c.client_id === params.clientId);
      if (params.status) items = items.filter((c) => c.status === params.status);
      if (params.tipo) items = items.filter((c) => c.tipo === params.tipo);
      items.sort((a, b) => b.valor_mensal - a.valor_mensal);
      return ok(paginate(items, params));
    }

    const supabase = await createSupabase();
    const { from, to } = pageRange(params);
    let query = supabase
      .from("contracts")
      .select(`*, ${CLIENT_EMBED}`, { count: "exact" })
      .order("valor_mensal", { ascending: false })
      .range(from, to);
    if (params.clientId) query = query.eq("client_id", params.clientId);
    if (params.status) query = query.eq("status", params.status);
    if (params.tipo) query = query.eq("tipo", params.tipo);

    const { data, error, count } = await query;
    if (error) {
      return failWith("listContracts", error, "Não foi possível carregar os contratos. Tente novamente.");
    }
    return ok(toPaginated((data ?? []) as ContractWithClient[], count, params));
  } catch (error) {
    return failWith("listContracts", error, "Não foi possível carregar os contratos. Tente novamente.");
  }
}

/** Contrato por id com cliente e faturas (competências mais recentes primeiro). */
export async function getContract(
  id: string,
): Promise<Result<ContractWithRelations | null>> {
  try {
    if (isDemoMode) {
      const contract = contractsFixture.find((c) => c.id === id);
      if (!contract) return ok(null);
      const invoices = invoicesFixture
        .filter((i) => i.contract_id === id)
        .sort((a, b) => b.competencia.localeCompare(a.competencia));
      return ok({ ...demoContractWithClient(id), invoices });
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("contracts")
      .select(`*, ${CLIENT_EMBED}, invoices(*)`)
      .eq("id", id)
      .order("competencia", { referencedTable: "invoices", ascending: false })
      .maybeSingle();
    if (error) {
      return failWith("getContract", error, "Não foi possível carregar o contrato. Tente novamente.");
    }
    return ok((data ?? null) as ContractWithRelations | null);
  } catch (error) {
    return failWith("getContract", error, "Não foi possível carregar o contrato. Tente novamente.");
  }
}
