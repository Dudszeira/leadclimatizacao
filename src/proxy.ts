import { NextResponse, type NextRequest } from "next/server";

import { assertRuntimeEnv, env, isDemoMode } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy (antigo middleware) — roda em toda navegação de página:
 * 1. Gera um nonce por requisição e a Content-Security-Policy correspondente
 *    (o Next aplica o nonce sozinho nos scripts do framework).
 * 2. Renova a sessão Supabase (padrão updateSession) e manda quem não está
 *    logado para /login?next=<caminho>. Rotas públicas: /login, /auth/*.
 *    /api/webhooks/* nem passa por aqui (matcher).
 * 3. Em modo demo não exige login.
 *
 * A autorização de verdade (papel, ativo) acontece no servidor, em
 * src/server/auth.ts — o proxy é só a primeira barreira.
 */

const PUBLIC_PATHS = ["/login", "/auth"];

/** Route Handlers que devolvem PDF (ex.: /api/orcamentos/<id>/pdf). */
const PDF_ROUTE = /^\/api\/orcamentos\/[^/]+\/pdf$/;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function buildCsp(nonce: string, request: NextRequest): string {
  const isDev = process.env.NODE_ENV === "development";
  const supabase = originOf(env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : null;
  const isHttps = request.nextUrl.protocol === "https:";

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // strict-dynamic: só roda script com o nonce (e o que ele carregar).
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // Leaflet, Recharts, Sonner e Base UI usam atributo style inline.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://tile.openstreetmap.org",
      "https://*.tile.openstreetmap.org",
      ...(supabase ? [supabase] : []),
    ],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      ...(supabase ? [supabase] : []),
      ...(supabaseWs ? [supabaseWs] : []),
      ...(isDev ? ["ws:"] : []),
    ],
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
  return isHttps ? `${policy}; upgrade-insecure-requests` : policy;
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, request);
  const { pathname, search } = request.nextUrl;

  let authenticated = isDemoMode;
  let pendingCookies: Awaited<ReturnType<typeof updateSession>>["cookies"] = [];
  let pendingHeaders: Record<string, string> = {};

  if (!isDemoMode) {
    // Produção sem Supabase e sem DEMO_MODE=true: falha alto, não cai em demo.
    assertRuntimeEnv();
    const session = await updateSession(request);
    authenticated = session.authenticated;
    pendingCookies = session.cookies;
    pendingHeaders = session.headers;
  }

  let response: NextResponse;
  if (!authenticated && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    response = NextResponse.redirect(loginUrl);
  } else {
    // Headers da requisição (com os cookies já renovados) + nonce para o render.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    // Caminho atual para o layout do console checar papel x rota no load.
    requestHeaders.set("x-pathname", pathname);
    requestHeaders.set("Content-Security-Policy", csp);
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );
  Object.entries(pendingHeaders).forEach(([key, value]) => response.headers.set(key, value));
  // PDF não é HTML: a CSP de página (object-src 'none', frame-ancestors) só
  // atrapalha o visualizador de PDF do navegador ao abrir em nova aba.
  if (!PDF_ROUTE.test(pathname)) response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Tudo, exceto:
     * - api/webhooks (Asaas autentica por token próprio)
     * - _next/static, _next/image (assets do build)
     * - arquivos estáticos com extensão (favicon, imagens, fontes...)
     */
    "/((?!api/webhooks|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|txt|xml|webmanifest)$).*)",
  ],
};
