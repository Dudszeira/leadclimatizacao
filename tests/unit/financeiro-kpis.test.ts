import { describe, expect, it } from "vitest";

import {
  aggregateFaturamento,
  buildFinanceiroKpis,
  collectPaged,
  sumBy,
} from "../../src/lib/asaas/kpis";

describe("KPIs financeiros", () => {
  const rows = [
    { competencia: "2026-09-01", valor: 1000, status: "pago" },
    { competencia: "2026-09-01", valor: 500, status: "atrasado" },
    { competencia: "2026-10-01", valor: 2000, status: "pendente" },
    { competencia: "2026-10-01", valor: 1000, status: "pago" },
    { competencia: "2026-10-01", valor: 700, status: "cancelado" },
  ];

  it("agrega como a view vw_dashboard_faturamento", () => {
    expect(aggregateFaturamento(rows)).toEqual([
      { mes: "2026-09-01", previsto: 1500, recebido: 1000, pendente: 0, atrasado: 500 },
      { mes: "2026-10-01", previsto: 3000, recebido: 1000, pendente: 2000, atrasado: 0 },
    ]);
  });

  it("calcula previsto, inadimplência e conciliação", () => {
    const kpis = buildFinanceiroKpis({
      meses: aggregateFaturamento(rows),
      mesAtual: "2026-10-01",
      notasEmitidasMes: 3,
      recebidoPixMes: 600,
      recebidoBoletoMes: 400,
    });
    expect(kpis).toEqual({
      faturamento_previsto_mes: 3000,
      inadimplencia_pct: 11.1, // 500 / 4500
      valor_em_atraso: 500,
      notas_emitidas_mes: 3,
      recebido_conciliado_pct: 33.3, // 1000 / 3000
      recebido_pix_mes: 600,
      recebido_boleto_mes: 400,
    });
  });

  it("aceita numeric como string (PostgREST) e sem dados devolve null nos %", () => {
    const kpis = buildFinanceiroKpis({
      meses: [{ mes: "2026-10-01", previsto: "100.10" as unknown as number, atrasado: "0" as unknown as number }],
      mesAtual: "2026-10-01",
      notasEmitidasMes: 0,
      recebidoPixMes: 0,
      recebidoBoletoMes: 0,
    });
    expect(kpis.faturamento_previsto_mes).toBe(100.1);
    const vazio = buildFinanceiroKpis({ meses: [], mesAtual: "2026-10-01", notasEmitidasMes: 0, recebidoPixMes: 0, recebidoBoletoMes: 0 });
    expect(vazio.inadimplencia_pct).toBeNull();
    expect(vazio.recebido_conciliado_pct).toBeNull();
  });

  it("sumBy arredonda centavos", () => {
    expect(sumBy([{ v: 0.1 }, { v: 0.2 }], (r) => r.v)).toBe(0.3);
  });
});

describe("collectPaged — sem o teto silencioso de linhas", () => {
  it("percorre todas as páginas até uma incompleta", async () => {
    const total = 2350;
    const ranges: Array<[number, number]> = [];
    const all = await collectPaged<number>(async (from, to) => {
      ranges.push([from, to]);
      const data = Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i);
      return { data, error: null };
    }, 1000);
    expect(all).toHaveLength(total);
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("propaga erro de página", async () => {
    await expect(collectPaged(async () => ({ data: null, error: new Error("boom") }))).rejects.toThrow("boom");
  });
});
