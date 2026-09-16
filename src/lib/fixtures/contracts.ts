import type { Contract, ContractStatus, ContractType } from "@/lib/types";
import { addMonths, dateOnly, stamps, today } from "./dates";

function monthsAgoDate(months: number): string {
  return dateOnly(addMonths(today(), -months));
}

type ContractSeed = [
  id: string,
  client_id: string,
  tipo: ContractType,
  valor_mensal: number,
  status: ContractStatus,
  dia_vencimento: number,
  inicioMesesAtras: number,
  fimMesesAdiante: number | null,
  observacoes: string | null,
];

/** 8 contratos — espelho da seção 10 do seed.sql. */
const rows: ContractSeed[] = [
  ["c7000000-0000-4000-8000-000000000001", "c0000000-0000-4000-8000-000000000001", "pmoc_recorrente", 8900, "ativo", 5, 14, null, "PMOC mensal — 2 chillers, 1 self, 1 VRF"],
  ["c7000000-0000-4000-8000-000000000002", "c0000000-0000-4000-8000-000000000003", "pmoc_recorrente", 12400, "ativo", 10, 20, null, "PMOC mensal — hospital (inclui plantão de sobreaviso)"],
  ["c7000000-0000-4000-8000-000000000003", "c0000000-0000-4000-8000-000000000005", "pmoc_recorrente", 6800, "ativo", 15, 8, null, "PMOC bimestral do galpão + mensal do administrativo"],
  ["c7000000-0000-4000-8000-000000000004", "c0000000-0000-4000-8000-000000000007", "pmoc_recorrente", 3900, "ativo", 10, 6, null, null],
  ["c7000000-0000-4000-8000-000000000005", "c0000000-0000-4000-8000-000000000012", "pmoc_recorrente", 5400, "ativo", 5, 2, null, "Contrato novo — convertido do funil (lead Juliana Prado)"],
  ["c7000000-0000-4000-8000-000000000006", "c0000000-0000-4000-8000-000000000002", "pmoc_recorrente", 7600, "ativo", 20, 11, null, null],
  ["c7000000-0000-4000-8000-000000000007", "c0000000-0000-4000-8000-000000000009", "corretiva_avulsa", 850, "ativo", 10, 3, null, "Corretivas sob demanda — ticket médio"],
  ["c7000000-0000-4000-8000-000000000008", "c0000000-0000-4000-8000-000000000006", "instalacao", 14500, "ativo", 15, 1, 2, "Instalação laboratório de qualidade — 3 parcelas"],
];

export const contractsFixture: Contract[] = rows.map(
  ([id, client_id, tipo, valor_mensal, status, dia_vencimento, inicioMeses, fimMeses, observacoes]) => ({
    id,
    client_id,
    tipo,
    valor_mensal,
    status,
    dia_vencimento,
    inicio: monthsAgoDate(inicioMeses),
    fim: fimMeses === null ? null : dateOnly(addMonths(today(), fimMeses)),
    observacoes,
    ...stamps(),
  }),
);
