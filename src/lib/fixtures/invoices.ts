import type { Invoice } from "@/lib/types";
import { contractsFixture } from "./contracts";
import { dateOnlyPlusDays, isoAgo, monthStart, parseDateOnly, stamps } from "./dates";

/** "YYYY-MM-DD" → "YYYYMM" (to_char(..., 'YYYYMM')). */
function yyyymm(isoDate: string): string {
  return isoDate.slice(0, 7).replace("-", "");
}

/** Data-only + dias, às H horas locais, em ISO. */
function atHourOf(isoDate: string, plusDays: number, hours: number): string {
  const d = parseDateOnly(dateOnlyPlusDays(isoDate, plusDays));
  d.setHours(hours, 0, 0, 0);
  return d.toISOString();
}

function buildInvoices(): Invoice[] {
  const invoices: Invoice[] = [];
  let rowNumber = 0;
  let idSeq = 0;
  const nextId = () =>
    `f7000000-0000-4000-8000-0000000000${String(++idSeq).padStart(2, "0")}`;

  // Contratos PMOC recorrentes ativos: competências M-2 e M-1 pagas, mês atual
  // pendente — espelho do cross join generate_series(0, 2) do seed.sql.
  const recorrentes = contractsFixture
    .filter((c) => c.tipo === "pmoc_recorrente" && c.status === "ativo")
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const c of recorrentes) {
    for (let m = 0; m <= 2; m++) {
      rowNumber += 1;
      const competencia = monthStart(m);
      const pago = m > 0;
      invoices.push({
        id: nextId(),
        contract_id: c.id,
        competencia,
        valor: c.valor_mensal,
        status: pago ? "pago" : "pendente",
        metodo: c.dia_vencimento <= 10 ? "boleto" : "pix",
        vencimento: dateOnlyPlusDays(competencia, c.dia_vencimento - 1),
        asaas_id: null,
        asaas_url: null,
        nf_numero: pago
          ? `NFS-${yyyymm(competencia)}-${String(rowNumber).padStart(3, "0")}`
          : null,
        paid_at: pago ? atHourOf(competencia, c.dia_vencimento - 3, 14) : null,
        ...stamps(),
      });
    }
  }

  // Uma fatura ATRASADA (IMP Metalúrgica, competência do mês passado)
  const atrasada = invoices.find(
    (i) =>
      i.contract_id === "c7000000-0000-4000-8000-000000000003" &&
      i.competencia === monthStart(1),
  );
  if (atrasada) {
    atrasada.status = "atrasado";
    atrasada.paid_at = null;
    atrasada.nf_numero = null;
  }

  // Corretiva avulsa das Farmácias Pinheiro paga via Pix no mês atual
  const mesAtual = monthStart(0);
  invoices.push({
    id: nextId(),
    contract_id: "c7000000-0000-4000-8000-000000000007",
    competencia: mesAtual,
    valor: 1240,
    status: "pago",
    metodo: "pix",
    vencimento: dateOnlyPlusDays(mesAtual, 9),
    asaas_id: null,
    asaas_url: null,
    nf_numero: `NFS-${yyyymm(mesAtual)}-901`,
    paid_at: isoAgo({ days: 5 }),
    ...stamps(),
  });

  // 1ª parcela da instalação da Araucária Foods (mês atual, pendente por boleto)
  invoices.push({
    id: nextId(),
    contract_id: "c7000000-0000-4000-8000-000000000008",
    competencia: mesAtual,
    valor: 14500,
    status: "pendente",
    metodo: "boleto",
    vencimento: dateOnlyPlusDays(mesAtual, 14),
    asaas_id: null,
    asaas_url: null,
    nf_numero: null,
    paid_at: null,
    ...stamps(),
  });

  return invoices;
}

/** 20 faturas geradas programaticamente como no seed.sql (seção 10). */
export const invoicesFixture: Invoice[] = buildInvoices();
