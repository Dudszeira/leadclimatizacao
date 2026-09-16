import type { OsType, ServiceOrder } from "@/lib/types";
import { addDays, atHour, isoAgo, monthStart, parseDateOnly } from "./dates";

const base = {
  checkin_lat: null as number | null,
  checkin_lng: null as number | null,
  checkin_at: null as string | null,
  checklist_respostas: null,
  fotos_antes: [] as string[],
  fotos_depois: [] as string[],
  laudo: null as string | null,
  assinatura_path: null as string | null,
  concluded_at: null as string | null,
};

function stamps(createdAt: string) {
  return { created_at: createdAt, updated_at: createdAt };
}

/** 15 ordens de serviço nominais (números 1001..1015) — espelho da seção 7 do seed.sql. */
const ordensNominais: ServiceOrder[] = [
  // CONCLUÍDAS ---------------------------------------------------------------
  {
    ...base,
    id: "50000000-0000-4000-8000-000000000001",
    numero: 1001,
    tipo: "corretiva",
    prioridade: "alta",
    status: "concluido",
    origem: "manual",
    building_id: "b0000000-0000-4000-8000-000000000001",
    equipment_id: "e0000000-0000-4000-8000-000000000003",
    pmoc_plan_id: null,
    technician_id: "a0000000-0000-4000-8000-000000000003",
    descricao:
      "Self da praça de alimentação desarmando por alta pressão nos horários de pico.",
    scheduled_at: atHour(-20, 9),
    checkin_lat: -25.4473,
    checkin_lng: -49.2882,
    checkin_at: atHour(-20, 9, 12),
    checklist_template_id: "ce000000-0000-4000-8000-000000000003",
    checklist_respostas: {
      sintoma_confirmado: true,
      causa_raiz: "Condensador obstruído por gordura da praça de alimentação",
      peca_substituida: "Pressostato de alta",
      teste_funcionamento: true,
      obs: "Recomendada limpeza trimestral do condensador",
    },
    fotos_antes: ["50000000-0000-4000-8000-000000000001/antes/condensador-01.jpg"],
    fotos_depois: ["50000000-0000-4000-8000-000000000001/depois/condensador-01.jpg"],
    laudo:
      "Condensador higienizado com produto alcalino e pressostato de alta substituído. Equipamento operando com pressões nominais após 40 min de teste.",
    assinatura_path: "50000000-0000-4000-8000-000000000001/assinatura.png",
    concluded_at: atHour(-20, 12),
    created_by: "a0000000-0000-4000-8000-000000000002",
    ...stamps(atHour(-21, 15)),
  },
  {
    ...base,
    id: "50000000-0000-4000-8000-000000000002",
    numero: 1002,
    tipo: "preventiva_pmoc",
    prioridade: "media",
    status: "concluido",
    origem: "pmoc_auto",
    building_id: "b0000000-0000-4000-8000-000000000001",
    equipment_id: "e0000000-0000-4000-8000-000000000004",
    pmoc_plan_id: "ac000000-0000-4000-8000-000000000004",
    technician_id: "a0000000-0000-4000-8000-000000000004",
    descricao: "Manutenção preventiva PMOC — VRF administração (ciclo mensal).",
    scheduled_at: atHour(-10, 8),
    checkin_lat: -25.4471,
    checkin_lng: -49.2879,
    checkin_at: atHour(-10, 8, 5),
    checklist_template_id: "ce000000-0000-4000-8000-000000000001",
    checklist_respostas: {
      limpeza_filtros: true,
      limpeza_serpentina: true,
      dreno: true,
      pressao_gas: 118,
      corrente_compressor: 12.4,
      temperatura_saida: 13.5,
      obs: "Sem anomalias",
    },
    fotos_antes: ["50000000-0000-4000-8000-000000000002/antes/filtros.jpg"],
    fotos_depois: ["50000000-0000-4000-8000-000000000002/depois/filtros.jpg"],
    laudo:
      "Rotina PMOC executada integralmente. Parâmetros dentro da faixa. Próximo ciclo em 30 dias.",
    assinatura_path: "50000000-0000-4000-8000-000000000002/assinatura.png",
    concluded_at: atHour(-10, 10, 30),
    created_by: "a0000000-0000-4000-8000-000000000002",
    ...stamps(atHour(-12, 9)),
  },
  {
    ...base,
    id: "50000000-0000-4000-8000-000000000003",
    numero: 1003,
    tipo: "preventiva_pmoc",
    prioridade: "media",
    status: "concluido",
    origem: "pmoc_auto",
    building_id: "b0000000-0000-4000-8000-000000000014",
    equipment_id: "e0000000-0000-4000-8000-000000000011",
    pmoc_plan_id: "ac000000-0000-4000-8000-000000000006",
    technician_id: "a0000000-0000-4000-8000-000000000005",
    descricao: "Manutenção preventiva PMOC — VRF dos apartamentos (ciclo mensal).",
    scheduled_at: atHour(-16, 14),
    checkin_lat: -25.4371,
    checkin_lng: -49.3012,
    checkin_at: atHour(-16, 14, 3),
    checklist_template_id: "ce000000-0000-4000-8000-000000000001",
    checklist_respostas: {
      limpeza_filtros: true,
      limpeza_serpentina: true,
      dreno: true,
      pressao_gas: 121,
      corrente_compressor: 14.1,
      temperatura_saida: 12.8,
      obs: "Dreno do 6º andar com início de obstrução — tratado",
    },
    fotos_antes: ["50000000-0000-4000-8000-000000000003/antes/evaporadora.jpg"],
    fotos_depois: ["50000000-0000-4000-8000-000000000003/depois/evaporadora.jpg"],
    laudo: "PMOC concluído. Atenção ao dreno do 6º pavimento nos próximos ciclos.",
    assinatura_path: "50000000-0000-4000-8000-000000000003/assinatura.png",
    concluded_at: atHour(-16, 17),
    created_by: "a0000000-0000-4000-8000-000000000002",
    ...stamps(atHour(-18, 10)),
  },

  // EM CAMPO (hoje, com check-in geolocalizado) --------------------------------
  {
    ...base,
    id: "50000000-0000-4000-8000-000000000004",
    numero: 1004,
    tipo: "corretiva",
    prioridade: "urgente",
    status: "em_campo",
    origem: "ia_whatsapp",
    building_id: "b0000000-0000-4000-8000-000000000003",
    equipment_id: "e0000000-0000-4000-8000-000000000005",
    pmoc_plan_id: null,
    technician_id: "a0000000-0000-4000-8000-000000000003",
    descricao:
      "Chiller da casa de máquinas em alarme de baixa vazão — impacto direto no CTI. Aberto pela IA via WhatsApp.",
    scheduled_at: atHour(0, 8),
    checkin_lat: -25.4449,
    checkin_lng: -49.2621,
    checkin_at: isoAgo({ hours: 2 }),
    checklist_template_id: "ce000000-0000-4000-8000-000000000003",
    fotos_antes: ["50000000-0000-4000-8000-000000000004/antes/painel-alarme.jpg"],
    created_by: "a0000000-0000-4000-8000-000000000002",
    ...stamps(isoAgo({ hours: 4 })),
  },
  {
    ...base,
    id: "50000000-0000-4000-8000-000000000005",
    numero: 1005,
    tipo: "corretiva",
    prioridade: "alta",
    status: "em_campo",
    origem: "manual",
    building_id: "b0000000-0000-4000-8000-000000000005",
    equipment_id: "e0000000-0000-4000-8000-000000000008",
    pmoc_plan_id: null,
    technician_id: "a0000000-0000-4000-8000-000000000004",
    descricao: "Self do galpão com ruído anormal no ventilador do condensador.",
    scheduled_at: atHour(0, 13),
    checkin_lat: -25.4951,
    checkin_lng: -49.3448,
    checkin_at: isoAgo({ hours: 1 }),
    checklist_template_id: "ce000000-0000-4000-8000-000000000003",
    created_by: "a0000000-0000-4000-8000-000000000002",
    ...stamps(atHour(-1, 16)),
  },

  // AGENDADAS ------------------------------------------------------------------
  {
    ...base,
    id: "50000000-0000-4000-8000-000000000006",
    numero: 1006,
    tipo: "preventiva_pmoc",
    prioridade: "media",
    status: "agendado",
    origem: "pmoc_auto",
    building_id: "b0000000-0000-4000-8000-000000000001",
    equipment_id: "e0000000-0000-4000-8000-000000000001",
    pmoc_plan_id: "ac000000-0000-4000-8000-000000000001",
    technician_id: "a0000000-0000-4000-8000-000000000005",
    descricao: "Manutenção preventiva PMOC — chiller CAG-01 (vencimento próximo).",
    scheduled_at: atHour(1, 7),
    checklist_template_id: "ce000000-0000-4000-8000-000000000002",
    created_by: "a0000000-0000-4000-8000-000000000002",
    ...stamps(atHour(-2, 11)),
  },
  {
    ...base,
    id: "50000000-0000-4000-8000-000000000007",
    numero: 1007,
    tipo: "corretiva",
    prioridade: "media",
    status: "agendado",
    origem: "manual",
    building_id: "b0000000-0000-4000-8000-000000000007",
    equipment_id: "e0000000-0000-4000-8000-000000000010",
    pmoc_plan_id: null,
    technician_id: "a0000000-0000-4000-8000-000000000003",
    descricao:
      "VRF do salão de festas com gotejamento na evaporadora — evento no fim de semana.",
    scheduled_at: atHour(2, 9),
    checklist_template_id: "ce000000-0000-4000-8000-000000000003",
    created_by: "a0000000-0000-4000-8000-000000000002",
    ...stamps(atHour(-1, 10)),
  },
  {
    ...base,
    id: "50000000-0000-4000-8000-000000000008",
    numero: 1008,
    tipo: "orcamento",
    prioridade: "baixa",
    status: "agendado",
    origem: "manual",
    building_id: "b0000000-0000-4000-8000-000000000011",
    equipment_id: null,
    pmoc_plan_id: null,
    technician_id: "a0000000-0000-4000-8000-000000000004",
    descricao:
      "Visita técnica para orçamento de climatização de 4 novas salas de aula do bloco C.",
    scheduled_at: atHour(3, 10),
    checklist_template_id: null,
    created_by: "a0000000-0000-4000-8000-000000000002",
    ...stamps(atHour(-3, 14)),
  },
  {
    ...base,
    id: "50000000-0000-4000-8000-000000000009",
    numero: 1009,
    tipo: "instalacao",
    prioridade: "media",
    status: "agendado",
    origem: "manual",
    building_id: "b0000000-0000-4000-8000-000000000012",
    equipment_id: null,
    pmoc_plan_id: null,
    technician_id: "a0000000-0000-4000-8000-000000000005",
    descricao:
      "Instalação de split 36k na nova padaria da loja Portão (venda fechada).",
    scheduled_at: atHour(5, 8),
    checklist_template_id: "ce000000-0000-4000-8000-000000000004",
    created_by: "a0000000-0000-4000-8000-000000000001",
    ...stamps(atHour(-4, 9)),
  },

  // ABERTAS --------------------------------------------------------------------
  {
    ...base,
    id: "50000000-0000-4000-8000-000000000010",
    numero: 1010,
    tipo: "corretiva",
    prioridade: "urgente",
    status: "aberto",
    origem: "ia_whatsapp",
    building_id: "b0000000-0000-4000-8000-000000000003",
    equipment_id: "e0000000-0000-4000-8000-000000000007",
    pmoc_plan_id: null,
    technician_id: null,
    descricao:
      "Split da farmácia interna não liga — medicamentos termolábeis em risco. Aberto pela IA via WhatsApp.",
    scheduled_at: null,
    checklist_template_id: "ce000000-0000-4000-8000-000000000003",
    created_by: null,
    ...stamps(isoAgo({ minutes: 35 })),
  },
  {
    ...base,
    id: "50000000-0000-4000-8000-000000000011",
    numero: 1011,
    tipo: "corretiva",
    prioridade: "media",
    status: "aberto",
    origem: "manual",
    building_id: "b0000000-0000-4000-8000-000000000009",
    equipment_id: "e0000000-0000-4000-8000-000000000013",
    pmoc_plan_id: null,
    technician_id: null,
    descricao: "Split do salão de vendas gelando pouco; possível baixa de gás.",
    scheduled_at: null,
    checklist_template_id: "ce000000-0000-4000-8000-000000000003",
    created_by: "a0000000-0000-4000-8000-000000000002",
    ...stamps(atHour(-1, 17)),
  },
  {
    ...base,
    id: "50000000-0000-4000-8000-000000000012",
    numero: 1012,
    tipo: "orcamento",
    prioridade: "baixa",
    status: "aberto",
    origem: "manual",
    building_id: "b0000000-0000-4000-8000-000000000002",
    equipment_id: null,
    pmoc_plan_id: null,
    technician_id: null,
    descricao: "Orçamento de retrofit da climatização do cinema (6 salas).",
    scheduled_at: null,
    checklist_template_id: null,
    created_by: "a0000000-0000-4000-8000-000000000001",
    ...stamps(atHour(-2, 15)),
  },
  {
    ...base,
    id: "50000000-0000-4000-8000-000000000013",
    numero: 1013,
    tipo: "preventiva_pmoc",
    prioridade: "alta",
    status: "aberto",
    origem: "pmoc_auto",
    building_id: "b0000000-0000-4000-8000-000000000003",
    equipment_id: "e0000000-0000-4000-8000-000000000005",
    pmoc_plan_id: "ac000000-0000-4000-8000-000000000002",
    technician_id: null,
    descricao:
      "Manutenção preventiva PMOC — chiller CAG-01 do hospital (PLANO ATRASADO, gerar agenda com urgência).",
    scheduled_at: null,
    checklist_template_id: "ce000000-0000-4000-8000-000000000002",
    created_by: null,
    ...stamps(atHour(-9, 6)),
  },
  {
    ...base,
    id: "50000000-0000-4000-8000-000000000014",
    numero: 1014,
    tipo: "instalacao",
    prioridade: "media",
    status: "aberto",
    origem: "manual",
    building_id: "b0000000-0000-4000-8000-000000000006",
    equipment_id: null,
    pmoc_plan_id: null,
    technician_id: null,
    descricao: "Instalação de 2 splits 24k no novo laboratório de qualidade.",
    scheduled_at: null,
    checklist_template_id: "ce000000-0000-4000-8000-000000000004",
    created_by: "a0000000-0000-4000-8000-000000000002",
    ...stamps(atHour(-5, 11)),
  },

  // CANCELADA ------------------------------------------------------------------
  {
    ...base,
    id: "50000000-0000-4000-8000-000000000015",
    numero: 1015,
    tipo: "corretiva",
    prioridade: "baixa",
    status: "cancelado",
    origem: "manual",
    building_id: "b0000000-0000-4000-8000-000000000013",
    equipment_id: "e0000000-0000-4000-8000-000000000016",
    pmoc_plan_id: null,
    technician_id: null,
    descricao:
      "Self da área de vendas com odor — cliente cancelou: problema era na exaustão da rotisseria.",
    scheduled_at: null,
    checklist_template_id: null,
    created_by: "a0000000-0000-4000-8000-000000000002",
    ...stamps(atHour(-8, 10)),
  },
];

