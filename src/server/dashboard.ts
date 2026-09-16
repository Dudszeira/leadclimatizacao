import { isDemoMode } from "@/lib/env";
import { conversationsFixture, leadsFixture, messagesFixture } from "@/lib/fixtures";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type {
  ChamadosPorMesPoint,
  ChamadosPorMesRow,
  DashboardKpis,
  DashboardResumo,
  FaturamentoMesRow,
  FunilDoMes,
  FunilMesRow,
  LeadStage,
  OsType,
  Result,
  ServiceOrderListItem,
} from "@/lib/types";
import {
  buildingsFixture,
  demoClientIdsComContratoAtivo,
  demoServiceOrderListItem,
  equipmentFixture,
  invoicesFixture,
  pmocPlansFixture,
  serviceOrdersFixture,
} from "./_demo";
import { failWith, monthStartDate, ok } from "./_shared";

export { getPmocContadores, listPmocSituacao } from "./pmoc";

const OS_EM_ANDAMENTO = ["aberto", "agendado", "em_campo"] as const;

// ----------------------------------------------------------------------------
// Resumo (cards do topo) — espelho de public.dashboard_resumo()
// ----------------------------------------------------------------------------
export async function getDashboardResumo(): Promise<Result<DashboardResumo>> {
  try {
    if (isDemoMode) {
      const mes = monthStartDate(0);
      const hoje = new Date().toISOString().slice(0, 10);
      const em7d = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
      return ok({
        os_abertas: serviceOrdersFixture.filter((o) => o.status === "aberto").length,
        os_agendadas: serviceOrdersFixture.filter((o) => o.status === "agendado").length,
        os_em_campo: serviceOrdersFixture.filter((o) => o.status === "em_campo").length,
        os_concluidas_mes: serviceOrdersFixture.filter(
          (o) => o.status === "concluido" && (o.concluded_at ?? "") >= mes,
        ).length,
        equip_com_chamado: equipmentFixture.filter(
          (e) => e.status === "chamado_aberto" || e.status === "tecnico_em_campo",
        ).length,
        pmoc_atrasados: pmocPlansFixture.filter((p) => p.ativo && p.proxima_data < hoje).length,
        pmoc_vencendo_7d: pmocPlansFixture.filter(
          (p) => p.ativo && p.proxima_data >= hoje && p.proxima_data <= em7d,
        ).length,
        leads_mes: leadsFixture.filter((l) => l.created_at >= mes).length,
        faturamento_previsto_mes: invoicesFixture
          .filter((i) => i.competencia === mes && i.status !== "cancelado")
          .reduce((sum, i) => sum + i.valor, 0),
        faturamento_recebido_mes: invoicesFixture
          .filter((i) => i.competencia === mes && i.status === "pago")
          .reduce((sum, i) => sum + i.valor, 0),
      });
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase.rpc("dashboard_resumo");
    if (error) {
      return failWith("getDashboardResumo", error, "Não foi possível carregar o resumo do dashboard. Tente novamente.");
    }
    return ok(data as DashboardResumo);
  } catch (error) {
    return failWith("getDashboardResumo", error, "Não foi possível carregar o resumo do dashboard. Tente novamente.");
  }
}

// ----------------------------------------------------------------------------
// KPIs do topo
// ----------------------------------------------------------------------------

interface FirstResponseInput {
  conversation_id: string;
  direcao: "in" | "out";
  created_at: string;
}

/** Média (min) entre a 1ª mensagem do cliente e a 1ª resposta da conversa. */
function avgFirstResponseMinutes(messages: FirstResponseInput[]): number | null {
  const byConversation = new Map<string, FirstResponseInput[]>();
  for (const m of messages) {
    const list = byConversation.get(m.conversation_id) ?? [];
    list.push(m);
    byConversation.set(m.conversation_id, list);
  }
  const deltas: number[] = [];
  for (const list of byConversation.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const firstIn = list.find((m) => m.direcao === "in");
    if (!firstIn) continue;
    const firstOut = list.find(
      (m) => m.direcao === "out" && m.created_at >= firstIn.created_at,
    );
    if (!firstOut) continue;
    deltas.push(
      (new Date(firstOut.created_at).getTime() - new Date(firstIn.created_at).getTime()) / 60_000,
    );
  }
  if (deltas.length === 0) return null;
  return Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10;
}

export async function getDashboardKpis(): Promise<Result<DashboardKpis>> {
  try {
    if (isDemoMode) {
      const clientesComContrato = demoClientIdsComContratoAtivo();
      const buildingIdsSobContrato = new Set(
        buildingsFixture
          .filter((b) => clientesComContrato.has(b.client_id))
          .map((b) => b.id),
      );
      const equipamentosSobContrato = equipmentFixture.filter(
        (e) => e.status !== "inativo" && buildingIdsSobContrato.has(e.building_id),
      ).length;

      const chamadosAbertos = serviceOrdersFixture.filter((o) =>
        (OS_EM_ANDAMENTO as readonly string[]).includes(o.status),
      ).length;

      const totalConversas = conversationsFixture.length;
      const transferidas = conversationsFixture.filter((c) => c.status === "transferido").length;
      const triagemIaPct =
        totalConversas === 0
          ? null
          : Math.round(((totalConversas - transferidas) / totalConversas) * 1000) / 10;

      return ok({
        equipamentos_sob_contrato: equipamentosSobContrato,
        chamados_abertos: chamadosAbertos,
        triagem_ia_pct: triagemIaPct,
        tempo_primeira_resposta_min: avgFirstResponseMinutes(messagesFixture),
      });
    }

    const supabase = await createSupabase();
    const [equipRes, osRes, convTotalRes, convTransfRes, msgRes] = await Promise.all([
      supabase
        .from("equipment")
        .select("id, building:buildings!inner(client:clients!inner(contracts!inner(id)))", {
          count: "exact",
          head: true,
        })
        .neq("status", "inativo")
        .eq("building.client.contracts.status", "ativo"),
      supabase
        .from("service_orders")
        .select("id", { count: "exact", head: true })
        .in("status", [...OS_EM_ANDAMENTO]),
      supabase.from("conversations").select("id", { count: "exact", head: true }),
      supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("status", "transferido"),
      supabase
        .from("messages")
        .select("conversation_id, direcao, created_at")
        .order("created_at", { ascending: true })
        .limit(2000),
    ]);

    const firstError =
      equipRes.error ?? osRes.error ?? convTotalRes.error ?? convTransfRes.error ?? msgRes.error;
    if (firstError) {
      return failWith("getDashboardKpis", firstError, "Não foi possível carregar os indicadores do dashboard. Tente novamente.");
    }

    const totalConversas = convTotalRes.count ?? 0;
    const transferidas = convTransfRes.count ?? 0;
    return ok({
      equipamentos_sob_contrato: equipRes.count ?? 0,
      chamados_abertos: osRes.count ?? 0,
      triagem_ia_pct:
        totalConversas === 0
          ? null
          : Math.round(((totalConversas - transferidas) / totalConversas) * 1000) / 10,
      tempo_primeira_resposta_min: avgFirstResponseMinutes(
        (msgRes.data ?? []) as FirstResponseInput[],
      ),
    });
  } catch (error) {
    return failWith("getDashboardKpis", error, "Não foi possível carregar os indicadores do dashboard. Tente novamente.");
  }
}

// ----------------------------------------------------------------------------
// Série de chamados por mês (últimos N meses, default 6)
// ----------------------------------------------------------------------------
export async function getChamadosPorMes(
  meses = 6,
): Promise<Result<ChamadosPorMesPoint[]>> {
  try {
    const n = Math.min(12, Math.max(1, Math.floor(meses)));
    const emptyPorTipo = (): Record<OsType, number> => ({
      preventiva_pmoc: 0,
      corretiva: 0,
      instalacao: 0,
      orcamento: 0,
    });
    const points = new Map<string, ChamadosPorMesPoint>();
    for (let m = n - 1; m >= 0; m--) {
      const mes = monthStartDate(m);
      points.set(mes.slice(0, 7), { mes, total: 0, por_tipo: emptyPorTipo() });
    }

    if (isDemoMode) {
      for (const os of serviceOrdersFixture) {
        const point = points.get(os.created_at.slice(0, 7));
        if (!point) continue;
        point.total += 1;
        point.por_tipo[os.tipo] += 1;
      }
      return ok([...points.values()]);
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("vw_dashboard_chamados_por_mes")
      .select("*")
      .gte("mes", monthStartDate(n - 1));
    if (error) {
      return failWith("getChamadosPorMes", error, "Não foi possível carregar a série de chamados. Tente novamente.");
    }
    for (const row of (data ?? []) as ChamadosPorMesRow[]) {
      const point = points.get(String(row.mes).slice(0, 7));
      if (!point) continue;
      point.total += row.total;
      point.por_tipo[row.tipo] += row.total;
    }
    return ok([...points.values()]);
  } catch (error) {
    return failWith("getChamadosPorMes", error, "Não foi possível carregar a série de chamados. Tente novamente.");
  }
}

// ----------------------------------------------------------------------------
// Funil comercial do mês corrente
// ----------------------------------------------------------------------------
function buildFunil(porEstagio: FunilMesRow[]): FunilDoMes {
  const total = (estagio: LeadStage) =>
    porEstagio.find((r) => r.estagio === estagio)?.total ?? 0;
  const valor = (estagio: LeadStage) =>
    porEstagio.find((r) => r.estagio === estagio)?.valor_estimado_total ?? 0;

  const vendas = total("venda");
  const reunioesRealizadas = total("reuniao_realizada") + vendas;
  const reunioesMarcadas = total("reuniao_marcada") + reunioesRealizadas;
  const leadsTotal = porEstagio.reduce((sum, r) => sum + r.total, 0);
  const taxa = (numerador: number, denominador: number) =>
    denominador === 0 ? null : Math.round((numerador / denominador) * 1000) / 10;

  return {
    leads_total: leadsTotal,
    reunioes_marcadas: reunioesMarcadas,
    reunioes_realizadas: reunioesRealizadas,
    vendas,
    perdidos: total("perdido"),
    valor_convertido: valor("venda"),
    valor_em_funil: porEstagio.reduce((sum, r) => sum + r.valor_estimado_total, 0),
    taxa_lead_para_reuniao: taxa(reunioesMarcadas, leadsTotal),
    taxa_reuniao_para_realizada: taxa(reunioesRealizadas, reunioesMarcadas),
    taxa_realizada_para_venda: taxa(vendas, reunioesRealizadas),
    taxa_conversao_geral: taxa(vendas, leadsTotal),
    por_estagio: porEstagio,
  };
}

export async function getFunilDoMes(): Promise<Result<FunilDoMes>> {
  try {
    if (isDemoMode) {
      const mes = monthStartDate(0);
      const doMes = leadsFixture.filter((l) => l.created_at >= mes);
      const porEstagio: FunilMesRow[] = [];
      for (const lead of doMes) {
        let row = porEstagio.find((r) => r.estagio === lead.estagio);
        if (!row) {
          row = { estagio: lead.estagio, total: 0, valor_estimado_total: 0 };
          porEstagio.push(row);
        }
        row.total += 1;
        row.valor_estimado_total += lead.valor_estimado ?? 0;
      }
      porEstagio.sort((a, b) => a.estagio.localeCompare(b.estagio));
      return ok(buildFunil(porEstagio));
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase.from("vw_dashboard_funil_mes").select("*");
    if (error) {
      return failWith("getFunilDoMes", error, "Não foi possível carregar o funil do mês. Tente novamente.");
    }
    return ok(buildFunil((data ?? []) as FunilMesRow[]));
  } catch (error) {
    return failWith("getFunilDoMes", error, "Não foi possível carregar o funil do mês. Tente novamente.");
  }
}

// ----------------------------------------------------------------------------
// Faturamento por competência (view vw_dashboard_faturamento)
// ----------------------------------------------------------------------------
export async function getFaturamentoPorMes(): Promise<Result<FaturamentoMesRow[]>> {
  try {
    if (isDemoMode) {
      const desde = monthStartDate(6);
      const porMes = new Map<string, FaturamentoMesRow>();
      for (const i of invoicesFixture) {
        if (i.competencia < desde) continue;
        let row = porMes.get(i.competencia);
        if (!row) {
          row = { mes: i.competencia, previsto: 0, recebido: 0, pendente: 0, atrasado: 0 };
          porMes.set(i.competencia, row);
        }
        if (i.status !== "cancelado") row.previsto += i.valor;
        if (i.status === "pago") row.recebido += i.valor;
        if (i.status === "pendente") row.pendente += i.valor;
        if (i.status === "atrasado") row.atrasado += i.valor;
      }
      return ok([...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes)));
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("vw_dashboard_faturamento")
      .select("*")
      .order("mes", { ascending: true });
    if (error) {
      return failWith("getFaturamentoPorMes", error, "Não foi possível carregar o faturamento por mês. Tente novamente.");
    }
    return ok((data ?? []) as FaturamentoMesRow[]);
  } catch (error) {
    return failWith("getFaturamentoPorMes", error, "Não foi possível carregar o faturamento por mês. Tente novamente.");
  }
}

// ----------------------------------------------------------------------------
// Próximos chamados agendados
// ----------------------------------------------------------------------------
export async function getProximosChamados(
  limit = 5,
): Promise<Result<ServiceOrderListItem[]>> {
  try {
    const max = Math.min(20, Math.max(1, Math.floor(limit)));
    const agora = new Date().toISOString();

    if (isDemoMode) {
      const items = serviceOrdersFixture
        .filter(
          (o) =>
            (o.status === "agendado" || o.status === "aberto") &&
            o.scheduled_at !== null &&
            o.scheduled_at >= agora,
        )
        .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))
        .slice(0, max)
        .map(demoServiceOrderListItem);
      return ok(items);
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("service_orders")
      .select(
        "*, building:buildings(id,nome,bairro,regiao, client:clients(id,razao_social,nome_fantasia)), equipment(id,codigo_interno,tipo,marca,modelo), technician:profiles!service_orders_technician_id_fkey(id,full_name,phone)",
      )
      .in("status", ["aberto", "agendado"])
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", agora)
      .order("scheduled_at", { ascending: true })
      .limit(max);
    if (error) {
      return failWith("getProximosChamados", error, "Não foi possível carregar os próximos chamados. Tente novamente.");
    }
    return ok((data ?? []) as ServiceOrderListItem[]);
  } catch (error) {
    return failWith("getProximosChamados", error, "Não foi possível carregar os próximos chamados. Tente novamente.");
  }
}
