import type { Metadata } from "next"

import { ORCAMENTO_PADROES } from "@/lib/empresa"
import { addDaysToDateKey, todayBRT } from "@/lib/format"
import { requireRole } from "@/server/auth"
import { listCatalog, listQuoteClientOptions } from "@/server/quotes"
import { PageHeader } from "@/components/page-header"
import { DataError } from "@/components/data-error"
import { QuotesBackLink } from "@/components/orcamentos/back-link"
import { QuoteForm, type QuoteFormValues } from "@/components/orcamentos/quote-form"

export const metadata: Metadata = {
  title: "Novo orçamento",
}

export default async function NovoOrcamentoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireRole("admin", "atendente", "tecnico")
  const sp = await searchParams
  const [options, catalog] = await Promise.all([listQuoteClientOptions(), listCatalog()])

  const error = options.error ?? catalog.error
  if (error !== null) {
    return (
      <div className="flex flex-1 flex-col">
        <QuotesBackLink />
        <PageHeader title="Novo orçamento" />
        <DataError message={error} />
      </div>
    )
  }

  const opts = options.data ?? []
  const pedido = typeof sp.client === "string" ? sp.client : ""
  const predios = opts.filter((o) => o.client_id === pedido)
  const clientId = predios.length > 0 ? pedido : ""

  const initial: QuoteFormValues = {
    client_id: clientId,
    building_id: predios.length === 1 ? predios[0].building_id : "",
    tipo_servico: "instalacao",
    titulo: "",
    validade: addDaysToDateKey(todayBRT(), ORCAMENTO_PADROES.validadeDias),
    observacoes: "",
    condicoes_pagamento: ORCAMENTO_PADROES.condicoesPagamento,
    prazo_execucao: ORCAMENTO_PADROES.prazoExecucao,
    garantia: ORCAMENTO_PADROES.garantia,
    desconto: "",
    items: [],
  }

  return (
    <div className="flex flex-1 flex-col">
      <QuotesBackLink href={clientId ? `/clientes/${clientId}?aba=orcamentos` : "/orcamentos"} label={clientId ? "Cliente" : "Orçamentos"} />
      <PageHeader
        title="Novo orçamento"
        description="Escolha o cliente, monte os itens e confira o total antes de criar."
      />
      <QuoteForm
        quoteId={null}
        initial={initial}
        clientOptions={opts}
        catalog={catalog.data ?? []}
        cancelHref={clientId ? `/clientes/${clientId}?aba=orcamentos` : "/orcamentos"}
      />
    </div>
  )
}
