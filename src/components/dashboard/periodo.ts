/**
 * Período do dashboard (searchParam `periodo=AAAA-MM_AAAA-MM`).
 * Helpers puros, usados no servidor (página e gráfico) e no seletor (cliente).
 *
 * A série de chamados do servidor cobre no máximo 12 meses (getChamadosPorMes
 * limita em 12), então o período fica dentro da janela dos últimos 12 meses.
 */

export const JANELA_MESES = 12
export const PERIODO_PADRAO_MESES = 6

/** Mês como índice contínuo: ano * 12 + (mês - 1). */
export type MesIdx = number

export type Periodo = { inicio: MesIdx; fim: MesIdx }

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

export function mesIdx(ano: number, mes1a12: number): MesIdx {
  return ano * 12 + (mes1a12 - 1)
}

export function anoDe(i: MesIdx): number {
  return Math.floor(i / 12)
}

export function mesDe(i: MesIdx): number {
  return (i % 12) + 1
}

/** "AAAA-MM" ou "AAAA-MM-DD" → índice. */
export function idxDeIso(iso: string): MesIdx {
  const [ano, mes] = iso.split("-").map(Number)
  return mesIdx(ano, mes)
}

export function isoDeIdx(i: MesIdx): string {
  return `${anoDe(i)}-${String(mesDe(i)).padStart(2, "0")}`
}

export function mesCurto(i: MesIdx): string {
  return MESES_CURTOS[mesDe(i) - 1]
}

/** Mês corrente em Curitiba. */
export function mesAtualBRT(now: Date = new Date()): MesIdx {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(now)
  return idxDeIso(ymd)
}

export function janela(atual: MesIdx): { min: MesIdx; max: MesIdx } {
  return { min: atual - (JANELA_MESES - 1), max: atual }
}

export function periodoPadrao(atual: MesIdx): Periodo {
  return { inicio: atual - (PERIODO_PADRAO_MESES - 1), fim: atual }
}

/** Lê o searchParam; valor inválido ou fora da janela cai no padrão. */
export function parsePeriodo(raw: string | string[] | undefined, atual: MesIdx): Periodo {
  const padrao = periodoPadrao(atual)
  if (typeof raw !== "string") return padrao
  const m = /^(\d{4})-(\d{2})_(\d{4})-(\d{2})$/.exec(raw)
  if (!m) return padrao
  const a = mesIdx(Number(m[1]), Number(m[2]))
  const b = mesIdx(Number(m[3]), Number(m[4]))
  if (Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[4]) < 1 || Number(m[4]) > 12) return padrao
  const { min, max } = janela(atual)
  const inicio = Math.max(min, Math.min(a, b))
  const fim = Math.min(max, Math.max(a, b))
  return inicio > fim ? padrao : { inicio, fim }
}

export function serializePeriodo(p: Periodo): string {
  return `${isoDeIdx(p.inicio)}_${isoDeIdx(p.fim)}`
}

export function mesesNoPeriodo(p: Periodo): number {
  return p.fim - p.inicio + 1
}

/** Atalhos do seletor (todos dentro da janela). */
export function atalhos(atual: MesIdx): { label: string; periodo: Periodo }[] {
  const { min } = janela(atual)
  const inicioAno = Math.max(min, mesIdx(anoDe(atual), 1))
  return [
    { label: "Este mês", periodo: { inicio: atual, fim: atual } },
    { label: "Últimos 3 meses", periodo: { inicio: atual - 2, fim: atual } },
    { label: "Últimos 6 meses", periodo: { inicio: atual - 5, fim: atual } },
    { label: "Este ano", periodo: { inicio: inicioAno, fim: atual } },
    { label: "Últimos 12 meses", periodo: { inicio: min, fim: atual } },
  ]
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Rótulo curto da pílula: "Últimos 6 meses", "Este ano", "Mar a jul de 2026". */
export function rotuloPeriodo(p: Periodo, atual: MesIdx): string {
  const atalho = atalhos(atual).find(
    (a) => a.periodo.inicio === p.inicio && a.periodo.fim === p.fim
  )
  if (atalho) return atalho.label
  if (p.inicio === p.fim) return `${capitalizar(mesCurto(p.inicio))} de ${anoDe(p.inicio)}`
  if (anoDe(p.inicio) === anoDe(p.fim)) {
    return `${capitalizar(mesCurto(p.inicio))} a ${mesCurto(p.fim)} de ${anoDe(p.fim)}`
  }
  return `${capitalizar(mesCurto(p.inicio))} ${anoDe(p.inicio)} a ${mesCurto(p.fim)} ${anoDe(p.fim)}`
}

/** "mai a out" para descrições curtas. */
export function intervaloCurto(p: Periodo): string {
  if (p.inicio === p.fim) return `${mesCurto(p.inicio)} de ${anoDe(p.inicio)}`
  return anoDe(p.inicio) === anoDe(p.fim)
    ? `${mesCurto(p.inicio)} a ${mesCurto(p.fim)}`
    : `${mesCurto(p.inicio)} de ${anoDe(p.inicio)} a ${mesCurto(p.fim)} de ${anoDe(p.fim)}`
}
