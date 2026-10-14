import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  ASAAS_API_KEY: z.string().optional(),
  ASAAS_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  ASAAS_WEBHOOK_TOKEN: z.string().optional(),
  DEMO_MODE: z.string().optional(),
});

/** Vazio conta como ausente (o .env.example traz as chaves sem valor). */
function read(value: string | undefined): string | undefined {
  return value && value.trim() ? value.trim() : undefined;
}

export const env = envSchema.parse({
  // NEXT_PUBLIC_* precisam ser lidas literalmente para o Next embutir no bundle.
  NEXT_PUBLIC_SUPABASE_URL: read(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: read(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  NEXT_PUBLIC_SITE_URL: read(process.env.NEXT_PUBLIC_SITE_URL),
  SUPABASE_SERVICE_ROLE_KEY: read(process.env.SUPABASE_SERVICE_ROLE_KEY),
  ASAAS_API_KEY: read(process.env.ASAAS_API_KEY),
  ASAAS_ENV: read(process.env.ASAAS_ENV),
  ASAAS_WEBHOOK_TOKEN: read(process.env.ASAAS_WEBHOOK_TOKEN),
  DEMO_MODE: read(process.env.DEMO_MODE),
});

const supabaseMissing =
  !env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const explicitDemo = env.DEMO_MODE === "true";
const isProduction = process.env.NODE_ENV === "production";
/** `next build` roda com NODE_ENV=production; o build sem .env precisa passar. */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
const isServer = typeof window === "undefined";
/** Deploy de produção na Vercel (preview/development não contam). */
const isVercelProduction = process.env.VERCEL_ENV === "production";

/**
 * DEMO_MODE=true desliga login e serve fixtures: nunca pode valer num deploy
 * de produção nem num ambiente que tem a chave service_role (banco real).
 * Checado só no servidor (no browser essas variáveis não existem).
 */
function demoModeConflict(): string | null {
  if (!explicitDemo || !isServer) return null;
  if (isVercelProduction) {
    return "[env] DEMO_MODE=true é proibido em produção (VERCEL_ENV=production). Remova DEMO_MODE do ambiente de produção.";
  }
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    return "[env] DEMO_MODE=true não pode ser usado junto com SUPABASE_SERVICE_ROLE_KEY (ambiente com banco real). Remova uma das duas variáveis.";
  }
  return null;
}

const demoConflict = demoModeConflict();
if (demoConflict) throw new Error(demoConflict);

/**
 * Modo demo: o data layer serve fixtures locais (equivalentes ao seed.sql) e o
 * login não é exigido. Liga quando:
 * - DEMO_MODE=true explícito (apresentações; proibido com VERCEL_ENV=production
 *   ou com SUPABASE_SERVICE_ROLE_KEY definida — ver demoModeConflict); ou
 * - Supabase ausente fora de produção (dev local) ou durante o `next build`.
 *
 * Em produção sem DEMO_MODE=true e sem Supabase o app NÃO cai em demo em
 * silêncio: `assertRuntimeEnv()` falha alto (ver proxy e auth).
 */
export const isDemoMode =
  explicitDemo || (supabaseMissing && (!isProduction || isBuildPhase));

/** true quando o deploy de produção está sem as variáveis do Supabase. */
export const isEnvMisconfigured =
  !explicitDemo && supabaseMissing && isProduction && !isBuildPhase;

/** Produção real (não demo, fora do build) exige NEXT_PUBLIC_SITE_URL. */
const siteUrlMissing =
  !isDemoMode && isProduction && !isBuildPhase && isServer && !env.NEXT_PUBLIC_SITE_URL;

/** Lança erro claro se a produção subiu sem a configuração obrigatória. */
export function assertRuntimeEnv(): void {
  if (isEnvMisconfigured) {
    throw new Error(
      "[env] Produção sem NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Configure as variáveis do Supabase no provedor de hospedagem ou defina DEMO_MODE=true " +
        "para rodar explicitamente em modo demonstração.",
    );
  }
  if (siteUrlMissing) {
    throw new Error(
      "[env] Produção sem NEXT_PUBLIC_SITE_URL. Defina a URL pública do app (ex.: https://controllead.com.br): " +
        "links de convite e de recuperação de senha só usam essa variável em produção.",
    );
  }
}

/**
 * Origem pública do app para links enviados por e-mail (convite, reset).
 * Produção: SÓ NEXT_PUBLIC_SITE_URL (nunca headers do request — Host /
 * X-Forwarded-Host são controláveis pelo cliente). Dev: cai para o host da
 * requisição (`devHost`) ou localhost.
 */
export function publicOrigin(devHost?: { host: string | null; proto: string | null }): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  if (isProduction) {
    throw new Error("[env] NEXT_PUBLIC_SITE_URL é obrigatória em produção para gerar links públicos.");
  }
  const host = devHost?.host ?? "localhost:3000";
  const proto = devHost?.proto ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** URL pública do app (links de convite e recuperação de senha). */
export function siteUrl(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
