import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Skeleton da linha de KPIs do Financeiro. */
export function FinanceiroKpisSkeleton() {
  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-hidden="true"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} size="sm" className="gap-0">
          <div className="flex items-start justify-between gap-2 px-(--card-spacing)">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <Skeleton className="mx-(--card-spacing) mt-2 h-7 w-28" />
          <Skeleton className="mx-(--card-spacing) mt-2 h-3 w-36" />
        </Card>
      ))}
    </div>
  )
}

/** Skeleton da tabela de faturas (lista e refetch por busca/filtros). */
export function FaturasTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-line bg-console"
      aria-hidden="true"
    >
      <div className="border-b border-line-soft px-4 py-3">
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="divide-y divide-line-soft">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3 max-w-56" />
              <Skeleton className="h-3 w-1/3 max-w-32" />
            </div>
            <Skeleton className="hidden h-4 w-16 md:block" />
            <Skeleton className="hidden h-4 w-20 lg:block" />
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="hidden h-4 w-24 lg:block" />
            <Skeleton className="size-8 rounded-md" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-line-soft px-4 py-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          <Skeleton className="size-9" />
          <Skeleton className="size-9" />
        </div>
      </div>
    </div>
  )
}

/** Skeleton da aba de contratos (resumo + tabela). */
export function ContratosSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} size="sm" className="gap-0">
            <div className="flex items-start justify-between gap-2 px-(--card-spacing)">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
            <Skeleton className="mx-(--card-spacing) mt-2 h-7 w-24" />
            <Skeleton className="mx-(--card-spacing) mt-2 h-3 w-32" />
          </Card>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-console">
        <div className="border-b border-line-soft px-4 py-3">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="divide-y divide-line-soft">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3 max-w-56" />
                <Skeleton className="h-3 w-1/3 max-w-32" />
              </div>
              <Skeleton className="hidden h-5 w-28 rounded-full md:block" />
              <Skeleton className="hidden h-4 w-20 lg:block" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
