import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest } from "next/server";

import { env } from "@/lib/env";

type PendingCookie = { name: string; value: string; options: CookieOptions };

export type SessionUpdate = {
  /** true se há usuário com JWT válido (verificado por getClaims). */
  authenticated: boolean;
  /** Cookies renovados que precisam ir na resposta. */
  cookies: PendingCookie[];
  /** Headers exigidos pelo Supabase quando há Set-Cookie (ex.: no-store). */
  headers: Record<string, string>;
};

/**
 * Padrão updateSession do @supabase/ssr adaptado ao proxy do Next 16:
 * renova o token (cookies) e valida o JWT via getClaims(). Não monta a
 * resposta — o proxy faz isso para poder injetar nonce/CSP nos headers.
 *
 * Os cookies renovados também são gravados em `request.cookies`, de modo que
 * Server Components desta mesma requisição já leiam a sessão nova.
 */
export async function updateSession(request: NextRequest): Promise<SessionUpdate> {
  const result: SessionUpdate = { authenticated: false, cookies: [], headers: {} };
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return result;
  }

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          result.cookies.push(...cookiesToSet);
          Object.assign(result.headers, headers ?? {});
        },
      },
    },
  );

  // Não coloque código entre createServerClient e getClaims (recomendação oficial).
  try {
    const { data, error } = await supabase.auth.getClaims();
    result.authenticated = !error && Boolean(data?.claims?.sub);
  } catch (error) {
    console.error("[proxy] updateSession:", error);
    result.authenticated = false;
  }
  return result;
}
