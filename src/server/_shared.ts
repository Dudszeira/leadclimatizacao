import type { PageParams, Paginated, Result } from "@/lib/types";
// Import relativo (não "@/"): este módulo também roda nos testes vitest sem alias.
import { daysFromTodayBRT, monthStartBRT } from "../lib/format";

/**
 * Infra interna do data layer (ver README.md nesta pasta):
 * Result<T> em tudo, erro cru só no log do servidor, paginação 1-based.
 */

export const DEFAULT_PAGE_SIZE = 20;

export function ok<T>(data: T): Result<T> {
  return { data, error: null };
}

export function fail<T>(message: string): Result<T> {
  return { data: null, error: message };
}

/**
 * Reduz um erro (PostgREST/Postgres/Error) ao que é seguro logar: code e
 * message. `details`/`hint` do Postgres trazem valores de linha (ex.:
 * "Key (cnpj)=(...) already exists") — dado pessoal que não vai para log (LGPD).
 */
export function safeErrorLog(error: unknown): { code?: string; message: string } {
  if (error && typeof error === "object") {
    const e = error as { code?: unknown; message?: unknown; name?: unknown };
    const code = typeof e.code === "string" ? e.code : undefined;
    const raw = typeof e.message === "string" ? e.message : typeof e.name === "string" ? e.name : "erro";
    return code ? { code, message: scrubValues(raw) } : { message: scrubValues(raw) };
  }
  return { message: scrubValues(String(error)) };
}

/** Remove trechos "Key (col)=(valor)" e afins que alguns drivers põem na message. */
function scrubValues(message: string): string {
  return message.replace(/\(([^()]*)\)=\([^)]*\)/g, "($1)=(…)").slice(0, 300);
}

/** Loga só code + message (sem details/hint) e devolve a mensagem amigável em pt-BR. */
export function failWith<T>(context: string, error: unknown, message: string): Result<T> {
  console.error(`[data-layer] ${context}:`, safeErrorLog(error));
  return fail(message);
}

export function resolvePage(params?: PageParams): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(params?.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(params?.pageSize ?? DEFAULT_PAGE_SIZE)));
  return { page, pageSize };
}

/** Aplica paginação em memória (modo demo). */
export function paginate<T>(items: T[], params?: PageParams): Paginated<T> {
  const { page, pageSize } = resolvePage(params);
  const total = items.length;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Intervalo para .range() do Supabase (inclusive). */
export function pageRange(params?: PageParams): { from: number; to: number } {
  const { page, pageSize } = resolvePage(params);
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function toPaginated<T>(
  items: T[],
  total: number | null,
  params?: PageParams,
): Paginated<T> {
  const { page, pageSize } = resolvePage(params);
  const t = total ?? items.length;
  return {
    items,
    total: t,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(t / pageSize)),
  };
}

/** Normaliza para busca em memória: minúsculas e sem acentos. */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** true se algum dos campos contém o termo (busca demo, insensível a acento). */
export function matchesSearch(term: string, ...fields: Array<string | number | null | undefined>): boolean {
  const q = normalize(term.trim());
  if (!q) return true;
  return fields.some((f) => f != null && normalize(String(f)).includes(q));
}

/** Sanitiza um termo para uso em .or()/.ilike() do PostgREST. */
export function sanitizeIlike(term: string): string {
  return term.trim().replace(/[,()%_]/g, " ").replace(/\s+/g, " ").trim();
}

// ----------------------------------------------------------------------------
// Datas no fuso de Curitiba (America/Sao_Paulo)
// Implementação em src/lib/format.ts (pura, também usada no cliente); aqui
// ficam os nomes estáveis do data layer. Nunca use toISOString().slice(0, 10)
// para "hoje": em UTC o dia vira às 21h de Curitiba.
// ----------------------------------------------------------------------------

export {
  APP_TIME_ZONE,
  addDaysToDateKey,
  dateKeyBRT,
  startOfDayBRTISO,
  todayBRT,
} from "../lib/format";

/** "YYYY-MM-01" do mês corrente em Curitiba menos `monthsBack` meses. */
export function monthStartDate(monthsBack = 0, now: Date = new Date()): string {
  return monthStartBRT(monthsBack, now);
}

/** Diferença em dias entre "YYYY-MM-DD" e hoje em Curitiba (positivo = futuro). */
export function daysFromToday(isoDate: string, now: Date = new Date()): number {
  return daysFromTodayBRT(isoDate, now);
}

/** Instante ISO de N dias atrás (janelas móveis: "últimos 30 dias"). */
export function isoDaysAgo(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}
