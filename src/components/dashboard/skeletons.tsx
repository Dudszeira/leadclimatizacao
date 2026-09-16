import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

function StatCardSkeleton() {
  return (
    <Card size="sm" className="gap-0">
      <div className="flex items-start justify-between gap-2 px-(--card-spacing)">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <Skeleton className="mt-3 ml-(--card-spacing) h-7 w-16" />
      <Skeleton className="mt-3 ml-(--card-spacing) h-3 w-36" />
    </Card>
  )
}

export function KpisSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
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

export function ChartSkeleton() {
  return (
    <Card aria-label="Carregando gráfico de chamados" aria-busy="true">
      <CardHeader>
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-3 w-40" />
      </CardHeader>
      <CardContent>
        <div className="flex h-56 items-end gap-4 px-2">
          <Skeleton className="h-[70%] flex-1" />
          <Skeleton className="h-[85%] flex-1" />
          <Skeleton className="h-[60%] flex-1" />
          <Skeleton className="h-[75%] flex-1" />
          <Skeleton className="h-[45%] flex-1" />
          <Skeleton className="h-[55%] flex-1" />
        </div>
      </CardContent>
    </Card>
  )
}

export function ListaSkeleton({ linhas = 5 }: { linhas?: number }) {
  return (
    <Card aria-label="Carregando lista" aria-busy="true">
      <CardHeader>
        <Skeleton className="h-4 w-44" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {Array.from({ length: linhas }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16 rounded-4xl" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function FunilSkeleton() {
  return (
    <Card aria-label="Carregando funil comercial" aria-busy="true">
      <CardHeader>
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-3 rounded-lg border border-line-soft p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-28" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-4 h-10 w-full" />
      </CardContent>
    </Card>
  )
}

export function PmocSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      aria-label="Carregando situação PMOC"
      aria-busy="true"
    >
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  )
}
