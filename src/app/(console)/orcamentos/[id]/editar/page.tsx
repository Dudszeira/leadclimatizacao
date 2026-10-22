import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { quoteNumeroLabel } from "@/lib/status-meta"
import { requireRole } from "@/server/auth"
import { getQuote, listCatalog, listQuoteClientOptions } from "@/server/quotes"
import { PageHeader } from "@/components/page-header"
import { DataError } from "@/components/data-error"
import { QuotesBackLink } from "@/components/orcamentos/back-link"
import { numeroParaCampo } from "@/components/orcamentos/form-utils"
import { QuoteForm, type QuoteFormValues } from "@/components/orcamentos/quote-form"

export const metadata: Metadata = {
  title: "Editar orçamento",
}

type PageParams = { params: Promise<{ id: string }> }

export default async function EditarOrcamentoPage({ params }: PageParams) {
  await requireRole("admin", "atendente", "tecnico")
  const { id } = await params
  const [quoteRes, options, catalog] = await Promise.all([
    getQuote(id),
    listQuoteClientOptions(),
    listCatalog(),
  ])

  const error = quoteRes.error ?? options.error ?? catalog.error
  if (error !== null) {
    return (
      <div className="flex flex-1 flex-col">
        <QuotesBackLink href={`/orcamentos/${id}`} label="Orçamento" />
        <PageHeader title="Editar orçamento" />
        <DataError message={error} />
      </div>
    )
  }
  const q = quoteRes.data
  if (!q) notFound()
  // Só "aguardando" é editável (o banco também barra).
  if (q.status !== "aguardando") redirect(`/orcamentos/${q.id}`)

  // Cliente/prédio podem ter sido inativados depois: mantém a opção atual.
  const opts = options.data ?? []
  const clientOptions = opts.some((o) => o.building_id === q.building_id)
    ? opts
    : [
        ...opts,
        {
          client_id: q.client_id,
          razao_social: q.client.razao_social,
          nome_fantasia: q.client.nome_fantasia,
          building_id: q.building_id,
          building_nome: q.building.nome,
          bairro: q.building.bairro,
          cidade: q.building.cidade,
        },
      ]

  const initial: QuoteFormValues = {
    client_id: q.client_id,
    building_id: q.building_id,
    tipo_servico: q.tipo_servico,
    titulo: q.titulo,
    validade: q.validade.slice(0, 10),
    observacoes: q.observacoes ?? "",
    condicoes_pagamento: q.condicoes_pagamento ?? "",
    prazo_execucao: q.prazo_execucao ?? "",
    garantia: q.garantia ?? "",
    desconto: q.desconto > 0 ? numeroParaCampo(q.desconto) : "",
    items: q.items.map((i) => ({
      catalog_item_id: i.catalog_item_id,
      descricao: i.descricao,
      unidade: i.unidade,
      quantidade: numeroParaCampo(i.quantidade, 3),
      preco_unitario: numeroParaCampo(i.preco_unitario),
    })),
  }

  return (
    <div className="flex flex-1 flex-col">
      <QuotesBackLink href={`/orcamentos/${q.id}`} label={quoteNumeroLabel(q.numero)} />
      <PageHeader
        title={`Editar ${quoteNumeroLabel(q.numero)}`}
        description="As alterações valem para o PDF enviado a partir de agora."
      />
      <QuoteForm
        quoteId={q.id}
        initial={initial}
        clientOptions={clientOptions}
        catalog={catalog.data ?? []}
        cancelHref={`/orcamentos/${q.id}`}
      />
    </div>
  )
}
