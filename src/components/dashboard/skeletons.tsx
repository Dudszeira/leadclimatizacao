import { cn } from "cn"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Esqueletos com a mesma geometria das seções reais (sem salto de layout). */

function StatCardSkeleton() {
  return (
    <div className="flex flex-col rounded-[1.375rem] bg-card p-3.5 ring-1 ring-line md:p-5">
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="mt-4 h-7 w-16 md:mt-5 md:h-9" />
      <Skeleton className="mt-2.5 h-3 w-2/3" />
    </div>
  )
}

export function KpisSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-2.5 md:gap-4 xl:grid-cols-4"
      aria-label="Carregando indicadores"
      aria-busy="true"
    >
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  )
}

function HeaderSkeleton() {
  return (
    <CardHeader>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3.5 w-56 max-w-full" />
    </CardHeader>
  )
}

const BARRAS = [55, 70, 48, 62, 38, 80]

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className} aria-label="Carregando gráfico de chamados" aria-busy="true">
      <HeaderSkeleton />
      <CardContent className="flex flex-1 flex-col justify-end">
        <div className="flex h-52 items-end gap-3 pb-7 pl-8 sm:h-64 sm:gap-5 lg:h-72">
          {BARRAS.map((h, i) => (
            <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-sm" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line-soft pt-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-6 w-12" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** Lista de linhas com ícone/data à esquerda e texto em duas linhas. */
export function ListaSkeleton({
  linhas = 5,
  className,
  colunas = 1,
}: {
  linhas?: number
  className?: string
  colunas?: 1 | 2
}) {
  return (
    <Card className={className} aria-label="Carregando lista" aria-busy="true">
      <HeaderSkeleton />
      <CardContent>
        <div className={cn("grid grid-cols-1", colunas === 2 && "md:grid-cols-2 md:gap-x-6")}>
          {Array.from({ length: linhas }, (_, i) => (
            <div key={i} className="flex min-h-14 items-center gap-3 border-b border-line-soft py-2.5 last:border-b-0">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function FunilSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className} aria-label="Carregando funil comercial" aria-busy="true">
      <HeaderSkeleton />
      <CardContent>
        <div className="divide-y divide-line-soft">
          {[100, 60, 35, 15].map((w, i) => (
            <div key={i} className="space-y-2 py-3 first:pt-0">
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-4 w-8" />
              </div>
              <Skeleton className="h-2 rounded-full" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line-soft pt-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20 max-w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function PmocSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className} aria-label="Carregando situação PMOC" aria-busy="true">
      <HeaderSkeleton />
      <CardContent>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="mt-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex min-h-14 items-center gap-3 border-b border-line-soft py-2.5 last:border-b-0">
              <Skeleton className="size-2 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-44 max-w-full" />
              </div>
              <Skeleton className="h-6 w-6" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
