/**
 * Datas do financeiro no fuso de Curitiba (America/Sao_Paulo), espelhando
 * public.hoje_brt() do banco. Nunca use `new Date().toISOString()` para
 * "hoje": em UTC, das 21h às 23h59 BRT a data já é a do dia seguinte.
 *
 * Módulo puro (sem imports de runtime do app) — seguro em testes e no client.
 */

export const BRT_TIMEZONE = "America/Sao_Paulo";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BRT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" de hoje em BRT. */
export function todayBRT(now: Date = new Date()): string {
  return ymdFormatter.format(now);
}

/** Competência ("YYYY-MM-01") do mês corrente em BRT menos `monthsBack` meses. */
export function competenciaBRT(monthsBack = 0, now: Date = new Date()): string {
  const [y, m] = todayBRT(now).split("-").map(Number);
  const total = y * 12 + (m - 1) - monthsBack;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}-01`;
}

/** Normaliza qualquer "YYYY-MM-DD" para o primeiro dia do mês. */
export function toCompetencia(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`;
}

/** true se a string é uma competência válida "YYYY-MM-01". */
export function isCompetencia(value: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100;
}

/** "YYYY-MM-DD" + N dias (aritmética de calendário, sem fuso). */
export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/**
 * Vencimento da fatura de uma competência — mesma regra do banco
 * (_generate_monthly_invoices_job): competência + (dia_vencimento - 1).
 * dia_vencimento é limitado a 1..28 (check do schema).
 */
export function vencimentoFor(competencia: string, diaVencimento: number): string {
  const dia = Math.min(28, Math.max(1, Math.trunc(diaVencimento)));
  return addDaysISO(toCompetencia(competencia), dia - 1);
}

/**
 * Vencimento a enviar ao Asaas: o Asaas recusa dueDate no passado, então
 * uma fatura já vencida é cobrada com vencimento hoje (BRT).
 */
export function dueDateForCharge(vencimento: string | null, now: Date = new Date()): string {
  const hoje = todayBRT(now);
  if (!vencimento) return hoje;
  return vencimento < hoje ? hoje : vencimento;
}

/** Data de pagamento do Asaas ("YYYY-MM-DD", BRT) → timestamptz ISO ao meio-dia BRT. */
export function paidAtFromAsaasDate(paymentDate: string | null | undefined, now: Date = new Date()): string {
  if (paymentDate && /^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    return new Date(`${paymentDate}T12:00:00-03:00`).toISOString();
  }
  return now.toISOString();
}
