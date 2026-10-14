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
import { collectPaged, sumBy, type ContratosResumo } from "@/lib/asaas/kpis";
import { clientsFixture } from "@/lib/fixtures";
import { failWith, ok, pageRange, paginate, toPaginated } from "./_shared";

export type { ContratosResumo };

/** Cliente selecionável no formulário de contrato. */
export interface ContractClientOption {
  id: string;
  label: string;
}

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

const RESUMO_ERROR = "Não foi possível carregar o resumo dos contratos. Tente novamente.";

/**
 * Totais da aba Contratos sem o teto de uma página: count(head) para as
 * quantidades e soma paginada (collectPaged) para o MRR.
 */
export async function getContratosResumo(): Promise<Result<ContratosResumo>> {
  try {
    if (isDemoMode) {
      const ativos = contractsFixture.filter((c) => c.status === "ativo");
      return ok({
        total: contractsFixture.length,
        ativos: ativos.length,
        mrr: sumBy(ativos, (c) => c.valor_mensal, (c) => c.tipo === "pmoc_recorrente"),
      });
    }

    const supabase = await createSupabase();
    const [totalRes, ativosRes, recorrentes] = await Promise.all([
      supabase.from("contracts").select("id", { count: "exact", head: true }),
      supabase.from("contracts").select("id", { count: "exact", head: true }).eq("status", "ativo"),
      collectPaged<{ valor_mensal: number }>((from, to) =>
        supabase
          .from("contracts")
          .select("valor_mensal")
          .eq("status", "ativo")
          .eq("tipo", "pmoc_recorrente")
          .order("id")
          .range(from, to),
      ),
    ]);
    if (totalRes.error) return failWith("getContratosResumo total", totalRes.error, RESUMO_ERROR);
    if (ativosRes.error) return failWith("getContratosResumo ativos", ativosRes.error, RESUMO_ERROR);
    return ok({
      total: totalRes.count ?? 0,
      ativos: ativosRes.count ?? 0,
      mrr: sumBy(recorrentes, (c) => c.valor_mensal),
    });
  } catch (error) {
    return failWith("getContratosResumo", error, RESUMO_ERROR);
  }
}

/** Clientes ativos para o select do formulário de contrato (todas as páginas). */
export async function listContractClientOptions(): Promise<Result<ContractClientOption[]>> {
  const label = (c: { razao_social: string; nome_fantasia: string | null }) =>
    c.nome_fantasia && c.nome_fantasia !== c.razao_social
      ? `${c.nome_fantasia} — ${c.razao_social}`
      : c.razao_social;
  try {
    if (isDemoMode) {
      return ok(
        clientsFixture
          .filter((c) => c.ativo)
          .map((c) => ({ id: c.id, label: label(c) }))
          .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
      );
    }
    const supabase = await createSupabase();
    const rows = await collectPaged<{ id: string; razao_social: string; nome_fantasia: string | null }>(
      (from, to) =>
        supabase
          .from("clients")
          .select("id, razao_social, nome_fantasia")
          .eq("ativo", true)
          .order("razao_social")
          .range(from, to),
    );
    return ok(rows.map((c) => ({ id: c.id, label: label(c) })));
  } catch (error) {
    return failWith("listContractClientOptions", error, "Não foi possível carregar os clientes. Tente novamente.");
  }
}
