import { env } from "@/lib/env";
import { mapAsaasError } from "./errors";
import type { AsaasErrorBody } from "./types";

/**
 * Cliente HTTP tipado do Asaas — SÓ SERVIDOR (a chave nunca chega ao browser).
 *
 * - Base URL decidida por env.ASAAS_ENV (sandbox por padrão, até a conta real
 *   da Lead Climatização ser aprovada).
 * - Autenticação pelo header `access_token` (env.ASAAS_API_KEY).
 * - Erros da API viram AsaasError com mensagem PRÓPRIA (errors.ts); a descrição
 *   crua do Asaas só vai para o log do servidor, SEM a chave (nunca logamos headers).
 */

const BASE_URLS: Record<"sandbox" | "production", string> = {
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
};

/** true quando a chave do Asaas está configurada no ambiente. */
export function isAsaasConfigured(): boolean {
  return Boolean(env.ASAAS_API_KEY);
}

export class AsaasError extends Error {
  /** HTTP status da resposta (0 = falha de rede). */
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AsaasError";
    this.status = status;
  }
}

export interface AsaasFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Serializado como JSON no corpo. */
  body?: unknown;
  /** Query string (valores undefined são omitidos). */
  query?: Record<string, string | number | undefined>;
}

/**
 * Chama a API do Asaas e resolve com o JSON tipado. Lança AsaasError com
 * mensagem pt-BR em qualquer falha (rede, auth, validação, 5xx).
 */
export async function asaasFetch<T>(
  path: string,
  options: AsaasFetchOptions = {},
): Promise<T> {
  const apiKey = env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new AsaasError(
      "Asaas ainda não configurado — defina ASAAS_API_KEY no ambiente.",
      0,
    );
  }

  const url = new URL(`${BASE_URLS[env.ASAAS_ENV]}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        access_token: apiKey,
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "control-lead",
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    // Loga só a causa da falha de rede — nunca headers/chave.
    console.error(`[asaas] falha de rede em ${options.method ?? "GET"} ${path}:`, error);
    throw new AsaasError(mapAsaasError(0), 0);
  }

  if (!response.ok) {
    let body: AsaasErrorBody | null = null;
    try {
      body = (await response.json()) as AsaasErrorBody;
    } catch {
      // Corpo não-JSON (ex.: HTML de erro) — segue com mensagem genérica.
    }
    console.error(
      `[asaas] ${options.method ?? "GET"} ${path} → HTTP ${response.status}`,
      body?.errors ?? "(sem corpo de erro)",
    );
    throw new AsaasError(mapAsaasError(response.status, body?.errors), response.status);
  }

  return (await response.json()) as T;
}
