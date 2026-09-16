import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  ASAAS_API_KEY: z.string().optional(),
  ASAAS_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ASAAS_API_KEY: process.env.ASAAS_API_KEY,
  ASAAS_ENV: process.env.ASAAS_ENV,
});

/**
 * Enquanto o projeto Supabase do cliente não existe, o app roda em "modo demo":
 * o data layer serve fixtures locais equivalentes ao seed.sql. Assim que as
 * variáveis NEXT_PUBLIC_SUPABASE_* forem definidas, o modo demo desliga sozinho.
 */
export const isDemoMode =
  !env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
