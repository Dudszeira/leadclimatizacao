import { isDemoMode } from "@/lib/env";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type {
  PmocCalendarItem,
  PmocContadores,
  PmocSituacao,
  PmocSituacaoItem,
  Result,
} from "@/lib/types";
import {
  demoBuildingWithClient,
  demoEquipment,
  pmocPlansFixture,
} from "./_demo";
import { daysFromToday, failWith, ok } from "./_shared";

function situacaoDe(diasParaVencer: number): PmocSituacao {
  if (diasParaVencer < 0) return "atrasado";
  if (diasParaVencer <= 7) return "vencendo";
  return "em_dia";
}

function demoSituacaoItens(): PmocSituacaoItem[] {
  return pmocPlansFixture
    .filter((p) => p.ativo)
    .map((p) => {
      const equipment = demoEquipment(p.equipment_id);
      if (!equipment) {
        throw new Error(`Fixture inconsistente: equipamento ${p.equipment_id} não existe`);
      }
      const building = demoBuildingWithClient(equipment.building_id);
      const dias = daysFromToday(p.proxima_data);
      return {
        pmoc_plan_id: p.id,
        cliente: building.client.razao_social,
        predio: building.nome,
        codigo_interno: equipment.codigo_interno,
        equipamento_tipo: equipment.tipo,
        periodicidade_dias: p.periodicidade_dias,
        proxima_data: p.proxima_data,
        dias_para_vencer: dias,
        situacao: situacaoDe(dias),
      };
    })
    .sort((a, b) => a.proxima_data.localeCompare(b.proxima_data));
}

/**
 * Situação dos planos PMOC ativos (em_dia / vencendo ≤7d / atrasado),
 * ordenada pela próxima data — espelho de vw_dashboard_pmoc_situacao.
 */
export async function listPmocSituacao(): Promise<Result<PmocSituacaoItem[]>> {
  try {
    if (isDemoMode) return ok(demoSituacaoItens());

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("vw_dashboard_pmoc_situacao")
      .select("*")
      .order("proxima_data", { ascending: true });
    if (error) {
      return failWith("listPmocSituacao", error, "Não foi possível carregar a situação do PMOC. Tente novamente.");
    }
    return ok((data ?? []) as PmocSituacaoItem[]);
  } catch (error) {
    return failWith("listPmocSituacao", error, "Não foi possível carregar a situação do PMOC. Tente novamente.");
  }
}

/** Contadores de PMOC para cards: total, em dia, vencendo ≤7d, atrasados. */
export async function getPmocContadores(): Promise<Result<PmocContadores>> {
  const result = await listPmocSituacao();
  if (result.error !== null) return { data: null, error: result.error };
  const itens = result.data;
  return ok({
    total: itens.length,
    em_dia: itens.filter((i) => i.situacao === "em_dia").length,
    vencendo_7d: itens.filter((i) => i.situacao === "vencendo").length,
    atrasados: itens.filter((i) => i.situacao === "atrasado").length,
  });
}

export interface PmocCalendarParams {
  /** Ano (ex.: 2026). */
  year: number;
  /** Mês 1-12. */
  month: number;
}

/**
 * Itens do calendário PMOC de um mês: a próxima visita real de cada plano e as
 * ocorrências futuras projetadas pela periodicidade (proxima_data + n×período).
 * Planos atrasados aparecem no dia devido enquanto o mês consultado o contiver.
 */
export async function getPmocCalendar(
  params: PmocCalendarParams,
): Promise<Result<PmocCalendarItem[]>> {
  const result = await listPmocSituacao();
  if (result.error !== null) return { data: null, error: result.error };

  const { year, month } = params;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { data: null, error: "Mês inválido para o calendário PMOC." };
  }

  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const items: PmocCalendarItem[] = [];

  for (const plan of result.data) {
    // Projeta até 24 ocorrências à frente a partir da proxima_data
    const [py, pm, pd] = plan.proxima_data.split("-").map(Number);
    for (let n = 0; n <= 24; n++) {
      const d = new Date(py, pm - 1, pd + n * plan.periodicidade_dias);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key > monthKey) break;
      if (key !== monthKey) continue;
      items.push({
        data: `${key}-${String(d.getDate()).padStart(2, "0")}`,
        pmoc_plan_id: plan.pmoc_plan_id,
        codigo_interno: plan.codigo_interno,
        equipamento_tipo: plan.equipamento_tipo,
        cliente: plan.cliente,
        predio: plan.predio,
        periodicidade_dias: plan.periodicidade_dias,
        situacao: plan.situacao,
        projetada: n > 0,
      });
    }
  }

  items.sort((a, b) => a.data.localeCompare(b.data) || a.cliente.localeCompare(b.cliente));
  return ok(items);
}
