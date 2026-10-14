import { toCompetencia } from "./dates";

/**
 * Espelho em memória de public._generate_monthly_invoices_job (0006) — usado
 * no modo demo para dizer quantas faturas seriam criadas e nos testes.
 */

export interface BillableContract {
  id: string;
  status: string;
  tipo: string;
  inicio: string;
  fim: string | null;
}

/** Último dia do mês de uma competência "YYYY-MM-01". */
export function fimDoMes(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${competencia.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/** Contratos que gerariam fatura na competência (sem a fatura já existir). */
export function contractsToBill(
  contracts: BillableContract[],
  existing: Array<{ contract_id: string; competencia: string }>,
  competencia: string,
): BillableContract[] {
  const comp = toCompetencia(competencia);
  const fim = fimDoMes(comp);
  const jaFaturados = new Set(
    existing.filter((i) => i.competencia === comp).map((i) => i.contract_id),
  );
  return contracts.filter(
    (c) =>
      c.status === "ativo" &&
      c.tipo !== "corretiva_avulsa" &&
      c.inicio <= fim &&
      (c.fim === null || c.fim >= comp) &&
      !jaFaturados.has(c.id),
  );
}
