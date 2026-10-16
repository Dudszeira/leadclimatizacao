import type { OsStatus, PmocSituacao } from "../../lib/types"

/**
 * Regra pura da situação de um plano PMOC (espelho de
 * vw_dashboard_pmoc_situacao em 0005_operacao.sql):
 *
 * - proxima_data < hoje          → "atrasado"
 * - proxima_data ≤ hoje + 7 dias → "vencendo"
 * - senão                         → "em_dia"
 *
 * A proxima_data só avança quando a OS preventiva é CONCLUÍDA (trigger
 * reschedule_pmoc_on_os_conclusion) — gerar a OS não muda a situação. Por isso
 * a OS em aberto não "zera" o atraso: ela só indica que já há atendimento em
 * curso (acao = "acompanhar_os") em vez de pedir uma OS nova ("gerar_os").
 */

export const JANELA_VENCENDO_DIAS = 7

const OS_EM_ABERTO: readonly OsStatus[] = ["aberto", "agendado", "em_campo"]

export function isOsEmAberto(status: OsStatus): boolean {
  return OS_EM_ABERTO.includes(status)
}

/** Diferença em dias entre duas datas "YYYY-MM-DD" (b - a), sem fuso. */
export function diffDias(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number)
  const [by, bm, bd] = b.split("-").map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** "YYYY-MM-DD" de hoje no fuso de Curitiba (mesmo critério de hoje_brt()). */
export function hojeBrt(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

export function situacaoPorDias(diasParaVencer: number): PmocSituacao {
  if (diasParaVencer < 0) return "atrasado"
  if (diasParaVencer <= JANELA_VENCENDO_DIAS) return "vencendo"
  return "em_dia"
}

export interface SituacaoPlanoInput {
  proxima_data: string
  hoje: string
  /** Plano encerrado (ativo = false) não tem situação operacional. */
  ativo?: boolean
  /** Status das OS ligadas ao plano (qualquer status). */
  osStatus?: readonly OsStatus[]
}

export interface SituacaoPlano {
  situacao: PmocSituacao | "encerrado"
  dias_para_vencer: number
  os_em_aberto: boolean
  /** O que a operação precisa fazer agora. */
  acao: "gerar_os" | "acompanhar_os" | null
}

export function situacaoPlano(input: SituacaoPlanoInput): SituacaoPlano {
  const dias = diffDias(input.hoje, input.proxima_data)
  const osEmAberto = (input.osStatus ?? []).some(isOsEmAberto)
  if (input.ativo === false) {
    return { situacao: "encerrado", dias_para_vencer: dias, os_em_aberto: osEmAberto, acao: null }
  }
  const situacao = situacaoPorDias(dias)
  let acao: SituacaoPlano["acao"] = null
  if (osEmAberto) acao = "acompanhar_os"
  else if (situacao !== "em_dia") acao = "gerar_os"
  return { situacao, dias_para_vencer: dias, os_em_aberto: osEmAberto, acao }
}

/** Soma dias a uma data "YYYY-MM-DD". */
export function addDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + dias))
  return dt.toISOString().slice(0, 10)
}
