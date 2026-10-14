// Fuso de Curitiba explícito: o servidor roda em UTC e, sem isso, entre 21h e
// 23h59 BRT o "hoje" das fixtures seria amanhã. Import relativo para os testes.
import { addDaysToDateKey, dateKeyBRT, startOfDayBRTISO, todayBRT } from "../format";

/**
 * Helpers de datas relativas a `new Date()` — as fixtures nunca envelhecem.
 * Espelham as expressões do seed.sql:
 *   current_date - N            → dateOnly(addDays(today(), -N))
 *   (current_date - N)::timestamptz + interval 'H hours' → atHour(-N, H)
 *   now() - interval 'X'        → isoAgo(...)
 *   date_trunc('month', current_date) → monthStart(0)
 */

const DAY_MS = 86_400_000;

/** Meia-noite de hoje em Curitiba (instante). */
export function today(): Date {
  return new Date(startOfDayBRTISO(todayBRT()));
}

/** base + N dias (BRT não tem horário de verão: 24h exatas por dia). */
export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

/** base + N meses, preservando a hora do dia em Curitiba. */
export function addMonths(base: Date, months: number): Date {
  const key = dateKeyBRT(base);
  const [y, m, d] = key.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
  const msIntoDay = base.getTime() - new Date(startOfDayBRTISO(key)).getTime();
  return new Date(new Date(startOfDayBRTISO(target)).getTime() + msIntoDay);
}

/** "YYYY-MM-DD" no fuso de Curitiba (equivalente a `date` do Postgres em BRT). */
export function dateOnly(d: Date): string {
  return dateKeyBRT(d);
}

/** current_date + offsetDays, como string "YYYY-MM-DD". */
export function dayOffset(offsetDays: number): string {
  return addDaysToDateKey(todayBRT(), offsetDays);
}

/** (hoje BRT + offsetDays) às H[:M] de Curitiba, ISO. */
export function atHour(offsetDays: number, hours: number, minutes = 0): string {
  const base = new Date(startOfDayBRTISO(dayOffset(offsetDays)));
  return new Date(base.getTime() + (hours * 60 + minutes) * 60_000).toISOString();
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

/** Primeiro dia do mês corrente (Curitiba) - monthsBack meses, "YYYY-MM-DD". */
export function monthStart(monthsBack = 0): string {
  const [y, m] = todayBRT().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 - monthsBack, 1)).toISOString().slice(0, 10);
}

/** Data-only + offset em dias, "YYYY-MM-DD". */
export function dateOnlyPlusDays(isoDate: string, days: number): string {
  return addDaysToDateKey(isoDate, days);
}

/** "YYYY-MM-DD" → meia-noite de Curitiba daquela data (instante). */
export function parseDateOnly(isoDate: string): Date {
  return new Date(startOfDayBRTISO(isoDate));
}

const NOW_ISO = new Date().toISOString();

/** created_at/updated_at padrão das fixtures. */
export function stamps(createdAt: string = NOW_ISO): {
  created_at: string;
  updated_at: string;
} {
  return { created_at: createdAt, updated_at: createdAt };
}
