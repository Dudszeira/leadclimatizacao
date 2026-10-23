import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildingsFixture, clientsFixture, quoteItemsFixture, quotesFixture } from "@/lib/fixtures";
import { orcamentoPdfFilename, renderOrcamentoPdf } from "@/lib/pdf/orcamento-pdf";
import type { QuoteItem, QuoteWithItems } from "@/lib/types";

/** Monta QuoteWithItems a partir das fixtures (mesmo formato de getQuote). */
function fixtureQuote(numero: number): QuoteWithItems {
  const q = quotesFixture.find((x) => x.numero === numero);
  if (!q) throw new Error(`fixture ${numero} não existe`);
  const c = clientsFixture.find((x) => x.id === q.client_id)!;
  const b = buildingsFixture.find((x) => x.id === q.building_id)!;
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
    items: quoteItemsFixture.filter((i) => i.quote_id === q.id).sort((a, b) => a.ordem - b.ordem),
  };
}

/** Orçamento grande (45 itens) para conferir quebra de página e cabeçalho repetido. */
function bigQuote(): QuoteWithItems {
  const base = fixtureQuote(1008);
  const items: QuoteItem[] = Array.from({ length: 45 }, (_, i) => {
    const quantidade = (i % 7) + 1 + (i % 3 === 0 ? 0.5 : 0);
    const preco_unitario = 135 + i * 37.9;
    return {
      ...base.items[0],
      id: `big-${i}`,
      descricao:
        i % 5 === 0
          ? `Evaporadora cassete 4 vias ${18 + (i % 3) * 6}.000 BTU com instalação, suporte, dreno e interligação elétrica até o quadro (item ${i + 1})`
          : `Infraestrutura de cobre isolado — trecho ${i + 1}`,
      unidade: i % 5 === 0 ? "un" : "m",
      quantidade,
      preco_unitario: Math.round(preco_unitario * 100) / 100,
      valor: Math.round(quantidade * preco_unitario * 100) / 100,
      ordem: i,
    };
  });
  const subtotal = Math.round(items.reduce((s, i) => s + i.valor, 0) * 100) / 100;
  return {
    ...base,
    numero: 1099,
    status: "aprovado",
    decidido_em: new Date().toISOString(),
    observacoes:
      "Acesso à cobertura pelo elevador de serviço, das 8h às 17h. Necessário içamento da condensadora com guindaste (incluso). Valores válidos para pagamento nas condições acima.",
    items,
    subtotal,
    desconto: 2400,
    total: Math.round((subtotal - 2400) * 100) / 100,
  };
}

const OUT = process.env.PDF_OUT_DIR;

async function render(quote: QuoteWithItems): Promise<Buffer> {
  const buf = await renderOrcamentoPdf(quote);
  if (OUT) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(path.join(OUT, orcamentoPdfFilename(quote.numero)), buf);
  }
  return buf;
}

describe("PDF do orçamento", () => {
  it("renderiza uma fixture (com desconto) como PDF válido", async () => {
    const buf = await render(fixtureQuote(1003));
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(5 * 1024);
  });

  it("renderiza orçamento declinado e um com muitos itens em várias páginas", async () => {
    const declinado = await render(fixtureQuote(1002));
    expect(declinado.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const grande = await render(bigQuote());
    expect(grande.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const pages = grande.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(pages.length).toBeGreaterThanOrEqual(2);
  });

  it("nome do arquivo usa o número ORC", () => {
    expect(orcamentoPdfFilename(1004)).toBe("orcamento-ORC-1004.pdf");
  });
});
