import { describe, expect, it } from "vitest";
import { catalogFixture } from "@/lib/fixtures/catalog";
import { quoteItemsFixture, quotesFixture } from "@/lib/fixtures/quotes";
import { approveQuoteSchema, parseNumeroBR, quoteSchema, quoteSubtotal } from "@/lib/quotes/schemas";

const base = {
  client_id: "c0000000-0000-4000-8000-000000000001",
  building_id: "b0000000-0000-4000-8000-000000000001",
  titulo: "Instalação",
  validade: "2026-11-30",
};

describe("schemas de orçamento", () => {
  it("parseNumeroBR aceita formato brasileiro", () => {
    expect(parseNumeroBR("1.234,56")).toBe(1234.56);
    expect(parseNumeroBR("R$ 85,5")).toBe(85.5);
    expect(parseNumeroBR("12.5")).toBe(12.5);
    expect(parseNumeroBR("")).toBeNaN();
  });

  it("subtotal arredonda por linha como o banco", () => {
    expect(quoteSubtotal([{ quantidade: 3.5, preco_unitario: 85.5 }, { quantidade: 2, preco_unitario: 1200 }])).toBe(2699.25);
    expect(quoteSubtotal([{ quantidade: 0.333, preco_unitario: 10 }])).toBe(3.33);
  });

  it("valida itens, desconto e defaults", () => {
    const ok = quoteSchema.safeParse({
      ...base,
      desconto: "10,00",
      items: [{ descricao: "Split", quantidade: "2", preco_unitario: "1.000,00" }],
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.tipo_servico).toBe("instalacao");
      expect(ok.data.items[0]).toMatchObject({ unidade: "un", quantidade: 2, preco_unitario: 1000, catalog_item_id: null });
      expect(ok.data.observacoes).toBeNull();
    }
    expect(quoteSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(
      quoteSchema.safeParse({ ...base, desconto: 500, items: [{ descricao: "x", quantidade: 1, preco_unitario: 100 }] })
        .success,
    ).toBe(false);
    expect(
      quoteSchema.safeParse({ ...base, items: [{ descricao: "x", quantidade: 0, preco_unitario: 100 }] }).success,
    ).toBe(false);
    expect(approveQuoteSchema.safeParse({ vencimento: "2026-11-10", metodo: "cartao" }).success).toBe(false);
  });
});

describe("fixtures de orçamento", () => {
  it("têm os 3 status, valores entre R$ 800 e R$ 48.000 e totais coerentes", () => {
    expect(new Set(quotesFixture.map((q) => q.status))).toEqual(new Set(["aguardando", "aprovado", "declinado"]));
    for (const q of quotesFixture) {
      expect(q.total).toBeGreaterThanOrEqual(800);
      expect(q.total).toBeLessThanOrEqual(48000);
      const itens = quoteItemsFixture.filter((i) => i.quote_id === q.id);
      expect(q.subtotal).toBe(quoteSubtotal(itens));
      expect(q.total).toBe(Math.round((q.subtotal - q.desconto) * 100) / 100);
    }
    const catIds = new Set(catalogFixture.map((c) => c.id));
    for (const i of quoteItemsFixture) if (i.catalog_item_id) expect(catIds.has(i.catalog_item_id)).toBe(true);
  });
});
