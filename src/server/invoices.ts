import { isDemoMode } from "@/lib/env";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type {
  InvoiceStatus,
  InvoiceWithContract,
  PageParams,
  Paginated,
  Result,
} from "@/lib/types";
import { contractsFixture, demoClient, invoicesFixture } from "./_demo";
import {
  failWith,
  matchesSearch,
  monthStartDate,
  ok,
  pageRange,
  paginate,
  sanitizeIlike,
  toPaginated,
} from "./_shared";

export interface ListInvoicesParams extends PageParams {
  /** Busca por cliente (razão social / nome fantasia) ou nº da NFS-e. */
  search?: string;
  status?: InvoiceStatus;
  /** Competência exata, "YYYY-MM-01". */
  competencia?: string;
  contractId?: string;
}

const CONTRACT_EMBED =
  "contract:contracts!inner(id,tipo,valor_mensal,dia_vencimento, client:clients!inner(id,razao_social,nome_fantasia))";

function demoInvoiceWithContract(invoiceId: string): InvoiceWithContract {
  const invoice = invoicesFixture.find((i) => i.id === invoiceId);
  if (!invoice) throw new Error(`Fixture inconsistente: fatura ${invoiceId} não existe`);
  const contract = contractsFixture.find((c) => c.id === invoice.contract_id);
  if (!contract) {
    throw new Error(`Fixture inconsistente: contrato ${invoice.contract_id} não existe`);
  }
  const client = demoClient(contract.client_id);
  if (!client) throw new Error(`Fixture inconsistente: cliente ${contract.client_id} não existe`);
  return {
    ...invoice,
    contract: {
      id: contract.id,
      tipo: contract.tipo,
      valor_mensal: contract.valor_mensal,
      dia_vencimento: contract.dia_vencimento,
      client: {
        id: client.id,
        razao_social: client.razao_social,
        nome_fantasia: client.nome_fantasia,
      },
    },
  };
}

/**
 * Lista paginada de faturas com contrato + cliente, competências mais
 * recentes primeiro. No modo Supabase a busca aplica sobre a razão social
 * do cliente e o nº da NFS-e.
 */
