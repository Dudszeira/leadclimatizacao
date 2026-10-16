/**
 * Lock lógico contra cobrança/NFS-e duplicada.
 *
 * Antes de chamar o Asaas, a action faz um UPDATE condicional gravando um
 * marcador "pending:<epoch-ms>:<nonce>" em invoices.asaas_id (cobrança) ou
 * invoices.asaas_invoice_id (NFS-e) — só passa quem encontrar a coluna vazia
 * (ou um marcador velho). Dois cliques/abas simultâneos: só um chega ao Asaas.
 * As colunas têm unique parcial; o nonce garante marcadores distintos.
 *
 * Módulo puro — testado em tests/unit/financeiro-lock.test.ts.
 */

export const LOCK_PREFIX = "pending:";
/** Depois disso um marcador é considerado abandonado (processo caiu no meio). */
export const LOCK_TTL_MS = 10 * 60 * 1000;

export function newLock(now: number = Date.now()): string {
  const nonce = Math.random().toString(36).slice(2, 10).padEnd(8, "0");
  return `${LOCK_PREFIX}${now}:${nonce}`;
}

export function isLock(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith(LOCK_PREFIX);
}

/** true se é um marcador mais velho que o TTL (ou ilegível). */
export function isStaleLock(
  value: string | null | undefined,
  now: number = Date.now(),
  ttlMs: number = LOCK_TTL_MS,
): boolean {
  if (!isLock(value)) return false;
  const ts = Number(value.slice(LOCK_PREFIX.length).split(":")[0]);
  if (!Number.isFinite(ts)) return true;
  return now - ts > ttlMs;
}
