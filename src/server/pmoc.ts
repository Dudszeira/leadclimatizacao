import { isDemoMode } from "@/lib/env";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type {
  EquipmentType,
  OsStatus,
  PmocCalendarItem,
  PmocContadores,
  PmocPlan,
  PmocPlanListItem,
  PmocSituacao,
  PmocSituacaoItem,
  Result,
} from "@/lib/types";
import { checklistTemplatesFixture } from "@/lib/fixtures";
import {
  hojeBrt,
  situacaoPlano,
  situacaoPorDias,
} from "@/components/pmoc/situacao";
import {
  demoBuildingWithClient,
  demoEquipment,
  pmocPlansFixture,
  serviceOrdersFixture,
} from "./_demo";
import { daysFromToday, failWith, ok } from "./_shared";

function situacaoDe(diasParaVencer: number): PmocSituacao {
  return situacaoPorDias(diasParaVencer);
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

// ----------------------------------------------------------------------------
// Detalhes por plano (Sheet do calendário) e visitas concluídas do mês
// ----------------------------------------------------------------------------

/** Situação do plano + equipamento (marca/modelo), última manutenção e OS em andamento. */
export interface PmocPlanDetail extends PmocSituacaoItem {
  marca: string | null;
  modelo: string | null;
  /** Data ("YYYY-MM-DD") da última OS do plano concluída, se houver. */
  ultima_manutencao: string | null;
  /** OS já gerada e em andamento (aberto/agendado/em_campo) para o plano. */
  os_id: string | null;
  os_numero: number | null;
}

const OS_EM_ANDAMENTO = ["aberto", "agendado", "em_campo"];

/** "YYYY-MM-DD" local a partir de um timestamptz ISO. */
function dataLocalDe(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function demoPlanDetails(itens: PmocSituacaoItem[]): PmocPlanDetail[] {
  return itens.map((item) => {
    const plan = pmocPlansFixture.find((p) => p.id === item.pmoc_plan_id);
    const equipment = plan ? demoEquipment(plan.equipment_id) : undefined;
    const doPlano = serviceOrdersFixture.filter(
      (os) => os.pmoc_plan_id === item.pmoc_plan_id,
    );
    const concluidas = doPlano
      .filter((os) => os.status === "concluido" && os.concluded_at)
      .map((os) => os.concluded_at as string)
      .sort();
    const emAndamento = doPlano.find((os) => OS_EM_ANDAMENTO.includes(os.status));
    return {
      ...item,
      marca: equipment?.marca ?? null,
      modelo: equipment?.modelo ?? null,
      ultima_manutencao: concluidas.length
        ? dataLocalDe(concluidas[concluidas.length - 1])
        : null,
      os_id: emAndamento?.id ?? null,
      os_numero: emAndamento?.numero ?? null,
    };
  });
}

/**
 * Planos PMOC ativos enriquecidos para o painel de detalhes do calendário:
 * marca/modelo do equipamento, última manutenção concluída e OS em andamento.
 */
export async function listPmocPlanDetails(): Promise<Result<PmocPlanDetail[]>> {
  try {
    const base = await listPmocSituacao();
    if (base.error !== null) return { data: null, error: base.error };
    if (isDemoMode) return ok(demoPlanDetails(base.data));

    const ids = base.data.map((i) => i.pmoc_plan_id);
    if (ids.length === 0) return ok([]);

    const supabase = await createSupabase();
    const [plansRes, osRes] = await Promise.all([
      supabase.from("pmoc_plans").select("id, equipment(marca, modelo)").in("id", ids),
      supabase
        .from("service_orders")
        .select("id, numero, pmoc_plan_id, status, concluded_at")
        .in("pmoc_plan_id", ids),
    ]);
    if (plansRes.error) {
      return failWith("listPmocPlanDetails", plansRes.error, "Não foi possível carregar os detalhes dos planos PMOC. Tente novamente.");
    }
    if (osRes.error) {
      return failWith("listPmocPlanDetails", osRes.error, "Não foi possível carregar os detalhes dos planos PMOC. Tente novamente.");
    }

    type PlanRow = { id: string; equipment: { marca: string | null; modelo: string | null } | null };
    type OsRow = { id: string; numero: number; pmoc_plan_id: string; status: string; concluded_at: string | null };
    const planById = new Map(
      ((plansRes.data ?? []) as unknown as PlanRow[]).map((p) => [p.id, p]),
    );
    const osRows = (osRes.data ?? []) as unknown as OsRow[];

    return ok(
      base.data.map((item) => {
        const plan = planById.get(item.pmoc_plan_id);
        const doPlano = osRows.filter((os) => os.pmoc_plan_id === item.pmoc_plan_id);
        const concluidas = doPlano
          .filter((os) => os.status === "concluido" && os.concluded_at)
          .map((os) => os.concluded_at as string)
          .sort();
        const emAndamento = doPlano.find((os) => OS_EM_ANDAMENTO.includes(os.status));
        return {
          ...item,
          marca: plan?.equipment?.marca ?? null,
          modelo: plan?.equipment?.modelo ?? null,
          ultima_manutencao: concluidas.length
            ? dataLocalDe(concluidas[concluidas.length - 1])
            : null,
          os_id: emAndamento?.id ?? null,
          os_numero: emAndamento?.numero ?? null,
        };
      }),
    );
  } catch (error) {
    return failWith("listPmocPlanDetails", error, "Não foi possível carregar os detalhes dos planos PMOC. Tente novamente.");
  }
}

/** Manutenção PMOC concluída dentro do mês consultado (OS preventiva concluída). */
export interface PmocConcluidaItem {
  /** Data da conclusão, "YYYY-MM-DD". */
  data: string;
  os_id: string;
  os_numero: number;
  pmoc_plan_id: string | null;
  codigo_interno: string;
  equipamento_tipo: EquipmentType;
  cliente: string;
  predio: string;
}

/** OS preventivas PMOC concluídas no mês — eventos "concluída" do calendário. */
export async function listPmocConcluidasNoMes(
  params: PmocCalendarParams,
): Promise<Result<PmocConcluidaItem[]>> {
  const { year, month } = params;
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { data: null, error: "Mês inválido para o calendário PMOC." };
  }
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  try {
    if (isDemoMode) {
      const items = serviceOrdersFixture
        .filter(
          (os) =>
            os.tipo === "preventiva_pmoc" &&
            os.status === "concluido" &&
            os.concluded_at !== null &&
            os.equipment_id !== null,
        )
        .flatMap((os) => {
          const data = dataLocalDe(os.concluded_at as string);
          if (!data.startsWith(monthKey)) return [];
          const equipment = demoEquipment(os.equipment_id as string);
          if (!equipment) return [];
          const building = demoBuildingWithClient(equipment.building_id);
          return [{
            data,
            os_id: os.id,
            os_numero: os.numero,
            pmoc_plan_id: os.pmoc_plan_id,
            codigo_interno: equipment.codigo_interno,
            equipamento_tipo: equipment.tipo,
            cliente: building.client.razao_social,
            predio: building.nome,
          }];
        })
        .sort((a, b) => a.data.localeCompare(b.data));
      return ok(items);
    }

    const inicio = `${monthKey}-01`;
    const fim =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("service_orders")
      .select(
        "id, numero, pmoc_plan_id, concluded_at, equipment(codigo_interno, tipo, building:buildings(nome, client:clients(razao_social)))",
      )
      .eq("tipo", "preventiva_pmoc")
      .eq("status", "concluido")
      .not("equipment_id", "is", null)
      .gte("concluded_at", inicio)
      .lt("concluded_at", fim);
    if (error) {
      return failWith("listPmocConcluidasNoMes", error, "Não foi possível carregar as manutenções concluídas. Tente novamente.");
    }

    type Row = {
      id: string;
      numero: number;
      pmoc_plan_id: string | null;
      concluded_at: string | null;
      equipment: {
        codigo_interno: string;
        tipo: EquipmentType;
        building: { nome: string; client: { razao_social: string } | null } | null;
      } | null;
    };
    const items = ((data ?? []) as unknown as Row[])
      .flatMap((row) => {
        if (!row.equipment || !row.concluded_at) return [];
        return [{
          data: dataLocalDe(row.concluded_at),
          os_id: row.id,
          os_numero: row.numero,
          pmoc_plan_id: row.pmoc_plan_id,
          codigo_interno: row.equipment.codigo_interno,
          equipamento_tipo: row.equipment.tipo,
          cliente: row.equipment.building?.client?.razao_social ?? "—",
          predio: row.equipment.building?.nome ?? "—",
        }];
      })
      .filter((item) => item.data.startsWith(monthKey))
      .sort((a, b) => a.data.localeCompare(b.data));
    return ok(items);
  } catch (error) {
    return failWith("listPmocConcluidasNoMes", error, "Não foi possível carregar as manutenções concluídas. Tente novamente.");
  }
}

// ----------------------------------------------------------------------------
// Planos (CRUD): lista com relações, OS em aberto e situação calculada
// ----------------------------------------------------------------------------

export interface ListPmocPlansParams {
  /** Só planos de equipamentos deste cliente. */
  clientId?: string;
  /** Inclui planos encerrados (ativo = false). Default true. */
  incluirEncerrados?: boolean;
}

const OS_ABERTA: OsStatus[] = ["aberto", "agendado", "em_campo"];

function montarItem(
  plan: PmocPlan,
  rel: Pick<PmocPlanListItem, "equipment" | "building" | "client">,
  os: Array<{ id: string; numero: number; status: OsStatus }>,
  hoje: string,
): PmocPlanListItem {
  const s = situacaoPlano({
    proxima_data: plan.proxima_data,
    hoje,
    ativo: true,
    osStatus: os.map((o) => o.status),
  });
  const aberta = os.find((o) => OS_ABERTA.includes(o.status)) ?? null;
  return {
    ...plan,
    ...rel,
    os_aberta: aberta,
    dias_para_vencer: s.dias_para_vencer,
    situacao: s.situacao === "encerrado" ? "em_dia" : s.situacao,
  };
}

function ordenarPlanos(items: PmocPlanListItem[]): PmocPlanListItem[] {
  return items.sort(
    (a, b) =>
      Number(b.ativo) - Number(a.ativo) ||
      a.proxima_data.localeCompare(b.proxima_data) ||
      a.equipment.codigo_interno.localeCompare(b.equipment.codigo_interno, "pt-BR"),
  );
}

/**
 * Planos PMOC com equipamento, prédio, cliente, OS em aberto e situação pela
 * regra pura de components/pmoc/situacao.ts (mesma faixa da view do banco).
 */
export async function listPmocPlans(
  params: ListPmocPlansParams = {},
): Promise<Result<PmocPlanListItem[]>> {
  const incluirEncerrados = params.incluirEncerrados ?? true;
  const hoje = hojeBrt();
  try {
    if (isDemoMode) {
      const items: PmocPlanListItem[] = [];
      for (const plan of pmocPlansFixture) {
        if (!incluirEncerrados && !plan.ativo) continue;
        const equipment = demoEquipment(plan.equipment_id);
        if (!equipment) continue;
        const building = demoBuildingWithClient(equipment.building_id);
        if (params.clientId && building.client_id !== params.clientId) continue;
        const os = serviceOrdersFixture
          .filter((o) => o.pmoc_plan_id === plan.id)
          .map((o) => ({ id: o.id, numero: o.numero, status: o.status }));
        items.push(
          montarItem(
            plan,
            {
              equipment: {
                id: equipment.id,
                codigo_interno: equipment.codigo_interno,
                tipo: equipment.tipo,
                marca: equipment.marca,
                modelo: equipment.modelo,
                status: equipment.status,
              },
              building: { id: building.id, nome: building.nome },
              client: {
                id: building.client.id,
                razao_social: building.client.razao_social,
                nome_fantasia: building.client.nome_fantasia,
              },
            },
            os,
            hoje,
          ),
        );
      }
      return ok(ordenarPlanos(items));
    }

    const supabase = await createSupabase();
    let query = supabase
      .from("pmoc_plans")
      .select(
        "*, equipment:equipment!inner(id, codigo_interno, tipo, marca, modelo, status, building:buildings!inner(id, nome, client_id, client:clients!inner(id, razao_social, nome_fantasia)))",
      )
      .order("proxima_data", { ascending: true });
    if (!incluirEncerrados) query = query.eq("ativo", true);
    if (params.clientId) query = query.eq("equipment.building.client_id", params.clientId);

    const [plansRes, osRes] = await Promise.all([
      query,
      supabase
        .from("service_orders")
        .select("id, numero, status, pmoc_plan_id")
        .not("pmoc_plan_id", "is", null)
        .in("status", OS_ABERTA),
    ]);
    if (plansRes.error) {
      return failWith("listPmocPlans", plansRes.error, "Não foi possível carregar os planos PMOC. Tente novamente.");
    }
    if (osRes.error) {
      return failWith("listPmocPlans", osRes.error, "Não foi possível carregar os planos PMOC. Tente novamente.");
    }

    type Row = PmocPlan & {
      equipment: PmocPlanListItem["equipment"] & {
        building: { id: string; nome: string; client: PmocPlanListItem["client"] };
      };
    };
    const osPorPlano = new Map<string, Array<{ id: string; numero: number; status: OsStatus }>>();
    for (const o of (osRes.data ?? []) as Array<{ id: string; numero: number; status: OsStatus; pmoc_plan_id: string }>) {
      const list = osPorPlano.get(o.pmoc_plan_id) ?? [];
      list.push({ id: o.id, numero: o.numero, status: o.status });
      osPorPlano.set(o.pmoc_plan_id, list);
    }
    const items = ((plansRes.data ?? []) as unknown as Row[]).map((row) => {
      const { equipment, ...plan } = row;
      const { building, ...eq } = equipment;
      return montarItem(
        plan,
        {
          equipment: eq,
          building: { id: building.id, nome: building.nome },
          client: building.client,
        },
        osPorPlano.get(plan.id) ?? [],
        hoje,
      );
    });
    return ok(ordenarPlanos(items));
  } catch (error) {
    return failWith("listPmocPlans", error, "Não foi possível carregar os planos PMOC. Tente novamente.");
  }
}

export interface ChecklistOption {
  id: string;
  nome: string;
}

/** Modelos de checklist ativos de preventiva PMOC (select do plano). */
export async function listPmocChecklistOptions(): Promise<Result<ChecklistOption[]>> {
  try {
    if (isDemoMode) {
      return ok(
        checklistTemplatesFixture
          .filter((t) => t.ativo && t.tipo === "preventiva_pmoc")
          .map((t) => ({ id: t.id, nome: t.nome })),
      );
    }
    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("checklist_templates")
      .select("id, nome")
      .eq("ativo", true)
      .eq("tipo", "preventiva_pmoc")
      .order("nome");
    if (error) {
      return failWith("listPmocChecklistOptions", error, "Não foi possível carregar os checklists. Tente novamente.");
    }
    return ok((data ?? []) as ChecklistOption[]);
  } catch (error) {
    return failWith("listPmocChecklistOptions", error, "Não foi possível carregar os checklists. Tente novamente.");
  }
}
