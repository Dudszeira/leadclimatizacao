import "server-only"

import { cache } from "react"

import {
  getDashboardKpis,
  getDashboardResumo,
  getPmocContadores,
} from "@/server/dashboard"

// Várias seções do dashboard leem os mesmos agregados (KPIs, resumo, PMOC).
// `cache` deduplica a consulta dentro do mesmo request do servidor.
export const kpisDoRequest = cache(getDashboardKpis)
export const resumoDoRequest = cache(getDashboardResumo)
export const pmocDoRequest = cache(getPmocContadores)

/** "1 chamado" / "3 chamados". */
export function plural(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios
}
