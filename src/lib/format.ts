/**
 * Formatadores pt-BR compartilhados por todos os módulos do console.
 * Helpers puros, sem dependência de React — usados na UI e em server actions.
 */

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 })

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

const moedaInteira = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
})

const decimal = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

const numberBR = new Intl.NumberFormat("pt-BR")

export function formatInteiro(valor: number): string {
  return inteiro.format(valor)
}

/** 8900 → "R$ 8.900,00". */
export function formatBRL(valor: number): string {
  return moeda.format(valor)
}

/** 45000 → "R$ 45.000" (KPIs, sem centavos). */
export function formatBRLInteiro(valor: number): string {
  return moedaInteira.format(valor)
}

/** 12.5 → "12,5%" — "—" quando null (denominador zero). */
export function formatPct(valor: number | null): string {
  if (valor === null) return "—"
  return `${decimal.format(valor)}%`
}

/** Minutos → "48s" abaixo de 1 min, senão "3,2 min"; "—" sem dados. */
export function formatMinutos(minutos: number | null): string {
  if (minutos === null) return "—"
  if (minutos < 1) return `${Math.round(minutos * 60)}s`
  return `${decimal.format(minutos)} min`
}

export function formatBtu(value: number | null): string {
  if (value == null) return "—"
  return `${numberBR.format(value)} BTU`
}

// ---------------------------------------------------------------------------
// Fuso horário da operação (America/Sao_Paulo)
// ---------------------------------------------------------------------------
// O servidor (Vercel) roda em UTC: entre 21h e 23h59 de Curitiba o "hoje" em
// UTC já é amanhã. Toda conta de calendário passa por estes helpers, que usam
// Intl com timeZone explícito e não dependem do TZ da máquina.

/** Fuso de referência do negócio (Curitiba, sem horário de verão desde 2019). */
export const APP_TIME_ZONE = "America/Sao_Paulo"

const ymdBRT = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const horaMinBRT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

const diaMesBRT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
})

const dataBRT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const diaSemanaBRT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIME_ZONE,
  weekday: "short",
})

function toDate(value: Date | string): Date | null {
  const d = typeof value === "string" ? new Date(value) : value
  return Number.isNaN(d.getTime()) ? null : d
}

/** Data civil "YYYY-MM-DD" de um instante, no fuso de Curitiba. */
export function dateKeyBRT(value: Date | string): string {
  const d = toDate(value)
  return d ? ymdBRT.format(d) : ""
}

/** Hoje em Curitiba, "YYYY-MM-DD" (equivale a public.hoje_brt()). */
export function todayBRT(now: Date = new Date()): string {
  return ymdBRT.format(now)
}

/** Soma dias a uma data civil "YYYY-MM-DD" (aritmética pura, sem fuso). */
export function addDaysToDateKey(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return t.toISOString().slice(0, 10)
}

/** Primeiro dia do mês corrente em Curitiba menos `monthsBack` meses, "YYYY-MM-01". */
export function monthStartBRT(monthsBack = 0, now: Date = new Date()): string {
  const [y, m] = todayBRT(now).split("-").map(Number)
  const t = new Date(Date.UTC(y, m - 1 - monthsBack, 1))
  return t.toISOString().slice(0, 10)
}

/** Dias entre uma data "YYYY-MM-DD" e hoje em Curitiba (positivo = futuro). */
export function daysFromTodayBRT(isoDate: string, now: Date = new Date()): number {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number)
  const [ty, tm, td] = todayBRT(now).split("-").map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000)
}

/**
 * Instante (ISO UTC) da meia-noite de Curitiba de uma data civil. Usa o
 * deslocamento real do fuso naquela data (Intl), não um -03:00 fixo.
 */
export function startOfDayBRTISO(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number)
  const utcMidnight = Date.UTC(y, m - 1, d)
  const offsetMin = timeZoneOffsetMinutes(new Date(utcMidnight + 12 * 3_600_000))
  return new Date(utcMidnight - offsetMin * 60_000).toISOString()
}

/** Deslocamento de Curitiba em minutos relativo ao UTC (ex.: -180). */
function timeZoneOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    timeZoneName: "longOffset",
  }).formatToParts(at)
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-03:00"
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name)
  if (!match) return 0
  const sign = match[1] === "-" ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0))
}

// ---------------------------------------------------------------------------
// Datas e horas (exibição sempre no fuso de Curitiba)
// ---------------------------------------------------------------------------

