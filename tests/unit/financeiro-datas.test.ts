import { describe, expect, it } from "vitest";

import { contractsToBill, fimDoMes } from "../../src/lib/asaas/billing";
import {
  addDaysISO,
  competenciaBRT,
  dueDateForCharge,
  isCompetencia,
  paidAtFromAsaasDate,
  todayBRT,
  vencimentoFor,
} from "../../src/lib/asaas/dates";
import { DEFAULT_ALIQUOTA_ISS, fiscalFromClient } from "../../src/lib/asaas/fiscal";
import { isLock, isStaleLock, LOCK_TTL_MS, newLock } from "../../src/lib/asaas/lock";

describe("datas em BRT", () => {
  it("hoje em BRT difere do UTC à noite", () => {
    // 2026-10-15 01:30 UTC = 2026-10-14 22:30 em Curitiba
    const noite = new Date("2026-10-15T01:30:00Z");
    expect(noite.toISOString().slice(0, 10)).toBe("2026-10-15");
    expect(todayBRT(noite)).toBe("2026-10-14");
  });

  it("competência do mês corrente/anteriores em BRT, virando o ano", () => {
    const viradaUtc = new Date("2026-11-01T02:00:00Z"); // 31/out 23h BRT
    expect(competenciaBRT(0, viradaUtc)).toBe("2026-10-01");
    const jan = new Date("2027-01-10T12:00:00Z");
    expect(competenciaBRT(0, jan)).toBe("2027-01-01");
    expect(competenciaBRT(1, jan)).toBe("2026-12-01");
    expect(competenciaBRT(13, jan)).toBe("2025-12-01");
  });

  it("vencimento = competência + (dia - 1), dia limitado a 1..28", () => {
    expect(vencimentoFor("2026-10-01", 10)).toBe("2026-10-10");
    expect(vencimentoFor("2026-02-01", 28)).toBe("2026-02-28");
    expect(vencimentoFor("2026-02-01", 31)).toBe("2026-02-28");
    expect(vencimentoFor("2026-10-01", 0)).toBe("2026-10-01");
    expect(vencimentoFor("2026-10-17", 5)).toBe("2026-10-05");
  });

  it("cobrança vencida vai ao Asaas com vencimento hoje (BRT)", () => {
    const now = new Date("2026-10-15T01:30:00Z"); // 14/out BRT
    expect(dueDateForCharge("2026-10-05", now)).toBe("2026-10-14");
    expect(dueDateForCharge("2026-10-20", now)).toBe("2026-10-20");
    expect(dueDateForCharge(null, now)).toBe("2026-10-14");
  });

  it("paid_at ao meio-dia BRT", () => {
    expect(paidAtFromAsaasDate("2026-10-14")).toBe("2026-10-14T15:00:00.000Z");
    const now = new Date("2026-10-14T10:00:00Z");
    expect(paidAtFromAsaasDate(null, now)).toBe(now.toISOString());
    expect(paidAtFromAsaasDate("lixo", now)).toBe(now.toISOString());
  });

  it("utilitários", () => {
    expect(isCompetencia("2026-10-01")).toBe(true);
    expect(isCompetencia("2026-10-02")).toBe(false);
    expect(isCompetencia("2026-13-01")).toBe(false);
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(fimDoMes("2028-02-01")).toBe("2028-02-29");
  });
});

describe("faturamento mensal (espelho do job do banco)", () => {
  const contratos = [
    { id: "a", status: "ativo", tipo: "pmoc_recorrente", inicio: "2026-01-10", fim: null },
    { id: "b", status: "ativo", tipo: "corretiva_avulsa", inicio: "2026-01-01", fim: null },
    { id: "c", status: "suspenso", tipo: "pmoc_recorrente", inicio: "2026-01-01", fim: null },
    { id: "d", status: "ativo", tipo: "instalacao", inicio: "2026-10-31", fim: "2026-12-31" },
    { id: "e", status: "ativo", tipo: "pmoc_recorrente", inicio: "2026-11-01", fim: null },
    { id: "f", status: "ativo", tipo: "pmoc_recorrente", inicio: "2025-01-01", fim: "2026-09-30" },
  ];
  it("só ativos, não avulsos, vigentes no mês e ainda sem fatura", () => {
    const ids = contractsToBill(contratos, [], "2026-10-01").map((c) => c.id);
    expect(ids).toEqual(["a", "d"]);
    const jaTem = contractsToBill(contratos, [{ contract_id: "a", competencia: "2026-10-01" }], "2026-10-01");
    expect(jaTem.map((c) => c.id)).toEqual(["d"]);
  });
});

describe("dados fiscais da NFS-e", () => {
  it("usa alíquota/retenção/código do cliente", () => {
    expect(fiscalFromClient({ aliquota_iss: 2.5, reter_iss: true, codigo_servico_municipal: " 07.02 " })).toEqual({
      iss: 2.5,
      retainIss: true,
      municipalServiceCode: "07.02",
    });
  });
  it("fallback de 5% e sem retenção", () => {
    expect(fiscalFromClient({})).toEqual({ iss: DEFAULT_ALIQUOTA_ISS, retainIss: false, municipalServiceCode: null });
    expect(fiscalFromClient(null).iss).toBe(5);
    expect(fiscalFromClient({ aliquota_iss: "3" }).iss).toBe(3);
    expect(fiscalFromClient({ aliquota_iss: 150 }).iss).toBe(5);
  });
});

describe("lock lógico contra duplicidade", () => {
  it("marcadores únicos e expiração", () => {
    const now = 1_760_000_000_000;
    const a = newLock(now);
    const b = newLock(now);
    expect(a).not.toBe(b);
    expect(isLock(a)).toBe(true);
    expect(isLock("pay_123")).toBe(false);
    expect(isStaleLock(a, now + 1000)).toBe(false);
    expect(isStaleLock(a, now + LOCK_TTL_MS + 1)).toBe(true);
    expect(isStaleLock("pay_123", now)).toBe(false);
  });
});
