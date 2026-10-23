import { isDemoMode } from "@/lib/env";
import { collectPaged } from "@/lib/asaas/kpis";
import { buildingsFixture, catalogFixture, clientsFixture, quoteItemsFixture, quotesFixture } from "@/lib/fixtures";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type {
  Building,
  CatalogItem,
  Client,
  PageParams,
  Paginated,
  Quote,
  QuoteClientOption,
  QuoteItem,
  QuoteStatus,
  QuoteSummary,
  QuoteWithClient,
  QuoteWithItems,
  Result,
} from "@/lib/types";
import {
  addDaysToDateKey,
  failWith,
  matchesSearch,
  ok,
  pageRange,
  paginate,
  sanitizeIlike,
  startOfDayBRTISO,
  toPaginated,
} from "./_shared";

/**
 * Leituras do módulo de Orçamentos (0010). Admin, atendente e técnico leem
 * tudo. Cliente/prédio vêm da view vw_quotes (o técnico não lê clients pela
 * RLS); OS e fatura geradas na aprovação ficam só como ids.
 */

export interface ListQuotesParams extends PageParams {
  status?: QuoteStatus;
  clientId?: string;
  /** Busca por título, cliente (razão social / fantasia) ou número ("ORC-1004" / "1004"). */
  q?: string;
  /** Criados a partir deste dia (BRT), "YYYY-MM-DD". */
  inicio?: string;
  /** Criados até este dia inclusive (BRT), "YYYY-MM-DD". */
  fim?: string;
}

const QUOTE_COLUMNS = [
  "id", "numero", "client_id", "building_id", "tipo_servico", "titulo", "observacoes", "validade",
  "condicoes_pagamento", "prazo_execucao", "garantia", "desconto", "subtotal", "total", "status",
  "motivo_declinio", "decidido_em", "service_order_id", "invoice_id", "created_by", "created_at", "updated_at",
] as const;

/** Linha plana de public.vw_quotes. */
type QuoteViewRow = Quote & {
  client_razao_social: string;
  client_nome_fantasia: string | null;
  client_cnpj: string | null;
  client_contato_nome: string | null;
  client_contato_email: string | null;
  client_contato_telefone: string | null;
  building_nome: string;
  building_logradouro: string | null;
  building_numero: string | null;
  building_bairro: string | null;
  building_cidade: string;
  building_uf: string;
  building_cep: string | null;
};

function toQuote(row: Quote): Quote {
  const q = Object.fromEntries(QUOTE_COLUMNS.map((k) => [k, row[k]])) as unknown as Quote;
  return {
    ...q,
    numero: Number(row.numero),
    desconto: Number(row.desconto),
    subtotal: Number(row.subtotal),
    total: Number(row.total),
  };
}

function fromViewRow(row: QuoteViewRow): QuoteWithClient {
  return {
    ...toQuote(row),
    client: {
      id: row.client_id,
      razao_social: row.client_razao_social,
      nome_fantasia: row.client_nome_fantasia,
      cnpj: row.client_cnpj,
      contato_nome: row.client_contato_nome,
      contato_email: row.client_contato_email,
      contato_telefone: row.client_contato_telefone,
    },
    building: {
      id: row.building_id,
      nome: row.building_nome,
      logradouro: row.building_logradouro,
      numero: row.building_numero,
      bairro: row.building_bairro,
      cidade: row.building_cidade,
      uf: row.building_uf,
      cep: row.building_cep,
    },
  };
}

function toItem(row: QuoteItem): QuoteItem {
  return {
    ...row,
    quantidade: Number(row.quantidade),
    preco_unitario: Number(row.preco_unitario),
    valor: Number(row.valor),
  };
}

function toCatalog(row: CatalogItem): CatalogItem {
  return { ...row, preco: Number(row.preco) };
}

// ----------------------------------------------------------------------------
// Demo
// ----------------------------------------------------------------------------

function demoQuoteWithClient(q: Quote): QuoteWithClient {
  const c = clientsFixture.find((x) => x.id === q.client_id) as Client | undefined;
  const b = buildingsFixture.find((x) => x.id === q.building_id) as Building | undefined;
  if (!c || !b) throw new Error(`Fixture inconsistente: orçamento ${q.id} sem cliente/prédio`);
  return {
    ...q,
    client: {
      id: c.id,
      razao_social: c.razao_social,
      nome_fantasia: c.nome_fantasia,
      cnpj: c.cnpj,
      contato_nome: c.contato_nome,
      contato_email: c.contato_email,
      contato_telefone: c.contato_telefone,
    },
    building: {
      id: b.id,
      nome: b.nome,
      logradouro: b.logradouro,
      numero: b.numero,
      bairro: b.bairro,
      cidade: b.cidade,
      uf: b.uf,
      cep: b.cep,
    },
  };
}