/** "YYYY-MM-DD" → "dd/mm/aaaa" sem risco de fuso deslocar o dia. */
export function formatDateBR(isoDate: string | null): string {
  if (!isoDate) return "—"
  const [y, m, d] = isoDate.slice(0, 10).split("-")
  if (!y || !m || !d) return "—"
  return `${d}/${m}/${y}`
}

/** "2026-09-01" → "set/2026". */
export function formatCompetencia(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number)
  if (!y || !m) return "—"
  const label = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  })
  return label.replace(". de ", "/").replace(" de ", "/")
}

/** "2026-09-01" → "setembro de 2026" (opções do filtro). */
export function formatCompetenciaLonga(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number)
  if (!y || !m) return "—"
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  })
}

/** ISO → "dd/mm/aaaa" no fuso de Curitiba. */
export function formatDateTimeBR(iso: string | null): string {
  if (!iso) return "—"
  const d = toDate(iso)
  return d ? dataBRT.format(d) : "—"
}

/** ISO → "dd/mm/aaaa às 14h05" (Curitiba). */
export function formatDateTimeFullBR(iso: string | null): string {
  if (!iso) return "—"
  const d = toDate(iso)
  if (!d) return "—"
  return `${dataBRT.format(d)} às ${horaMin(d)}`
}

/** ISO → "14h05" (Curitiba). */
export function formatHourBR(iso: string | null): string {
  if (!iso) return "—"
  const d = toDate(iso)
  return d ? horaMin(d) : "—"
}

/** ISO → "qua 15/10 · 14h" (agenda compacta, Curitiba). */
export function formatAgendaCurtaBR(iso: string | null): string {
  if (!iso) return "—"
  const d = toDate(iso)
  if (!d) return "—"
  const semana = diaSemanaBRT.format(d).replace(".", "")
  const hora = horaMinBRT.format(d).slice(0, 2)
  return `${semana} ${diaMesBRT.format(d)} · ${hora}h`
}

function horaMin(d: Date): string {
  const [h, m] = horaMinBRT.format(d).split(":")
  return `${h}h${m}`
}

/** Hora da lista de conversas: "14h05" hoje, "Ontem" ou "12/09". */
export function formatListTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return ""
  const d = toDate(iso)
  if (!d) return ""
  const dia = dateKeyBRT(d)
  const hoje = todayBRT(now)
  if (dia === hoje) return horaMin(d)
  if (dia === addDaysToDateKey(hoje, -1)) return "Ontem"
  return diaMesBRT.format(d)
}

/** Timestamp da bolha: "14h05" hoje, senão "12/09 · 14h05". */
export function formatMessageTime(iso: string, now: Date = new Date()): string {
  const d = toDate(iso)
  if (!d) return ""
  const hora = horaMin(d)
  if (dateKeyBRT(d) === todayBRT(now)) return hora
  return `${diaMesBRT.format(d)} · ${hora}`
}

// ---------------------------------------------------------------------------
// Identificadores, documentos e máscaras
// ---------------------------------------------------------------------------

/** 1004 → "#1004" (exibido em mono). */
export function formatOsNumero(numero: number): string {
  return `#${numero}`
}

/** "Carlos Menezes" → "CM" (iniciais para o avatar). */
export function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return `${first}${last}`.toUpperCase()
}

/** "50000000-.../antes/condensador-01.jpg" → "condensador-01.jpg". */
export function fileBasename(path: string): string {
  const clean = path.split("?")[0]
  return clean.slice(clean.lastIndexOf("/") + 1) || clean
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "")
}

/** Aplica a máscara 00.000.000/0000-00 progressivamente durante a digitação. */
export function maskCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14)
  let out = d
  if (d.length > 2) out = `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length > 5) out = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length > 8)
    out = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  if (d.length > 12)
    out = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  return out
}

/** Validação dos dígitos verificadores do CNPJ (módulo 11). */
export function isValidCnpj(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false

  const digits = d.split("").map(Number)
  const calc = (length: number) => {
    let weight = length - 7
    let sum = 0
    for (let i = 0; i < length; i++) {
      sum += digits[i] * weight
      weight -= 1
      if (weight < 2) weight = 9
    }
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  return calc(12) === digits[12] && calc(13) === digits[13]
}

/** Máscara progressiva de telefone: (41) 3222-1010 ou (41) 99999-9999. */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length === 0) return ""
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** "+554133303030" → "(41) 3330-3030" · "+5541998223302" → "(41) 99822-3302". */
export function formatTelefoneBR(e164: string): string {
  let d = onlyDigits(e164)
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2)
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  return e164
}
