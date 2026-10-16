import { Skeleton } from "@/components/ui/skeleton"
import { AtendimentoSkeleton } from "@/components/atendimento/skeletons"

export default function AtendimentoLoading() {
  return (
    <div
      className="flex flex-1 flex-col md:h-[calc(100svh-8rem)] md:min-h-[34rem] md:flex-none"
      aria-busy="true"
    >
      <header className="flex flex-col gap-2.5 pb-6">
        <Skeleton className="h-8 w-48 md:h-10" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </header>
      <AtendimentoSkeleton />
    </div>
  )
}