/** Limites ISO [desde, até) do período em BRT. */
function periodBounds(inicio?: string, fim?: string): { desde?: string; ate?: string } {
  return {
    desde: inicio ? startOfDayBRTISO(inicio) : undefined,
    ate: fim ? startOfDayBRTISO(addDaysToDateKey(fim, 1)) : undefined,
  };
}

/** "ORC-1004" / "orc 1004" / "1004" → 1004. */
function numeroFromSearch(term: string): number | null {
  const m = term.trim().match(/^(?:orc[-\s]?)?(\d{1,12})$/i);
  return m ? Number(m[1]) : null;
}

// ----------------------------------------------------------------------------
// Leituras
// ----------------------------------------------------------------------------

const LIST_ERROR = "Não foi possível carregar os orçamentos. Tente novamente.";

/** Lista paginada, mais recentes primeiro. */
export async function listQuotes(
  params: ListQuotesParams = {},
): Promise<Result<Paginated<QuoteWithClient>>> {
  try {
    const { desde, ate } = periodBounds(params.inicio, params.fim);

    if (isDemoMode) {
      let items = quotesFixture.map(demoQuoteWithClient);
      if (params.status) items = items.filter((q) => q.status === params.status);
      if (params.clientId) items = items.filter((q) => q.client_id === params.clientId);
      if (desde) items = items.filter((q) => q.created_at >= desde);
      if (ate) items = items.filter((q) => q.created_at < ate);
      const term = params.q?.trim();
      if (term) {
        const n = numeroFromSearch(term);
        items = items.filter((q) =>
          n !== null
            ? q.numero === n
            : matchesSearch(term, q.titulo, q.client.razao_social, q.client.nome_fantasia),
        );
      }
      items.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return ok(paginate(items, params));
    }

    const supabase = await createSupabase();
    const { from, to } = pageRange(params);
    let query = supabase
      .from("vw_quotes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (params.status) query = query.eq("status", params.status);
    if (params.clientId) query = query.eq("client_id", params.clientId);
    if (desde) query = query.gte("created_at", desde);
    if (ate) query = query.lt("created_at", ate);
    const raw = params.q?.trim() ?? "";
    if (raw) {
      const n = numeroFromSearch(raw);
      if (n !== null) {
        query = query.eq("numero", n);
      } else {
        const q = sanitizeIlike(raw);
        if (q) {
          query = query.or(
            `titulo.ilike.%${q}%,client_razao_social.ilike.%${q}%,client_nome_fantasia.ilike.%${q}%`,
          );
        }
      }
    }

    const { data, error, count } = await query;
    if (error) return failWith("listQuotes", error, LIST_ERROR);
    return ok(toPaginated(((data ?? []) as QuoteViewRow[]).map(fromViewRow), count, params));
  } catch (error) {
    return failWith("listQuotes", error, LIST_ERROR);
  }
}

const GET_ERROR = "Não foi possível carregar o orçamento. Tente novamente.";

/** Orçamento com cliente, prédio e itens (ordem). data null = não encontrado. */
export async function getQuote(id: string): Promise<Result<QuoteWithItems | null>> {
  try {
    if (isDemoMode) {
      const q = quotesFixture.find((x) => x.id === id);
      if (!q) return ok(null);
      const items = quoteItemsFixture
        .filter((i) => i.quote_id === id)
        .sort((a, b) => a.ordem - b.ordem);
      return ok({ ...demoQuoteWithClient(q), items });
    }

    const supabase = await createSupabase();
    const [quoteRes, itemsRes] = await Promise.all([
      supabase.from("vw_quotes").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("quote_items")
        .select("*")
        .eq("quote_id", id)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);
    if (quoteRes.error) return failWith("getQuote", quoteRes.error, GET_ERROR);
    if (itemsRes.error) return failWith("getQuote items", itemsRes.error, GET_ERROR);
    if (!quoteRes.data) return ok(null);
    return ok({
      ...fromViewRow(quoteRes.data as QuoteViewRow),
      items: ((itemsRes.data ?? []) as QuoteItem[]).map(toItem),
    });
  } catch (error) {
    return failWith("getQuote", error, GET_ERROR);
  }
}

const SUMMARY_ERROR = "Não foi possível carregar os indicadores de orçamentos. Tente novamente.";

const EMPTY_SUMMARY: QuoteSummary = {
  qtd_emitidos: 0,
  valor_emitido: 0,
  qtd_aprovados: 0,
  valor_aprovado: 0,
  qtd_aguardando: 0,
  valor_aguardando: 0,
  qtd_declinados: 0,
  valor_declinado: 0,
};

/** Indicadores dos orçamentos criados no período (BRT, datas inclusivas; omitidas = sem limite). */
export async function getQuotesSummary(inicio?: string, fim?: string): Promise<Result<QuoteSummary>> {
  try {
    if (isDemoMode) {
      const { desde, ate } = periodBounds(inicio, fim);
      const rows = quotesFixture.filter(
        (q) => (!desde || q.created_at >= desde) && (!ate || q.created_at < ate),
      );
      const sum = (s?: QuoteStatus) =>
        Math.round(rows.filter((q) => !s || q.status === s).reduce((t, q) => t + q.total, 0) * 100) / 100;
      const qtd = (s: QuoteStatus) => rows.filter((q) => q.status === s).length;
      return ok({
        qtd_emitidos: rows.length,
        valor_emitido: sum(),
        qtd_aprovados: qtd("aprovado"),
        valor_aprovado: sum("aprovado"),
        qtd_aguardando: qtd("aguardando"),
        valor_aguardando: sum("aguardando"),
        qtd_declinados: qtd("declinado"),
        valor_declinado: sum("declinado"),
      });
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase.rpc("orcamentos_resumo", {
      p_inicio: inicio ?? null,
      p_fim: fim ?? null,
    });
    if (error) return failWith("getQuotesSummary", error, SUMMARY_ERROR);
    const row = (Array.isArray(data) ? data[0] : data) as Record<keyof QuoteSummary, unknown> | undefined;
    if (!row) return ok(EMPTY_SUMMARY);
    const out = { ...EMPTY_SUMMARY };
    for (const k of Object.keys(out) as Array<keyof QuoteSummary>) out[k] = Number(row[k] ?? 0);
    return ok(out);
  } catch (error) {
    return failWith("getQuotesSummary", error, SUMMARY_ERROR);
  }
}

const CATALOG_ERROR = "Não foi possível carregar o catálogo. Tente novamente.";

/** Catálogo ordenado por nome; por padrão só itens ativos. */
export async function listCatalog(
  opts: { incluirInativos?: boolean } = {},
): Promise<Result<CatalogItem[]>> {
  try {
    if (isDemoMode) {
      return ok(
        catalogFixture
          .filter((c) => opts.incluirInativos || c.ativo)
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      );
    }
    const supabase = await createSupabase();
    const rows = await collectPaged<CatalogItem>((from, to) => {
      let q = supabase.from("service_catalog").select("*").order("nome").order("id").range(from, to);
      if (!opts.incluirInativos) q = q.eq("ativo", true);
      return q;
    });
    return ok(rows.map(toCatalog));
  } catch (error) {
    return failWith("listCatalog", error, CATALOG_ERROR);
  }
}

const OPTIONS_ERROR = "Não foi possível carregar os clientes. Tente novamente.";

/**
 * Clientes ativos × prédios para o formulário (os 3 papéis; o técnico não lê
 * clients pela RLS, por isso vem da RPC orcamento_opcoes_clientes).
 */
export async function listQuoteClientOptions(): Promise<Result<QuoteClientOption[]>> {
  try {
    if (isDemoMode) {
      const out: QuoteClientOption[] = [];
      for (const c of clientsFixture.filter((x) => x.ativo)) {
        for (const b of buildingsFixture.filter((x) => x.client_id === c.id)) {
          out.push({
            client_id: c.id,
            razao_social: c.razao_social,
            nome_fantasia: c.nome_fantasia,
            building_id: b.id,
            building_nome: b.nome,
            bairro: b.bairro,
            cidade: b.cidade,
          });
        }
      }
      out.sort(
        (a, b) =>
          a.razao_social.localeCompare(b.razao_social, "pt-BR") ||
          a.building_nome.localeCompare(b.building_nome, "pt-BR"),
      );
      return ok(out);
    }
    const supabase = await createSupabase();
    const rows = await collectPaged<QuoteClientOption>((from, to) =>
      supabase.rpc("orcamento_opcoes_clientes").range(from, to),
    );
    return ok(rows);
  } catch (error) {
    return failWith("listQuoteClientOptions", error, OPTIONS_ERROR);
  }
}
