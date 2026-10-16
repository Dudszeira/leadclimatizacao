import { isDemoMode } from "@/lib/env";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type { Profile, Result } from "@/lib/types";
import { profilesFixture } from "./_demo";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeAction } from "./auth";
import { fail, failWith, normalize, ok } from "./_shared";

/** Técnicos ativos, ordenados por nome (Select de designação de OS). */
export async function listTechnicians(): Promise<Result<Profile[]>> {
  try {
    if (isDemoMode) {
      const items = profilesFixture
        .filter((p) => p.role === "tecnico" && p.ativo)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
      return ok(items);
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "tecnico")
      .eq("ativo", true)
      .order("full_name", { ascending: true });
    if (error) {
      return failWith("listTechnicians", error, "Não foi possível carregar os técnicos. Tente novamente.");
    }
    return ok((data ?? []) as Profile[]);
  } catch (error) {
    return failWith("listTechnicians", error, "Não foi possível carregar os técnicos. Tente novamente.");
  }
}

/** Membro da equipe na tela /equipe (perfil + dados da conta de login). */
export interface TeamMember extends Profile {
  email: string | null;
  /** Convite enviado e ainda não aceito (senha não definida). */
  pendingInvite: boolean;
  lastSignInAt: string | null;
}

/**
 * Lista toda a equipe com e-mail (Auth Admin API via service role).
 * Só admin: o guard roda aqui também, antes de tocar na service role.
 */
export async function listTeam(): Promise<Result<TeamMember[]>> {
  const auth = await authorizeAction("admin");
  if (auth.error !== null) return fail(auth.error);

  try {
    if (isDemoMode) {
      const items = [...profilesFixture]
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"))
        .map((p) => ({
          ...p,
          email: `${normalize(p.full_name.split(" ")[0])}@leadclimatizacao.com.br`,
          pendingInvite: false,
          lastSignInAt: null,
        }));
      return ok(items);
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true });
    if (error) {
      return failWith("listTeam", error, "Não foi possível carregar a equipe. Tente novamente.");
    }

    const admin = createAdminClient();
    const users = new Map<string, { email: string | null; pending: boolean; last: string | null }>();
    for (let page = 1; page <= 20; page++) {
      const { data: list, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (listError) {
        return failWith("listTeam.listUsers", listError, "Não foi possível carregar os e-mails da equipe.");
      }
      for (const u of list.users) {
        users.set(u.id, {
          email: u.email ?? null,
          pending: Boolean(u.invited_at) && !u.email_confirmed_at && !u.last_sign_in_at,
          last: u.last_sign_in_at ?? null,
        });
      }
      if (list.users.length < 200) break;
    }

    const items = ((data ?? []) as Profile[]).map((p) => {
      const u = users.get(p.id);
      return {
        ...p,
        email: u?.email ?? null,
        pendingInvite: u?.pending ?? false,
        lastSignInAt: u?.last ?? null,
      };
    });
    return ok(items);
  } catch (error) {
    return failWith("listTeam", error, "Não foi possível carregar a equipe. Tente novamente.");
  }
}
