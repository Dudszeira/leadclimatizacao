import { isDemoMode } from "@/lib/env";
import { leadsFixture } from "@/lib/fixtures";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type {
  Lead,
  LeadOrigin,
  LeadStage,
  PageParams,
  Paginated,
  Result,
} from "@/lib/types";
import {
  failWith,
  matchesSearch,
  ok,
  pageRange,
  paginate,
  sanitizeIlike,
  toPaginated,
} from "./_shared";

export interface ListLeadsParams extends PageParams {
  /** Busca por contato, empresa ou e-mail. */
  search?: string;
  estagio?: LeadStage;
  origem?: LeadOrigin;
}

export const LEAD_STAGES: LeadStage[] = [
  "lead",
  "reuniao_marcada",
  "reuniao_realizada",
  "venda",
  "perdido",
];

/** Lista paginada de leads, mais recentes primeiro. */
export async function listLeads(
  params: ListLeadsParams = {},
): Promise<Result<Paginated<Lead>>> {
  try {
    if (isDemoMode) {
      let items = [...leadsFixture];
      if (params.estagio) items = items.filter((l) => l.estagio === params.estagio);
      if (params.origem) items = items.filter((l) => l.origem === params.origem);
      const term = params.search;
      if (term) {
        items = items.filter((l) => matchesSearch(term, l.nome_contato, l.empresa, l.email));
      }
      items.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return ok(paginate(items, params));
    }

    const supabase = await createSupabase();
    const { from, to } = pageRange(params);
    let query = supabase
      .from("leads")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (params.estagio) query = query.eq("estagio", params.estagio);
    if (params.origem) query = query.eq("origem", params.origem);
    const q = params.search ? sanitizeIlike(params.search) : "";
    if (q) {
      query = query.or(`nome_contato.ilike.%${q}%,empresa.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      return failWith("listLeads", error, "Não foi possível carregar os leads. Tente novamente.");
    }
    return ok(toPaginated((data ?? []) as Lead[], count, params));
  } catch (error) {
    return failWith("listLeads", error, "Não foi possível carregar os leads. Tente novamente.");
  }
}

/** Leads agrupados por estágio (kanban do funil), mais recentes primeiro. */
export async function getLeadsBoard(): Promise<Result<Record<LeadStage, Lead[]>>> {
  try {
    let leads: Lead[];
    if (isDemoMode) {
      leads = [...leadsFixture].sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else {
      const supabase = await createSupabase();
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        return failWith("getLeadsBoard", error, "Não foi possível carregar o funil de leads. Tente novamente.");
      }
      leads = (data ?? []) as Lead[];
    }

    const board = Object.fromEntries(LEAD_STAGES.map((s) => [s, [] as Lead[]])) as Record<
      LeadStage,
      Lead[]
    >;
    for (const lead of leads) board[lead.estagio].push(lead);
    return ok(board);
  } catch (error) {
    return failWith("getLeadsBoard", error, "Não foi possível carregar o funil de leads. Tente novamente.");
  }
}

/** Lead por id. */
export async function getLead(id: string): Promise<Result<Lead | null>> {
  try {
    if (isDemoMode) {
      return ok(leadsFixture.find((l) => l.id === id) ?? null);
    }
    const supabase = await createSupabase();
    const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
    if (error) {
      return failWith("getLead", error, "Não foi possível carregar o lead. Tente novamente.");
    }
    return ok((data ?? null) as Lead | null);
  } catch (error) {
    return failWith("getLead", error, "Não foi possível carregar o lead. Tente novamente.");
  }
}
