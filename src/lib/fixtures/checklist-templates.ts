import type { ChecklistTemplate } from "@/lib/types";
import { stamps } from "./dates";

/** Templates de checklist — espelho da seção 5 do seed.sql. */
export const checklistTemplatesFixture: ChecklistTemplate[] = [
  {
    id: "ce000000-0000-4000-8000-000000000001",
    nome: "PMOC — Split / VRF (mensal)",
    tipo: "preventiva_pmoc",
    itens: [
      { id: "limpeza_filtros", label: "Limpeza e higienização dos filtros de ar", tipo: "checkbox" },
      { id: "limpeza_serpentina", label: "Limpeza da serpentina do evaporador", tipo: "checkbox" },
      { id: "dreno", label: "Verificação e desobstrução do dreno", tipo: "checkbox" },
      { id: "pressao_gas", label: "Medição de pressão do fluido refrigerante", tipo: "numero", unidade: "psi" },
      { id: "corrente_compressor", label: "Medição de corrente do compressor", tipo: "numero", unidade: "A" },
      { id: "temperatura_saida", label: "Temperatura do ar de insuflamento", tipo: "numero", unidade: "°C" },
      { id: "obs", label: "Observações", tipo: "texto" },
    ],
    ativo: true,
    ...stamps(),
  },
  {
    id: "ce000000-0000-4000-8000-000000000002",
    nome: "PMOC — Chiller / Self (mensal)",
    tipo: "preventiva_pmoc",
    itens: [
      { id: "limpeza_condensador", label: "Limpeza do condensador", tipo: "checkbox" },
      { id: "nivel_oleo", label: "Verificação do nível de óleo do compressor", tipo: "checkbox" },
      { id: "analise_vibracao", label: "Análise de ruído e vibração", tipo: "checkbox" },
      { id: "setpoint_agua", label: "Temperatura de água gelada (saída)", tipo: "numero", unidade: "°C" },
      { id: "pressao_alta", label: "Pressão de alta", tipo: "numero", unidade: "psi" },
      { id: "pressao_baixa", label: "Pressão de baixa", tipo: "numero", unidade: "psi" },
      { id: "obs", label: "Observações", tipo: "texto" },
    ],
    ativo: true,
    ...stamps(),
  },
  {
    id: "ce000000-0000-4000-8000-000000000003",
    nome: "Corretiva — diagnóstico padrão",
    tipo: "corretiva",
    itens: [
      { id: "sintoma_confirmado", label: "Sintoma relatado confirmado em campo", tipo: "checkbox" },
      { id: "causa_raiz", label: "Causa raiz identificada", tipo: "texto" },
      { id: "peca_substituida", label: "Peça(s) substituída(s)", tipo: "texto" },
      { id: "teste_funcionamento", label: "Teste de funcionamento pós-reparo (30 min)", tipo: "checkbox" },
      { id: "obs", label: "Observações", tipo: "texto" },
    ],
    ativo: true,
    ...stamps(),
  },
  {
    id: "ce000000-0000-4000-8000-000000000004",
    nome: "Instalação — comissionamento",
    tipo: "instalacao",
    itens: [
      { id: "fixacao", label: "Fixação de unidades interna e externa", tipo: "checkbox" },
      { id: "vacuo", label: "Vácuo na linha (mín. 30 min)", tipo: "checkbox" },
      { id: "teste_estanqueidade", label: "Teste de estanqueidade", tipo: "checkbox" },
      { id: "carga_gas", label: "Carga de fluido conforme manual", tipo: "checkbox" },
      { id: "partida_assistida", label: "Partida assistida e medições finais", tipo: "checkbox" },
      { id: "obs", label: "Observações", tipo: "texto" },
    ],
    ativo: true,
    ...stamps(),
  },
];
