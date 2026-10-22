/**
 * Período da tela de Orçamentos (searchParams `inicio` e `fim`, "YYYY-MM-DD",
 * BRT, inclusivos). Helpers puros, usados na página e no seletor.
 */

import { addDaysToDateKey, formatDateBR, monthStartBRT, todayBRT } from "@/lib/format"

export type PeriodoDatas = { inicio: string; fim: string }

export type AtalhoId = "mes" | "mes_passado" | "90d" | "ano"

const ISO = /^\d{4}-\d{2}-\d{2}$/

function valida(v: unknown): v is string {
  return typeof v === "string" && ISO.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`))
}

export function atalhosPeriodo(now: Date = new Date()): Array<{ id: AtalhoId; label: string; periodo: PeriodoDatas }> {
  const hoje = todayBRT(now)
  const ano = hoje.slice(0, 4)
  return [
    {
      id: "mes",
      label: "Este mês",
      periodo: { inicio: monthStartBRT(0, now), fim: addDaysToDateKey(monthStartBRT(-1, now), -1) },
    },
    {
      id: "mes_passado",
      label: "Mês passado",
      periodo: { inicio: monthStartBRT(1, now), fim: addDaysToDateKey(monthStartBRT(0, now), -1) },
    },
    { id: "90d", label: "Últimos 90 dias", periodo: { inicio: addDaysToDateKey(hoje, -89), fim: hoje } },
    { id: "ano", label: "Este ano", periodo: { inicio: `${ano}-01-01`, fim: `${ano}-12-31` } },
  ]
}

export function periodoPadrao(now: Date = new Date()): PeriodoDatas {
  return atalhosPeriodo(now)[0].periodo
}

/** Lê inicio/fim da URL; inválidos ou invertidos voltam ao mês atual. */
export function parsePeriodo(sp: Record<string, string | string[] | undefined>): PeriodoDatas & { padrao: boolean } {
  const { inicio, fim } = sp
  if (valida(inicio) && valida(fim) && inicio <= fim) {
    const p = periodoPadrao()
    return { inicio, fim, padrao: inicio === p.inicio && fim === p.fim }
  }
  return { ...periodoPadrao(), padrao: true }
}

/** "Este mês", "Mês passado"… ou "01/09/2026 a 30/09/2026". */
export function rotuloPeriodo(p: PeriodoDatas, now: Date = new Date()): string {
  const atalho = atalhosPeriodo(now).find((a) => a.periodo.inicio === p.inicio && a.periodo.fim === p.fim)
  if (atalho) return atalho.label
  if (p.inicio === p.fim) return formatDateBR(p.inicio)
  return `${formatDateBR(p.inicio)} a ${formatDateBR(p.fim)}`
}
