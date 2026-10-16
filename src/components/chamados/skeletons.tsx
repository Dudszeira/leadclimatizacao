import { Skeleton } from "@/components/ui/skeleton"

/** Skeleton da lista de chamados (cards no celular, tabela no desktop). */
export function ChamadosTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="flex flex-col gap-2.5 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-[1.375rem] bg-console p-4 ring-1 ring-line">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line max-md:hidden">
        <div className="border-b border-line-soft px-5 py-3.5">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="divide-y divide-line-soft">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex h-14 items-center gap-6 px-5">
              <Skeleton className="h-4 w-12" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3 max-w-56" />
                <Skeleton className="h-3 w-1/3 max-w-32" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="hidden h-4 w-20 lg:block" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-line-soft px-5 py-3">
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-2">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="size-9 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Skeleton da página da OS (cabeçalho, resumo e etapas de execução). */
export function ChamadoDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col" aria-hidden="true">
      <Skeleton className="mb-3 h-9 w-28 rounded-full" />
      <div className="flex flex-col gap-3 pb-6 md:pb-8">
        <Skeleton className="h-8 w-40 md:h-10" />
        <Skeleton className="h-4 w-64 max-w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-72 rounded-[1.375rem]" />
          <Skeleton className="h-56 rounded-[1.375rem]" />
        </div>
        <div className="flex flex-col gap-4 max-lg:order-first">
          <Skeleton className="h-60 rounded-[1.375rem]" />
          <Skeleton className="h-40 rounded-[1.375rem] max-lg:hidden" />
        </div>
      </div>
    </div>
  )
}
