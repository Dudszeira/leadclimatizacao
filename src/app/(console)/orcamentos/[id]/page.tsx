import { cache } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cn } from "cn"
import { ArrowUpRightIcon, CircleCheckIcon, CircleXIcon } from "lucide-react"

import type { QuoteWithItems } from "@/lib/types"
import {
  formatBRL,
  formatDateBR,
  formatDateTimeBR,
  formatDateTimeFullBR,
  todayBRT,
} from "@/lib/format"
import { OS_TYPE_META, quoteNumeroLabel } from "@/lib/status-meta"
import { requireRole } from "@/server/auth"
import { getQuote } from "@/server/quotes"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { DataError } from "@/components/data-error"
import { QuotesBackLink } from "@/components/orcamentos/back-link"
import { QuoteActions } from "@/components/orcamentos/quote-actions"
import { QuoteStatusPill, VencidoPill, isQuoteVencido } from "@/components/orcamentos/quote-pills"

type PageParams = { params: Promise<{ id: string }> }

const getQuoteCached = cache(getQuote)

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { id } = await params
  const result = await getQuoteCached(id)
  return { title: result.data ? quoteNumeroLabel(result.data.numero) : "Orçamento" }
}

function enderecoPredio(b: QuoteWithItems["building"]): string {
  const rua = [b.logradouro, b.numero].filter(Boolean).join(", ")
  return [rua, b.bairro, `${b.cidade}/${b.uf}`].filter(Boolean).join(" · ")
}

function formatQtd(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 3 })
}

