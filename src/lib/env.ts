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

/**
 * Modo demo: o data layer serve fixtures locais (equivalentes ao seed.sql) e o
 * login não é exigido. Liga quando:
 * - DEMO_MODE=true explícito (inclusive em produção, para apresentações); ou
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

/** Lança erro claro se a produção subiu sem configuração do Supabase. */
export function assertRuntimeEnv(): void {
  if (isEnvMisconfigured) {
    throw new Error(
      "[env] Produção sem NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Configure as variáveis do Supabase no provedor de hospedagem ou defina DEMO_MODE=true " +
        "para rodar explicitamente em modo demonstração.",
    );
  }
}

/** URL pública do app (links de convite e recuperação de senha). */
export function siteUrl(): string {
  return (env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
