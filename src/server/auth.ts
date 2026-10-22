import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertRuntimeEnv, isDemoMode } from "@/lib/env";
import { profilesFixture } from "@/lib/fixtures";
import { homeFor } from "@/lib/nav";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type { Profile, Result, UserRole } from "@/lib/types";
import { fail, ok, safeErrorLog } from "./_shared";

/**
 * Autenticação e autorização no servidor (Server Components, Server Actions,
 * Route Handlers). O proxy só renova sessão e barra anônimos; quem decide
 * papel/ativo é este módulo — sempre chame um guard no início de cada action.
 *
 * Contrato do banco: usuário novo nasce role='tecnico', ativo=false;
 * get_my_role() retorna null se inativo (RLS nega tudo).
 */

export type SessionProfile = Profile & { email: string | null };

type SessionState =
  | { status: "ok"; profile: SessionProfile }
  | { status: "anon" }
  | { status: "inactive" };

const DEMO_PROFILE: SessionProfile = {
  ...(profilesFixture.find((p) => p.role === "admin") ?? profilesFixture[0]),
  email: "demo@leadclimatizacao.com.br",
};

/** Lê a sessão uma vez por requisição (React cache). */
const loadSession = cache(async (): Promise<SessionState> => {
  if (isDemoMode) return { status: "ok", profile: DEMO_PROFILE };
  assertRuntimeEnv();

  try {
    const supabase = await createSupabase();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const claims = claimsData?.claims;
    if (claimsError || !claims?.sub) return { status: "anon" };

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", claims.sub)
      .maybeSingle();
    if (error) {
      console.error("[auth] loadSession profile:", safeErrorLog(error));
      return { status: "inactive" };
    }
    const profile = data as Profile | null;
    if (!profile || !profile.ativo || !profile.role) return { status: "inactive" };

    const email = typeof claims.email === "string" ? claims.email : null;
    return { status: "ok", profile: { ...profile, email } };
  } catch (error) {
    console.error("[auth] loadSession:", safeErrorLog(error));
    return { status: "anon" };
  }
});

/** Encerra a sessão (rota que pode gravar cookies) e volta ao login. */
function redirectInactive(): never {
  redirect("/auth/sair?erro=inativo");
}

/**
 * Perfil do usuário logado (cacheado por requisição).
 * - null: sem sessão.
 * - Usuário inativo ou sem papel: encerra a sessão e redireciona para
 *   /login?erro=inativo (não retorna).
 * - Modo demo: perfil admin das fixtures.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const state = await loadSession();
  if (state.status === "inactive") redirectInactive();
  return state.status === "ok" ? state.profile : null;
}

/** Exige sessão ativa (Server Components). Sem sessão -> /login. */
export async function requireSession(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  return profile;
}

/**
 * Exige um dos papéis (Server Components / páginas). Sem sessão -> /login;
 * papel errado -> rota inicial do papel. Sem argumentos = qualquer papel.
 */
export async function requireRole(...roles: UserRole[]): Promise<SessionProfile> {
  const profile = await requireSession();
  if (roles.length > 0 && !roles.includes(profile.role)) redirect(homeFor(profile.role));
  return profile;
}

/**
 * Variante para Server Actions: nunca redireciona, devolve Result.
 * Uso: `const auth = await authorizeAction("admin"); if (auth.error) return …`
 */
export async function authorizeAction(...roles: UserRole[]): Promise<Result<SessionProfile>> {
  let state: SessionState;
  try {
    state = await loadSession();
  } catch (error) {
    console.error("[auth] authorizeAction:", safeErrorLog(error));
    return fail("Sem permissão");
  }
  if (state.status === "anon") return fail("Sessão expirada — entre novamente.");
  if (state.status === "inactive") return fail("Sem permissão");
  if (roles.length > 0 && !roles.includes(state.profile.role)) return fail("Sem permissão");
  return ok(state.profile);
}

/**
 * Variante para Route Handlers: não redireciona nem encerra a sessão; devolve
 * o status HTTP a responder. Anônimo -> 401; inativo/sem papel ou papel fora
 * da lista -> 403.
 */
export async function authorizeRoute(
  ...roles: UserRole[]
): Promise<{ status: 200; profile: SessionProfile } | { status: 401 | 403 }> {
  let state: SessionState;
  try {
    state = await loadSession();
  } catch (error) {
    console.error("[auth] authorizeRoute:", safeErrorLog(error));
    return { status: 401 };
  }
  if (state.status === "anon") return { status: 401 };
  if (state.status === "inactive") return { status: 403 };
  if (roles.length > 0 && !roles.includes(state.profile.role)) return { status: 403 };
  return { status: 200, profile: state.profile };
}

const uuid = z.uuid();

/**
 * Guard de OS para Server Actions: admin/atendente mexem em qualquer OS;
 * técnico só na OS atribuída a ele (technician_id = id do perfil).
 */
export async function authorizeServiceOrder(osId: string): Promise<Result<SessionProfile>> {
  const auth = await authorizeAction("admin", "atendente", "tecnico");
  if (auth.error !== null) return auth;
  const profile = auth.data;
  if (profile.role !== "tecnico" || isDemoMode) return auth;

  const id = uuid.safeParse(osId);
  if (!id.success) return fail("Sem permissão");
  try {
    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("service_orders")
      .select("technician_id")
      .eq("id", id.data)
      .maybeSingle();
    if (error) {
      console.error("[auth] authorizeServiceOrder:", safeErrorLog(error));
      return fail("Sem permissão");
    }
    if (!data || data.technician_id !== profile.id) return fail("Sem permissão");
    return auth;
  } catch (error) {
    console.error("[auth] authorizeServiceOrder:", safeErrorLog(error));
    return fail("Sem permissão");
  }
}
