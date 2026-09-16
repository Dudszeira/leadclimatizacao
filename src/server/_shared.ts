import type { PageParams, Paginated, Result } from "@/lib/types";

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

/** Loga o erro cru no servidor e devolve a mensagem amigável em pt-BR. */
export function failWith<T>(context: string, error: unknown, message: string): Result<T> {
  console.error(`[data-layer] ${context}:`, error);
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

/** "YYYY-MM" ou "YYYY-MM-DD" do primeiro dia do mês corrente - monthsBack. */
export function monthStartDate(monthsBack = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - monthsBack);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/** Diferença em dias entre uma data "YYYY-MM-DD" e hoje (positivo = futuro). */
export function daysFromToday(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
