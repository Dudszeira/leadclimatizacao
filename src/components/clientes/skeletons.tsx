import { Skeleton } from "@/components/ui/skeleton"

/** Cabeçalho de página (título, descrição e ações) em carregamento. */
export function PageHeaderSkeleton({ actions = 1 }: { actions?: number }) {
  return (
    <div className="flex flex-col gap-4 pb-6 md:flex-row md:items-end md:justify-between md:pb-8">
      <div className="space-y-2.5">
        <Skeleton className="h-8 w-44 rounded-xl md:h-10" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: actions }).map((_, i) => (
          <Skeleton key={i} className="h-11 flex-1 rounded-full md:h-9 md:w-32 md:flex-none" />
        ))}
      </div>
    </div>
  )
}

/** Skeleton da lista de clientes (linhas no celular, tabela no desktop). */
export function ClientsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      className="overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line"
      aria-hidden="true"
    >
      <div className="hidden h-11 items-center border-b border-line-soft px-5 md:flex">
        <Skeleton className="h-3.5 w-48" />
      </div>
      <div className="divide-y divide-line-soft">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex min-h-[4.5rem] items-center gap-3 px-4 md:min-h-14 md:px-5">
            <Skeleton className="size-10 shrink-0 rounded-full md:size-9" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3 max-w-56" />
              <Skeleton className="h-3 w-1/2 max-w-40" />
            </div>
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="hidden h-4 w-24 lg:block" />
            <Skeleton className="hidden h-6 w-16 rounded-full md:block" />
            <Skeleton className="h-6 w-8" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-line-soft px-4 py-3 md:px-5">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          <Skeleton className="size-11 rounded-full md:size-9" />
          <Skeleton className="size-11 rounded-full md:size-9" />
        </div>
      </div>
    </div>
  )
}

/** Skeleton do detalhe do cliente: cabeçalho, abas sublinhadas e lista. */
export function ClientDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true" aria-hidden="true">
      <Skeleton className="mb-3 h-5 w-24" />
      <PageHeaderSkeleton actions={2} />
      <div className="flex gap-6 border-b border-line-soft pb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-20" />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-[1.375rem] bg-console p-4 ring-1 ring-line md:p-5">
            <Skeleton className="h-5 w-32" />
            <div className="mt-4 divide-y divide-line-soft">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between gap-4 py-3.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton do funil: chips no celular, cinco colunas no desktop. */
export function FunnelSkeleton() {
  return (
    <div className="flex flex-1 flex-col" aria-busy="true" aria-hidden="true">
      <Skeleton className="mb-3 h-5 w-24" />
      <PageHeaderSkeleton />
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-hidden px-4 lg:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-32 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:mt-0 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={i === 0 ? "space-y-3" : "hidden space-y-3 lg:block"}>
            <Skeleton className="h-5 w-28" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