// ----------------------------------------------------------------------------
// Lote programático: 30 OS concluídas nos 4 meses anteriores (números 901..930)
// — espelho fiel do generate_series(1, 30) da seção 7 do seed.sql. Alimenta a
// série "chamados por mês" do dashboard sem alterar o mês corrente/anterior.
// ----------------------------------------------------------------------------

/** (array[...])[(g % 8) + 1] do seed — 3 preventivas, 3 corretivas, 1 instalação, 1 orçamento a cada 8. */
const historicoTipos: OsType[] = [
  "preventiva_pmoc", // g % 8 === 0
  "corretiva",
  "preventiva_pmoc",
  "corretiva",
  "instalacao",
  "preventiva_pmoc",
  "corretiva",
  "orcamento",
];

/** (array[...])[(g % 6) + 1] do seed — pares prédio/equipamento existentes. */
const historicoPares: Array<{ building_id: string; equipment_id: string }> = [
  { building_id: "b0000000-0000-4000-8000-000000000001", equipment_id: "e0000000-0000-4000-8000-000000000003" }, // g % 6 === 0
  { building_id: "b0000000-0000-4000-8000-000000000003", equipment_id: "e0000000-0000-4000-8000-000000000006" },
  { building_id: "b0000000-0000-4000-8000-000000000005", equipment_id: "e0000000-0000-4000-8000-000000000008" },
  { building_id: "b0000000-0000-4000-8000-000000000007", equipment_id: "e0000000-0000-4000-8000-000000000010" },
  { building_id: "b0000000-0000-4000-8000-000000000014", equipment_id: "e0000000-0000-4000-8000-000000000011" },
  { building_id: "b0000000-0000-4000-8000-000000000009", equipment_id: "e0000000-0000-4000-8000-000000000013" },
];

