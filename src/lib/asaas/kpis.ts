/**
 * KPIs do Financeiro — cálculo puro sobre agregados (sem linhas cruas).
 * No Supabase os agregados vêm de public.vw_dashboard_faturamento (soma por
 * competência, janela = mês atual + 6 anteriores), de count(head) e de somas
 * paginadas sem teto silencioso (collectPaged). Testado em
 * tests/unit/financeiro-kpis.test.ts.
 */

export interface FaturamentoMesAgg {
  /** Competência "YYYY-MM-01". */
  mes: string;
  previsto: number;
  recebido: number;
  pendente: number;
  atrasado: number;
}

/** Agregados dos 4 cards do topo de /financeiro. */
export interface FinanceiroKpis {
  /** Soma das faturas não canceladas com competência no mês corrente (BRT). */
  faturamento_previsto_mes: number;
  /** Valor em atraso ÷ valor faturado não cancelado (janela de 7 competências), % 0-100. */
  inadimplencia_pct: number | null;
  /** Soma das faturas com status "atrasado" na janela. */
  valor_em_atraso: number;
  /** Faturas com NFS-e emitida (nf_numero) na competência do mês corrente. */
  notas_emitidas_mes: number;
  /** Recebido conciliado (pago com método pix/boleto) ÷ previsto do mês, %. */
  recebido_conciliado_pct: number | null;
  recebido_pix_mes: number;
  recebido_boleto_mes: number;
}

/** Resumo da aba Contratos. */
export interface ContratosResumo {
  total: number;
  ativos: number;
  /** Soma de valor_mensal dos PMOC recorrentes ativos. */
  mrr: number;
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Arredonda centavos (evita 0.1 + 0.2). */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export function pct(numerador: number, denominador: number): number | null {
  return denominador <= 0 ? null : Math.round((numerador / denominador) * 1000) / 10;
}

/** Mesma agregação da view vw_dashboard_faturamento (modo demo / testes). */
export function aggregateFaturamento(
  rows: Array<{ competencia: string; valor: number; status: string }>,
): FaturamentoMesAgg[] {
  const byMes = new Map<string, FaturamentoMesAgg>();
  for (const r of rows) {
    const agg =
      byMes.get(r.competencia) ??
      { mes: r.competencia, previsto: 0, recebido: 0, pendente: 0, atrasado: 0 };
    const v = num(r.valor);
    if (r.status !== "cancelado") agg.previsto += v;
    if (r.status === "pago") agg.recebido += v;
    if (r.status === "pendente") agg.pendente += v;
    if (r.status === "atrasado") agg.atrasado += v;
    byMes.set(r.competencia, agg);
  }
  return [...byMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

export function buildFinanceiroKpis(input: {
  meses: Array<Partial<FaturamentoMesAgg> & { mes: string }>;
  mesAtual: string;
  notasEmitidasMes: number;
  recebidoPixMes: number;
  recebidoBoletoMes: number;
}): FinanceiroKpis {
  let faturadoJanela = 0;
  let emAtraso = 0;
  let previstoMes = 0;
  for (const m of input.meses) {
    faturadoJanela += num(m.previsto);
    emAtraso += num(m.atrasado);
    if (String(m.mes).slice(0, 10) === input.mesAtual) previstoMes += num(m.previsto);
  }
  const pix = money(num(input.recebidoPixMes));
  const boleto = money(num(input.recebidoBoletoMes));
  return {
    faturamento_previsto_mes: money(previstoMes),
    inadimplencia_pct: pct(emAtraso, faturadoJanela),
    valor_em_atraso: money(emAtraso),
    notas_emitidas_mes: Math.max(0, Math.trunc(num(input.notasEmitidasMes))),
    recebido_conciliado_pct: pct(pix + boleto, previstoMes),
    recebido_pix_mes: pix,
    recebido_boleto_mes: boleto,
  };
}

export function sumBy<T>(rows: T[], pick: (row: T) => unknown, where: (row: T) => boolean = () => true): number {
  return money(rows.reduce((acc, r) => (where(r) ? acc + num(pick(r)) : acc), 0));
}

/**
 * Busca TODAS as páginas de uma consulta (PostgREST corta em max-rows sem
 * avisar). Lança se uma página falhar ou se passar de maxPages (defensivo).
 */
export async function collectPaged<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
  maxPages = 100,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const from = page * pageSize;
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) return all;
  }
  throw new Error(`collectPaged: mais de ${maxPages * pageSize} linhas`);
}
