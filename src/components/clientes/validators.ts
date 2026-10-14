/**
 * Validadores e máscaras puros dos cadastros (CPF/CNPJ, CEP, UF, números BR).
 * Sem React e sem dependências de servidor: usados nos formulários, nas
 * server actions e no parser de importação CSV.
 */

import { isValidCnpj, maskCnpj, onlyDigits } from "../../lib/format"

export { isValidCnpj, maskCnpj, onlyDigits }

/** Validação dos dígitos verificadores do CPF (módulo 11). */
export function isValidCpf(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false
  const digits = d.split("").map(Number)
  const calc = (length: number) => {
    let sum = 0
    for (let i = 0; i < length; i++) sum += digits[i] * (length + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return calc(9) === digits[9] && calc(10) === digits[10]
}

/** Máscara progressiva 000.000.000-00. */
export function maskCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** CPF (11 dígitos) ou CNPJ (14 dígitos) válido. */
export function isValidDocumento(value: string): boolean {
  const d = onlyDigits(value)
  if (d.length === 11) return isValidCpf(d)
  if (d.length === 14) return isValidCnpj(d)
  return false
}

/** Máscara de CPF até 11 dígitos; a partir do 12º vira CNPJ. */
export function maskDocumento(value: string): string {
  const d = onlyDigits(value).slice(0, 14)
  return d.length <= 11 ? maskCpf(d) : maskCnpj(d)
}

/** Forma canônica gravada no banco: CPF ou CNPJ mascarado. */
export function canonicalDocumento(value: string): string {
  const d = onlyDigits(value)
  return d.length === 11 ? maskCpf(d) : maskCnpj(d)
}

/** CEP com 8 dígitos (aceita "80000-000" ou "80000000"). */
export function isValidCep(value: string): boolean {
  return /^\d{8}$/.test(onlyDigits(value)) && /^[\d\s.-]+$/.test(value.trim())
}

/** Máscara progressiva 00000-000. */
export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const

export function isValidUf(value: string): boolean {
  return (UFS as readonly string[]).includes(value.trim().toUpperCase())
}

/**
 * Número em formato BR ou internacional: "1.234,5" → 1234.5, "12,5" → 12.5,
 * "-25.4284" → -25.4284. Vazio/inválido → null.
 */
export function parseDecimalBR(value: string | null | undefined): number | null {
  if (value == null) return null
  let s = String(value).trim().replace(/\s/g, "")
  if (!s) return null
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".")
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Inteiro positivo aceitando separador de milhar ("12.000" → 12000). */
export function parseIntBR(value: string | null | undefined): number | null {
  if (value == null) return null
  const s = String(value).trim().replace(/[.\s]/g, "")
  if (!s) return null
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) ? n : null
}

/** "dd/mm/aaaa" ou "aaaa-mm-dd" → "aaaa-mm-dd" (data real), senão null. */
export function parseDateBR(value: string | null | undefined): string | null {
  if (value == null) return null
  const s = String(value).trim()
  if (!s) return null
  let y: number, m: number, d: number
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (br) {
    d = Number(br[1]); m = Number(br[2]); y = Number(br[3])
  } else if (iso) {
    y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3])
  } else {
    return null
  }
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null
  }
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

export function isValidLat(n: number): boolean {
  return Number.isFinite(n) && n >= -90 && n <= 90
}

export function isValidLng(n: number): boolean {
  return Number.isFinite(n) && n >= -180 && n <= 180
}