export default async function OrcamentoPage({ params }: PageParams) {
  const me = await requireRole("admin", "atendente", "tecnico")
  const { id } = await params
  const result = await getQuoteCached(id)

  if (result.error !== null) {
    return (
      <div className="flex flex-1 flex-col">
        <QuotesBackLink />
        <PageHeader title="Orçamento" />
        <DataError message={result.error} />
      </div>
    )
  }
  if (!result.data) notFound()

  const q = result.data
  const numero = quoteNumeroLabel(q.numero)
  const clienteNome = q.client.nome_fantasia ?? q.client.razao_social
  const vencido = isQuoteVencido(q, todayBRT())
  const office = me.role === "admin" || me.role === "atendente"

  return (
    <div className="flex flex-1 flex-col">
      <QuotesBackLink />
      <PageHeader
        title={numero}
        description={q.titulo}
        actions={
          <QuoteActions id={q.id} numeroLabel={numero} aguardando={q.status === "aguardando"} role={me.role} />
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <QuoteStatusPill status={q.status} />
          {vencido && <VencidoPill />}
          <span className="inline-flex h-6 items-center rounded-full border border-line px-2.5 text-xs font-medium text-ink-dim">
            {OS_TYPE_META[q.tipo_servico].label}
          </span>
        </div>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {q.status === "aprovado" && <AprovadoBanner q={q} office={office} admin={me.role === "admin"} />}
          {q.status === "declinado" && <DeclinadoBanner q={q} />}

          {/* Cliente, local e datas */}
          <Card>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <DocItem label="Cliente">
                  {office ? (
                    <Link
                      href={`/clientes/${q.client.id}`}
                      className="font-medium text-ink underline-offset-4 hover:text-signal hover:underline"
                    >
                      {clienteNome}
                    </Link>
                  ) : (
                    <span className="font-medium text-ink">{clienteNome}</span>
                  )}
                  {q.client.nome_fantasia && (
                    <span className="block text-[0.8125rem] text-ink-dim">{q.client.razao_social}</span>
                  )}
                  {q.client.contato_nome && (
                    <span className="block text-[0.8125rem] text-ink-faint">Contato: {q.client.contato_nome}</span>
                  )}
                </DocItem>
                <DocItem label="Local">
                  <span className="font-medium text-ink">{q.building.nome}</span>
                  <span className="block text-[0.8125rem] leading-snug text-ink-dim">
                    {enderecoPredio(q.building)}
                  </span>
                </DocItem>
                <DocItem label="Emitido em">
                  <span className="text-ink tabular-nums">{formatDateTimeBR(q.created_at)}</span>
                </DocItem>
                <DocItem label="Válido até">
                  <span className={cn("tabular-nums", vencido ? "text-danger" : "text-ink")}>
                    {formatDateBR(q.validade)}
                  </span>
                  {vencido && (
                    <span className="block text-[0.8125rem] text-ink-faint">
                      Validade vencida. Confirme os valores com o cliente antes de aprovar.
                    </span>
                  )}
                </DocItem>
              </dl>
            </CardContent>
          </Card>

          {/* Itens */}
          <Card>
            <CardHeader>
              <CardTitle>
                Itens <span className="text-ink-faint tabular-nums">{q.items.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="max-md:px-0 md:px-0">
              <ol aria-label="Itens do orçamento" className="flex flex-col divide-y divide-line-soft md:hidden">
                {q.items.map((item, i) => (
                  <li key={item.id} className="flex gap-3 px-4 py-3">
                    <span className="w-5 shrink-0 pt-0.5 text-[0.8125rem] text-ink-faint tabular-nums" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-ink">{item.descricao}</p>
                      <div className="mt-1 flex items-baseline justify-between gap-3 text-[0.8125rem]">
                        <span className="text-ink-dim tabular-nums">
                          {formatQtd(item.quantidade)} {item.unidade} × {formatBRL(item.preco_unitario)}
                        </span>
                        <span className="shrink-0 font-medium text-ink tabular-nums">{formatBRL(item.valor)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <Table aria-label="Itens do orçamento" className="max-md:hidden">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-5">#</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Qtd.</TableHead>
                    <TableHead>Unid.</TableHead>
                    <TableHead className="text-right">Preço unit.</TableHead>
                    <TableHead className="pr-5 text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.items.map((item, i) => (
                    <TableRow key={item.id}>
                      <TableCell className="pl-5 text-ink-faint tabular-nums">{i + 1}</TableCell>
                      <TableCell className="max-w-96 whitespace-normal text-ink">{item.descricao}</TableCell>
                      <TableCell className="text-right text-ink-dim tabular-nums">{formatQtd(item.quantidade)}</TableCell>
                      <TableCell className="text-ink-dim">{item.unidade}</TableCell>
                      <TableCell className="text-right whitespace-nowrap text-ink-dim tabular-nums">
                        {formatBRL(item.preco_unitario)}
                      </TableCell>
                      <TableCell className="pr-5 text-right font-medium whitespace-nowrap text-ink tabular-nums">
                        {formatBRL(item.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Condições */}
          <Card>
            <CardHeader>
              <CardTitle>Condições</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col divide-y divide-line-soft">
                <CondRow label="Pagamento" value={q.condicoes_pagamento} />
                <CondRow label="Prazo de execução" value={q.prazo_execucao} />
                <CondRow label="Garantia" value={q.garantia} />
                <CondRow label="Observações" value={q.observacoes} />
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Totais */}
        <aside aria-label="Totais" className="lg:sticky lg:top-20">
          <Card>
            <CardHeader>
              <CardTitle>Totais</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-ink-dim">Subtotal</dt>
                  <dd className="text-ink tabular-nums">{formatBRL(q.subtotal)}</dd>
                </div>
                {q.desconto > 0 && (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-ink-dim">Desconto</dt>
                    <dd className="text-ink tabular-nums">- {formatBRL(q.desconto)}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-3 border-t border-line-soft pt-4">
                  <dt className="text-ink-dim">Total</dt>
                  <dd className="font-display text-[1.75rem] leading-none font-medium tracking-[-0.03em] text-ink">
                    {formatBRL(q.total)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

function DocItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.8125rem] text-ink-faint">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  )
}

function CondRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-6">
      <dt className="shrink-0 text-sm text-ink-dim sm:w-40">{label}</dt>
      <dd className="min-w-0 text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink">
        {value ?? <span className="text-ink-faint">Não informado</span>}
      </dd>
    </div>
  )
}

function AprovadoBanner({ q, office, admin }: { q: QuoteWithItems; office: boolean; admin: boolean }) {
  const linkClass =
    "inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-signal underline-offset-4 hover:underline md:min-h-0"
  return (
    <section
      aria-label="Orçamento aprovado"
      className="flex flex-col gap-3 rounded-[1.375rem] bg-clear-dim/60 p-4 ring-1 ring-line md:p-5"
    >
      <p className="flex items-center gap-2 text-[0.9375rem] font-medium text-ink">
        <CircleCheckIcon className="size-4 text-clear" aria-hidden="true" />
        Aprovado em {formatDateTimeFullBR(q.decidido_em)}
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {q.service_order_id && office ? (
          <Link href={`/chamados/${q.service_order_id}`} className={linkClass}>
            Ver ordem de serviço
            <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
          </Link>
        ) : q.service_order_id ? (
          <span className="text-sm text-ink-dim">OS aberta para a equipe.</span>
        ) : null}
        {q.invoice_id && admin ? (
          <Link href={`/financeiro?q=${encodeURIComponent(q.client.razao_social)}`} className={linkClass}>
            Ver fatura no Financeiro
            <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
        {!q.service_order_id && !q.invoice_id ? (
          <span className="text-sm text-ink-dim">Sem OS ou fatura vinculadas.</span>
        ) : null}
      </div>
    </section>
  )
}

function DeclinadoBanner({ q }: { q: QuoteWithItems }) {
  return (
    <section
      aria-label="Orçamento declinado"
      className="flex flex-col gap-2 rounded-[1.375rem] bg-console p-4 ring-1 ring-line md:p-5"
    >
      <p className="flex items-center gap-2 text-[0.9375rem] font-medium text-ink">
        <CircleXIcon className="size-4 text-ink-faint" aria-hidden="true" />
        Declinado em {formatDateTimeFullBR(q.decidido_em)}
      </p>
      <p className="text-sm leading-relaxed text-ink-dim">
        {q.motivo_declinio ? `Motivo: ${q.motivo_declinio}` : "Nenhum motivo registrado."}
      </p>
    </section>
  )
}
