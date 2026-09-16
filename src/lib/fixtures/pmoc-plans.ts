import type { PmocPlan } from "@/lib/types";
import { dayOffset, stamps } from "./dates";

/**
 * 7 planos PMOC — espelho da seção 6 do seed.sql:
 * 2 vencendo em até 7 dias (+5 e +6) e 1 atrasado (-9).
 */
export const pmocPlansFixture: PmocPlan[] = [
  {
    // VENCENDO em 5 dias (chiller do Shopping Água Verde)
    id: "ac000000-0000-4000-8000-000000000001",
    equipment_id: "e0000000-0000-4000-8000-000000000001",
    periodicidade_dias: 30,
    proxima_data: dayOffset(5),
    checklist_template_id: "ce000000-0000-4000-8000-000000000002",
    ativo: true,
    observacoes: "CAG principal — janela de manutenção: segundas antes das 10h",
    ...stamps(),
  },
  {
    // ATRASADO há 9 dias (chiller do Hospital Santa Clara)
    id: "ac000000-0000-4000-8000-000000000002",
    equipment_id: "e0000000-0000-4000-8000-000000000005",
    periodicidade_dias: 30,
    proxima_data: dayOffset(-9),
    checklist_template_id: "ce000000-0000-4000-8000-000000000002",
    ativo: true,
    observacoes: "Hospital: acesso à casa de máquinas com autorização da engenharia clínica",
    ...stamps(),
  },
  {
    // VENCENDO em 6 dias (VRF do CTI do Hospital Santa Clara)
    id: "ac000000-0000-4000-8000-000000000003",
    equipment_id: "e0000000-0000-4000-8000-000000000006",
    periodicidade_dias: 30,
    proxima_data: dayOffset(6),
    checklist_template_id: "ce000000-0000-4000-8000-000000000001",
    ativo: true,
    observacoes: "CTI — executar de madrugada, acompanhado pela enfermagem",
    ...stamps(),
  },
  {
    id: "ac000000-0000-4000-8000-000000000004",
    equipment_id: "e0000000-0000-4000-8000-000000000004",
    periodicidade_dias: 30,
    proxima_data: dayOffset(20),
    checklist_template_id: "ce000000-0000-4000-8000-000000000001",
    ativo: true,
    observacoes: null,
    ...stamps(),
  },
  {
    id: "ac000000-0000-4000-8000-000000000005",
    equipment_id: "e0000000-0000-4000-8000-000000000008",
    periodicidade_dias: 60,
    proxima_data: dayOffset(33),
    checklist_template_id: "ce000000-0000-4000-8000-000000000002",
    ativo: true,
    observacoes: "Galpão — ambiente com particulado metálico, filtros extras",
    ...stamps(),
  },
  {
    id: "ac000000-0000-4000-8000-000000000006",
    equipment_id: "e0000000-0000-4000-8000-000000000011",
    periodicidade_dias: 30,
    proxima_data: dayOffset(14),
    checklist_template_id: "ce000000-0000-4000-8000-000000000001",
    ativo: true,
    observacoes: null,
    ...stamps(),
  },
  {
    id: "ac000000-0000-4000-8000-000000000007",
    equipment_id: "e0000000-0000-4000-8000-000000000017",
    periodicidade_dias: 90,
    proxima_data: dayOffset(50),
    checklist_template_id: "ce000000-0000-4000-8000-000000000001",
    ativo: true,
    observacoes: "Condomínio comercial — trimestral conforme plano do RT",
    ...stamps(),
  },
];
