import type { Quote, QuoteItem, QuoteServiceType, QuoteStatus } from "@/lib/types";
import { dayOffset, isoAgo } from "./dates";

const ADMIN = "a0000000-0000-4000-8000-000000000001";
const ATENDENTE = "a0000000-0000-4000-8000-000000000002";

type ItemSeed = [catalogItemId: string | null, descricao: string, unidade: string, quantidade: number, preco: number];

interface QuoteSeed {
  id: string;
  numero: number;
  client_id: string;
  building_id: string;
  tipo_servico: QuoteServiceType;
  titulo: string;
  status: QuoteStatus;
  /** Dias atrás em que foi criado. */
  criadoHaDias: number;
  validadeDias: number;
  desconto: number;
  motivo?: string;
  decididoHaDias?: number;
  created_by: string;
  items: ItemSeed[];
}

const cat = (n: number) => `ca000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;

const CONDICOES = "50% na aprovação e 50% na conclusão, via Pix ou boleto";
const GARANTIA = "90 dias de mão de obra; equipamentos conforme fabricante";

/** 9 orçamentos de climatização nos 3 status (R$ 800 a R$ 48.000). */
const seeds: QuoteSeed[] = [
  {
    id: "d1000000-0000-4000-8000-000000000001", numero: 1000,
    client_id: "c0000000-0000-4000-8000-000000000012", building_id: "b0000000-0000-4000-8000-000000000014",
    tipo_servico: "instalacao", titulo: "Climatização de 12 apartamentos: 4º andar", status: "aprovado",
    criadoHaDias: 40, validadeDias: 15, desconto: 1500, decididoHaDias: 34, created_by: ADMIN,
    items: [
      [null, "Split inverter 12.000 BTU (equipamento)", "un", 12, 2490],
      [cat(2), "Instalação split 12.000 BTU", "un", 12, 750],
      [cat(8), "Infraestrutura de cobre (par de tubos isolados)", "m", 48, 135],
    ],
  },
  {
    id: "d1000000-0000-4000-8000-000000000002", numero: 1001,
    client_id: "c0000000-0000-4000-8000-000000000009", building_id: "b0000000-0000-4000-8000-000000000010",
    tipo_servico: "corretiva", titulo: "Recarga de gás e troca de capacitor: loja Portão", status: "aprovado",
    criadoHaDias: 22, validadeDias: 7, desconto: 0, decididoHaDias: 20, created_by: ATENDENTE,
    items: [
      [cat(9), "Visita técnica / diagnóstico", "un", 1, 180],
      [cat(6), "Recarga de gás R-410A", "kg", 2.5, 190],
      [cat(7), "Troca de capacitor", "un", 1, 240],
    ],
  },
  {
    id: "d1000000-0000-4000-8000-000000000003", numero: 1002,
    client_id: "c0000000-0000-4000-8000-000000000008", building_id: "b0000000-0000-4000-8000-000000000008",
    tipo_servico: "corretiva", titulo: "Higienização dos splits das salas comerciais", status: "declinado",
    criadoHaDias: 30, validadeDias: 10, desconto: 200, decididoHaDias: 25, created_by: ADMIN,
    motivo: "Condomínio fechou com outro fornecedor pelo preço",
    items: [[cat(5), "Higienização completa de split", "un", 18, 280]],
  },
  {
    id: "d1000000-0000-4000-8000-000000000004", numero: 1003,
    client_id: "c0000000-0000-4000-8000-000000000010", building_id: "b0000000-0000-4000-8000-000000000011",
    tipo_servico: "instalacao", titulo: "Laboratórios do bloco C: 8 splits 24.000 BTU", status: "aguardando",
    criadoHaDias: 6, validadeDias: 20, desconto: 1000, created_by: ADMIN,
    items: [
      [null, "Split inverter 24.000 BTU (equipamento)", "un", 8, 4290],
      [cat(4), "Instalação split 24.000 BTU", "un", 8, 1150],
      [cat(8), "Infraestrutura de cobre (par de tubos isolados)", "m", 40, 135],
    ],
  },
  {
    id: "d1000000-0000-4000-8000-000000000005", numero: 1004,
    client_id: "c0000000-0000-4000-8000-000000000011", building_id: "b0000000-0000-4000-8000-000000000013",
    tipo_servico: "corretiva", titulo: "Visita e diagnóstico: câmara de frios", status: "aguardando",
    criadoHaDias: 3, validadeDias: 7, desconto: 0, created_by: ATENDENTE,
    items: [
      [cat(9), "Visita técnica / diagnóstico", "un", 1, 180],
      [null, "Limpeza de condensadora e teste de pressão", "un", 1, 620],
    ],
  },
  {
    id: "d1000000-0000-4000-8000-000000000006", numero: 1005,
    client_id: "c0000000-0000-4000-8000-000000000007", building_id: "b0000000-0000-4000-8000-000000000007",
    tipo_servico: "instalacao", titulo: "Salão de festas e academia: 3 splits 18.000 BTU", status: "aguardando",
    criadoHaDias: 1, validadeDias: 15, desconto: 0, created_by: ADMIN,
    items: [
      [null, "Split inverter 18.000 BTU (equipamento)", "un", 3, 3390],
      [cat(3), "Instalação split 18.000 BTU", "un", 3, 950],
      [cat(8), "Infraestrutura de cobre (par de tubos isolados)", "m", 15, 135],
    ],
  },
  {
    id: "d1000000-0000-4000-8000-000000000007", numero: 1006,
    client_id: "c0000000-0000-4000-8000-000000000004", building_id: "b0000000-0000-4000-8000-000000000004",
    tipo_servico: "corretiva", titulo: "Substituição de compressor: UTI adulto", status: "aprovado",
    criadoHaDias: 12, validadeDias: 5, desconto: 0, decididoHaDias: 11, created_by: ADMIN,
    items: [
      [null, "Compressor scroll 5 TR (equipamento)", "un", 1, 7850],
      [null, "Mão de obra de troca de compressor + vácuo", "un", 1, 1900],
      [cat(6), "Recarga de gás R-410A", "kg", 6, 190],
    ],
  },
  {
    id: "d1000000-0000-4000-8000-000000000008", numero: 1007,
    client_id: "c0000000-0000-4000-8000-000000000006", building_id: "b0000000-0000-4000-8000-000000000006",
    tipo_servico: "instalacao", titulo: "Escritório administrativo: 4 splits 9.000 BTU", status: "declinado",
    criadoHaDias: 50, validadeDias: 15, desconto: 0, decididoHaDias: 33, created_by: ATENDENTE,
    motivo: "Projeto adiado para o próximo ano",
    items: [
      [null, "Split inverter 9.000 BTU (equipamento)", "un", 4, 1890],
      [cat(1), "Instalação split 9.000 BTU", "un", 4, 650],
    ],
  },
  {
    id: "d1000000-0000-4000-8000-000000000009", numero: 1008,
    client_id: "c0000000-0000-4000-8000-000000000002", building_id: "b0000000-0000-4000-8000-000000000002",
    tipo_servico: "instalacao", titulo: "Expansão praça de alimentação: VRF e cassetes", status: "aguardando",
    criadoHaDias: 9, validadeDias: 30, desconto: 2400, created_by: ADMIN,
    items: [
      [null, "Condensadora VRF 20 HP (equipamento)", "un", 1, 29900],
      [null, "Evaporadora cassete 4 vias 24.000 BTU", "un", 4, 2650],
      [cat(8), "Infraestrutura de cobre (par de tubos isolados)", "m", 60, 135],
      [null, "Mão de obra de instalação VRF + start-up", "un", 1, 1800],
    ],
  },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

export const quoteItemsFixture: QuoteItem[] = seeds.flatMap((q) =>
  q.items.map(([catalog_item_id, descricao, unidade, quantidade, preco_unitario], i) => {
    const created = isoAgo({ days: q.criadoHaDias });
    return {
      id: `${q.id.slice(0, 24)}${String(i + 1).padStart(4, "0")}${q.id.slice(-8)}`,
      quote_id: q.id,
      catalog_item_id,
      descricao,
      unidade,
      quantidade,
      preco_unitario,
      valor: round2(quantidade * preco_unitario),
      ordem: i,
      created_at: created,
      updated_at: created,
    };
  }),
);

export const quotesFixture: Quote[] = seeds.map((q) => {
  const subtotal = round2(
    quoteItemsFixture.filter((i) => i.quote_id === q.id).reduce((s, i) => s + i.valor, 0),
  );
  const created = isoAgo({ days: q.criadoHaDias });
  const decidido = q.decididoHaDias != null ? isoAgo({ days: q.decididoHaDias }) : null;
  return {
    id: q.id,
    numero: q.numero,
    client_id: q.client_id,
    building_id: q.building_id,
    tipo_servico: q.tipo_servico,
    titulo: q.titulo,
    observacoes: null,
    validade: dayOffset(q.validadeDias - q.criadoHaDias),
    condicoes_pagamento: CONDICOES,
    prazo_execucao: q.tipo_servico === "instalacao" ? "Até 15 dias úteis após a aprovação" : "Até 3 dias úteis",
    garantia: GARANTIA,
    desconto: q.desconto,
    subtotal,
    total: round2(subtotal - q.desconto),
    status: q.status,
    motivo_declinio: q.motivo ?? null,
    decidido_em: decidido,
    service_order_id: null,
    invoice_id: null,
    created_by: q.created_by,
    created_at: created,
    updated_at: decidido ?? created,
  };
});
