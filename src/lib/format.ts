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
// Datas e horas
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

/** ISO → "dd/mm/aaaa" no fuso local. */
export function formatDateTimeBR(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("pt-BR")
}

/** ISO → "dd/mm/aaaa às 14h05". */
export function formatDateTimeFullBR(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return `${d.toLocaleDateString("pt-BR")} às ${horaMin(d)}`
}

/** ISO → "14h05". */
export function formatHourBR(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return horaMin(d)
}

function horaMin(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}h${String(d.getMinutes()).padStart(2, "0")}`
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Hora da lista de conversas: "14h05" hoje, "Ontem" ou "12/09". */
export function formatListTime(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  if (isSameDay(d, now)) return horaMin(d)
  const ontem = new Date(now)
  ontem.setDate(now.getDate() - 1)
  if (isSameDay(d, ontem)) return "Ontem"
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

/** Timestamp da bolha: "14h05" hoje, senão "12/09 · 14h05". */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const hora = horaMin(d)
  if (isSameDay(d, new Date())) return hora
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  return `${data} · ${hora}`
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