export async function listInvoices(
  params: ListInvoicesParams = {},
): Promise<Result<Paginated<InvoiceWithContract>>> {
  try {
    if (isDemoMode) {
      let items = invoicesFixture.map((i) => demoInvoiceWithContract(i.id));
      if (params.status) items = items.filter((i) => i.status === params.status);
      if (params.competencia) items = items.filter((i) => i.competencia === params.competencia);
      if (params.contractId) items = items.filter((i) => i.contract_id === params.contractId);
      const term = params.search;
      if (term) {
        items = items.filter((i) =>
          matchesSearch(
            term,
            i.contract.client.razao_social,
            i.contract.client.nome_fantasia,
            i.nf_numero,
          ),
        );
      }
      items.sort(
        (a, b) =>
          b.competencia.localeCompare(a.competencia) ||
          a.contract.client.razao_social.localeCompare(b.contract.client.razao_social, "pt-BR"),
      );
      return ok(paginate(items, params));
    }

    const supabase = await createSupabase();
    const { from, to } = pageRange(params);
    let query = supabase
      .from("invoices")
      .select(`*, ${CONTRACT_EMBED}`, { count: "exact" })
      .order("competencia", { ascending: false })
      .range(from, to);
    if (params.status) query = query.eq("status", params.status);
    if (params.competencia) query = query.eq("competencia", params.competencia);
    if (params.contractId) query = query.eq("contract_id", params.contractId);
    const q = params.search ? sanitizeIlike(params.search) : "";
    if (q) {
      query = q.toUpperCase().startsWith("NFS")
        ? query.ilike("nf_numero", `%${q}%`)
        : query.ilike("contract.client.razao_social", `%${q}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      return failWith("listInvoices", error, "Não foi possível carregar as faturas. Tente novamente.");
    }
    return ok(toPaginated((data ?? []) as InvoiceWithContract[], count, params));
  } catch (error) {
    return failWith("listInvoices", error, "Não foi possível carregar as faturas. Tente novamente.");
  }
}

/** Fatura por id com contrato e cliente. */
export async function getInvoice(
  id: string,
): Promise<Result<InvoiceWithContract | null>> {
  try {
    if (isDemoMode) {
      const invoice = invoicesFixture.find((i) => i.id === id);
      return ok(invoice ? demoInvoiceWithContract(id) : null);
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("invoices")
      .select(`*, ${CONTRACT_EMBED}`)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return failWith("getInvoice", error, "Não foi possível carregar a fatura. Tente novamente.");
    }
    return ok((data ?? null) as InvoiceWithContract | null);
  } catch (error) {
    return failWith("getInvoice", error, "Não foi possível carregar a fatura. Tente novamente.");
  }
}

// ----------------------------------------------------------------------------
// KPIs do módulo Financeiro
// ----------------------------------------------------------------------------

/** Agregados dos 4 cards do topo de /financeiro. */
export interface FinanceiroKpis {
  /** Soma das faturas não canceladas com competência no mês corrente. */
  faturamento_previsto_mes: number;
  /** Valor em atraso ÷ valor faturado não cancelado (12 meses), em % 0-100. */
  inadimplencia_pct: number | null;
  /** Soma das faturas com status "atrasado" (janela de 12 meses). */
  valor_em_atraso: number;
  /** Faturas com NFS-e emitida (nf_numero) na competência do mês corrente. */
  notas_emitidas_mes: number;
  /** Recebido conciliado (pago com método pix/boleto) ÷ previsto do mês, %. */
  recebido_conciliado_pct: number | null;
  recebido_pix_mes: number;
  recebido_boleto_mes: number;
}

interface KpiInvoiceRow {
  competencia: string;
  valor: number;
  status: InvoiceStatus;
  metodo: "pix" | "boleto" | null;
  nf_numero: string | null;
}

function buildFinanceiroKpis(rows: KpiInvoiceRow[]): FinanceiroKpis {
  const mesAtual = monthStartDate(0);
  let previstoMes = 0;
  let faturadoJanela = 0;
  let emAtraso = 0;
  let notasMes = 0;
  let recebidoPix = 0;
  let recebidoBoleto = 0;

  for (const i of rows) {
    if (i.status !== "cancelado") faturadoJanela += i.valor;
    if (i.status === "atrasado") emAtraso += i.valor;
    if (i.competencia !== mesAtual) continue;
    if (i.status !== "cancelado") previstoMes += i.valor;
    if (i.nf_numero) notasMes += 1;
    if (i.status === "pago" && i.metodo === "pix") recebidoPix += i.valor;
    if (i.status === "pago" && i.metodo === "boleto") recebidoBoleto += i.valor;
  }

  const recebidoConciliado = recebidoPix + recebidoBoleto;
  const pct = (numerador: number, denominador: number) =>
    denominador === 0 ? null : Math.round((numerador / denominador) * 1000) / 10;

  return {
    faturamento_previsto_mes: previstoMes,
    inadimplencia_pct: pct(emAtraso, faturadoJanela),
    valor_em_atraso: emAtraso,
    notas_emitidas_mes: notasMes,
    recebido_conciliado_pct: pct(recebidoConciliado, previstoMes),
    recebido_pix_mes: recebidoPix,
    recebido_boleto_mes: recebidoBoleto,
  };
}

/** KPIs do topo do Financeiro (janela: competências dos últimos 12 meses). */
export async function getFinanceiroKpis(): Promise<Result<FinanceiroKpis>> {
  try {
    const desde = monthStartDate(11);

    if (isDemoMode) {
      return ok(
        buildFinanceiroKpis(
          invoicesFixture.filter((i) => i.competencia >= desde),
        ),
      );
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("invoices")
      .select("competencia, valor, status, metodo, nf_numero")
      .gte("competencia", desde);
    if (error) {
      return failWith("getFinanceiroKpis", error, "Não foi possível carregar os indicadores financeiros. Tente novamente.");
    }
    return ok(buildFinanceiroKpis((data ?? []) as KpiInvoiceRow[]));
  } catch (error) {
    return failWith("getFinanceiroKpis", error, "Não foi possível carregar os indicadores financeiros. Tente novamente.");
  }
}
