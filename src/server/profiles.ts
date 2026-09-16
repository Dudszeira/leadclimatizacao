import { isDemoMode } from "@/lib/env";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type { Profile, Result } from "@/lib/types";
import { profilesFixture } from "./_demo";
import { failWith, ok } from "./_shared";

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
