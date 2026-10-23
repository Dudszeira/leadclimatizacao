import { describe, expect, it } from "vitest";

import { ASAAS_DESCRIPTION_MAX, chargeDescription } from "@/lib/asaas/service";

const plano = { competencia: "2026-09-01", contract: { quote_id: null, quote: null } };

describe("descrição da cobrança no Asaas", () => {
  it("contrato de plano mantém a descrição da manutenção por competência", () => {
    expect(chargeDescription(plano)).toMatch(/^Manutenção de climatização — competência set/);
  });

  it("contrato gerado por orçamento usa número e título", () => {
    const d = chargeDescription({
      competencia: "2026-09-01",
      contract: {
        quote_id: "d1000000-0000-4000-8000-000000000001",
        quote: { numero: 1004, titulo: "  Visita e diagnóstico — câmara de frios " },
      },
    });
    expect(d).toBe("Orçamento ORC-1004: Visita e diagnóstico — câmara de frios");
  });

  it("sem o embed do orçamento cai na descrição padrão", () => {
    const d = chargeDescription({ competencia: "2026-09-01", contract: { quote_id: "x", quote: null } });
    expect(d).toMatch(/^Manutenção de climatização/);
  });

  it("trunca ao limite do Asaas", () => {
    const d = chargeDescription({
      competencia: "2026-09-01",
      contract: { quote_id: "x", quote: { numero: 1010, titulo: "A".repeat(800) } },
    });
    expect(d.length).toBe(ASAAS_DESCRIPTION_MAX);
    expect(d.startsWith("Orçamento ORC-1010: AAA")).toBe(true);
    expect(d.endsWith("…")).toBe(true);
  });
});
