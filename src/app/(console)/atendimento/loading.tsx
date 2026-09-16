import { Skeleton } from "@/components/ui/skeleton"
import { AtendimentoSkeleton } from "@/components/atendimento/skeletons"

export default function AtendimentoLoading() {
  return (
    <div
      className="flex h-[calc(100svh-5.5rem)] min-h-0 flex-1 flex-col gap-4 md:h-[calc(100svh-6.5rem)]"
      aria-busy="true"
    >
      <header className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </header>
      <Skeleton className="h-10 w-full rounded-lg" />
      <AtendimentoSkeleton />
    </div>
  )
}
