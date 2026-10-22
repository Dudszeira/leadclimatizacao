import Link from "next/link"
import { CalendarIcon } from "lucide-react"

import type { QuoteWithClient } from "@/lib/types"
import { formatBRL, formatDateBR, formatDateTimeBR } from "@/lib/format"
import { quoteNumeroLabel } from "@/lib/status-meta"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { QuoteStatusPill, VencidoPill, isQuoteVencido } from "./quote-pills"

function clienteNome(q: QuoteWithClient): string {
  return q.client.nome_fantasia ?? q.client.razao_social
}

/** Tabela (md+) dos orçamentos; a linha inteira abre o orçamento. */
export function QuotesTable({ items, hoje }: { items: QuoteWithClient[]; hoje: string }) {
  return (
    <Table aria-label="Orçamentos" className="max-md:hidden">
      <TableHeader>
        <TableRow>
          <TableHead>Número</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Título</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Validade</TableHead>
          <TableHead>Emitido</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((q) => {
          const vencido = isQuoteVencido(q, hoje)
          return (
            <TableRow key={q.id} className="relative">
              <TableCell>
                <Link
                  href={`/orcamentos/${q.id}`}
                  aria-label={`Abrir orçamento ${quoteNumeroLabel(q.numero)}, ${clienteNome(q)}`}
                  className="font-medium whitespace-nowrap text-ink-dim tabular-nums outline-none after:absolute after:inset-0 hover:text-ink focus-visible:text-ink focus-visible:underline"
                >
                  {quoteNumeroLabel(q.numero)}
                </Link>
              </TableCell>
              <TableCell className="max-w-56">
                <span className="block truncate font-medium text-ink">{clienteNome(q)}</span>
                <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-faint">{q.building.nome}</span>
              </TableCell>
              <TableCell className="max-w-64">
                <span className="block truncate text-ink-dim">{q.titulo}</span>
              </TableCell>
              <TableCell className="text-right font-medium whitespace-nowrap text-ink tabular-nums">
                {formatBRL(q.total)}
              </TableCell>
              <TableCell>
                <QuoteStatusPill status={q.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">
                <span className="flex items-center gap-2">
                  <span className={vencido ? "text-danger" : "text-ink-dim"}>{formatDateBR(q.validade)}</span>
                  {vencido && <VencidoPill />}
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap text-ink-dim tabular-nums">
                {formatDateTimeBR(q.created_at)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

/** Cartões (celular) dos orçamentos; o cartão inteiro abre o orçamento. */
export function QuoteCards({ items, hoje }: { items: QuoteWithClient[]; hoje: string }) {
  return (
    <ul aria-label="Orçamentos" className="flex flex-col gap-2.5 md:hidden">
      {items.map((q) => {
        const vencido = isQuoteVencido(q, hoje)
        return (
          <li key={q.id}>
            <Link
              href={`/orcamentos/${q.id}`}
              aria-label={`Abrir orçamento ${quoteNumeroLabel(q.numero)}, ${clienteNome(q)}`}
              className="flex flex-col gap-3 rounded-[1.375rem] bg-console p-4 ring-1 ring-line transition-[background-color,transform] duration-150 ease-(--ease-out-expo) outline-none active:scale-[0.99] active:bg-console-2 focus-visible:ring-3 focus-visible:ring-signal/60 motion-reduce:transition-none"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-[0.8125rem] font-medium text-ink-dim tabular-nums">
                  {quoteNumeroLabel(q.numero)}
                </span>
                <span className="flex items-center gap-1.5">
                  {vencido && <VencidoPill />}
                  <QuoteStatusPill status={q.status} />
                </span>
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-[1.0625rem] leading-snug font-medium tracking-[-0.01em] text-ink">
                  {clienteNome(q)}
                </span>
                <span className="mt-0.5 block truncate text-sm text-ink-dim">{q.titulo}</span>
              </span>
              <span className="flex items-center justify-between gap-3 text-[0.8125rem] text-ink-dim">
                <span className="flex min-w-0 items-center gap-1.5">
                  <CalendarIcon className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
                  <span className={vencido ? "text-danger tabular-nums" : "tabular-nums"}>
                    Válido até {formatDateBR(q.validade)}
                  </span>
                </span>
                <span className="shrink-0 font-display text-base font-medium text-ink tabular-nums">
                  {formatBRL(q.total)}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
