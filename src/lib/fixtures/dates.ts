/**
 * Helpers de datas relativas a `new Date()` — as fixtures nunca envelhecem.
 * Espelham as expressões do seed.sql:
 *   current_date - N            → dateOnly(addDays(today(), -N))
 *   (current_date - N)::timestamptz + interval 'H hours' → atHour(-N, H)
 *   now() - interval 'X'        → isoAgo(...)
 *   date_trunc('month', current_date) → monthStart(0)
 */

export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** "YYYY-MM-DD" no fuso local (equivalente a `date` do Postgres). */
export function dateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** current_date + offsetDays, como string "YYYY-MM-DD". */
export function dayOffset(offsetDays: number): string {
  return dateOnly(addDays(today(), offsetDays));
}

/** (current_date + offsetDays)::timestamptz + H horas [+ M minutos], ISO. */
export function atHour(offsetDays: number, hours: number, minutes = 0): string {
  const d = addDays(today(), offsetDays);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

/** now() - (dias/horas/minutos), ISO. */
export function isoAgo({
  days = 0,
  hours = 0,
  minutes = 0,
}: {
  days?: number;
  hours?: number;
  minutes?: number;
}): string {
  const ms = ((days * 24 + hours) * 60 + minutes) * 60_000;
  return new Date(Date.now() - ms).toISOString();
}

/** Primeiro dia do mês corrente - monthsBack meses, "YYYY-MM-DD". */
export function monthStart(monthsBack = 0): string {
  const d = today();
  d.setDate(1);
  return dateOnly(addMonths(d, -monthsBack));
}

/** Data-only + offset em dias, "YYYY-MM-DD". */
export function dateOnlyPlusDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return dateOnly(addDays(new Date(y, m - 1, d), days));
}

/** "YYYY-MM-DD" → Date local à meia-noite. */
export function parseDateOnly(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const NOW_ISO = new Date().toISOString();

/** created_at/updated_at padrão das fixtures. */
export function stamps(createdAt: string = NOW_ISO): {
  created_at: string;
  updated_at: string;
} {
  return { created_at: createdAt, updated_at: createdAt };
}