/** (array[...])[(g % 3) + 1] do seed. */
const historicoTecnicos = [
  "a0000000-0000-4000-8000-000000000003", // g % 3 === 0
  "a0000000-0000-4000-8000-000000000004",
  "a0000000-0000-4000-8000-000000000005",
];

const historicoDescricoes: Record<OsType, string> = {
  preventiva_pmoc: "Manutenção preventiva PMOC — ciclo mensal concluído (histórico).",
  corretiva: "Atendimento corretivo concluído (histórico).",
  instalacao: "Instalação de equipamento concluída (histórico).",
  orcamento: "Visita técnica de orçamento realizada (histórico).",
};

/** date_trunc('month', current_date) - mb meses + (1 + (g*7)%24) dias + (8 + g%8) horas. */
function historicoCriadoEm(g: number): Date {
  const monthsBack = g <= 9 ? 5 : g <= 17 ? 4 : g <= 24 ? 3 : 2;
  const d = addDays(parseDateOnly(monthStart(monthsBack)), 1 + ((g * 7) % 24));
  d.setHours(8 + (g % 8), 0, 0, 0);
  return d;
}

const ordensHistoricas: ServiceOrder[] = Array.from({ length: 30 }, (_, i) => {
  const g = i + 1;
  const tipo = historicoTipos[g % 8];
  const par = historicoPares[g % 6];
  const criado = historicoCriadoEm(g);
  const agendado = addDays(criado, 1);
  const concluido = new Date(agendado.getTime() + 3 * 3_600_000);
  const semEquipamento = tipo === "instalacao" || tipo === "orcamento";
  return {
    ...base,
    id: `50000000-0000-4000-8000-0000000009${String(g).padStart(2, "0")}`,
    numero: 900 + g,
    tipo,
    prioridade: tipo === "corretiva" && g % 3 === 0 ? "alta" : "media",
    status: "concluido",
    origem: tipo === "preventiva_pmoc" ? "pmoc_auto" : "manual",
    building_id: par.building_id,
    equipment_id: semEquipamento ? null : par.equipment_id,
    pmoc_plan_id: null,
    technician_id: historicoTecnicos[g % 3],
    descricao: historicoDescricoes[tipo],
    scheduled_at: agendado.toISOString(),
    checklist_template_id: null,
    concluded_at: concluido.toISOString(),
    created_by: "a0000000-0000-4000-8000-000000000002",
    ...stamps(criado.toISOString()),
  };
});

/** 45 ordens de serviço — 15 nominais + 30 do lote histórico (espelho do seed.sql). */
export const serviceOrdersFixture: ServiceOrder[] = [
  ...ordensNominais,
  ...ordensHistoricas,
];
