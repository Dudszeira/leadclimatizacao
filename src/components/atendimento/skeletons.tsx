import { Skeleton } from "@/components/ui/skeleton"

/** Skeleton do módulo de atendimento (lista + conversa + painel), usado no loading e no Suspense. */
export function AtendimentoSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 gap-4" aria-hidden="true">
      <div className="flex w-full flex-col gap-3 md:rounded-[1.375rem] md:bg-console md:p-3 md:ring-1 md:ring-line lg:w-80 lg:shrink-0 xl:w-[22.5rem]">
        <Skeleton className="h-11 w-full rounded-xl md:h-10" />
        <Skeleton className="h-11 w-full rounded-full md:h-10" />
        <div className="flex flex-col gap-0.5 rounded-[1.375rem] bg-console p-1.5 ring-1 ring-line md:bg-transparent md:p-1 md:ring-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-3 py-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3.5 w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="hidden min-h-72 flex-1 flex-col overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line lg:flex">
        <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-3 p-5">
          <Skeleton className="h-14 w-2/3 self-start rounded-[1.25rem]" />
          <Skeleton className="h-16 w-2/3 self-end rounded-[1.25rem]" />
          <Skeleton className="h-8 w-64 max-w-full self-center rounded-full" />
          <Skeleton className="h-14 w-1/2 self-end rounded-[1.25rem]" />
        </div>
        <div className="flex items-center gap-2 border-t border-line-soft p-4">
          <Skeleton className="h-11 flex-1 rounded-full" />
          <Skeleton className="size-10 rounded-full" />
        </div>
      </div>
      <div className="hidden w-80 shrink-0 flex-col gap-4 rounded-[1.375rem] bg-console p-5 ring-1 ring-line xl:flex">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
        <div className="mt-auto space-y-2">
          <Skeleton className="h-9 w-full rounded-full" />
          <Skeleton className="h-9 w-full rounded-full" />
        </div>
      </div>
    </div>
  )
}
