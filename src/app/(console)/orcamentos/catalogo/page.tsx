import type { Metadata } from "next"
import { BookOpenIcon } from "lucide-react"
import { cn } from "cn"

import type { CatalogItem } from "@/lib/types"
import { formatBRL } from "@/lib/format"
import { requireRole } from "@/server/auth"
import { listCatalog } from "@/server/quotes"
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
import { EmptyState } from "@/components/empty-state"
import { QuotesBackLink } from "@/components/orcamentos/back-link"
import { CatalogItemActions, NewCatalogItemButton } from "@/components/orcamentos/catalog-dialogs"

export const metadata: Metadata = {
  title: "Catálogo de serviços",
}

export default async function CatalogoPage() {
  await requireRole("admin")
  const result = await listCatalog({ incluirInativos: true })

  return (
    <div className="flex flex-1 flex-col">
      <QuotesBackLink />
      <PageHeader
        title="Catálogo"
        description="Serviços e produtos com preço de referência para montar orçamentos."
        actions={<NewCatalogItemButton />}
      />
      {result.error !== null ? (
        <DataError message={result.error} />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={BookOpenIcon}
          title="Catálogo vazio"
          description="Cadastre os serviços que a Lead mais orça, como instalação por capacidade, higienização e recarga de gás."
        />
      ) : (
        <CatalogList items={result.data} />
      )}
    </div>
  )
}

function AtivoPill({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        ativo ? "border-transparent bg-clear-dim text-clear" : "border-line bg-console-2 text-ink-faint",
      )}
    >
      {ativo ? "Ativo" : "Inativo"}
    </span>
  )
}

function CatalogList({ items }: { items: CatalogItem[] }) {
  const ativos = items.filter((i) => i.ativo).length
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-dim">
        <span className="text-ink tabular-nums">{ativos}</span> {ativos === 1 ? "item ativo" : "itens ativos"} de{" "}
        <span className="tabular-nums">{items.length}</span>
      </p>
      <ul
        aria-label="Itens do catálogo"
        className="divide-y divide-line-soft overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line md:hidden"
      >
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 py-3.5 pr-2 pl-4">
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-[0.9375rem] font-medium", item.ativo ? "text-ink" : "text-ink-faint")}>
                {item.nome}
              </p>
              {item.descricao && (
                <p className="mt-0.5 line-clamp-2 text-[0.8125rem] leading-snug text-ink-dim">{item.descricao}</p>
              )}
              <div className="mt-2 flex items-center gap-3">
                <span className="text-sm font-medium text-ink tabular-nums">
                  {formatBRL(item.preco)}
                  <span className="font-normal text-ink-faint">/{item.unidade}</span>
                </span>
                <AtivoPill ativo={item.ativo} />
              </div>
            </div>
            <CatalogItemActions item={item} />
          </li>
        ))}
      </ul>
      <div className="overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line max-md:hidden">
        <Table aria-label="Itens do catálogo">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Nome</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-14">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-md pl-5">
                  <span className={cn("block truncate font-medium", item.ativo ? "text-ink" : "text-ink-faint")}>
                    {item.nome}
                  </span>
                  {item.descricao && (
                    <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-faint">{item.descricao}</span>
                  )}
                </TableCell>
                <TableCell className="text-ink-dim">{item.unidade}</TableCell>
                <TableCell className="text-right whitespace-nowrap text-ink tabular-nums">
                  {formatBRL(item.preco)}
                </TableCell>
                <TableCell>
                  <AtivoPill ativo={item.ativo} />
                </TableCell>
                <TableCell className="text-right">
                  <CatalogItemActions item={item} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
