import Link from "next/link"
import { cn } from "cn"
import { ArrowLeftIcon, SearchXIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

export default function ChamadoNaoEncontrado() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-console/50 px-6 py-16 text-center">
      <div
        className="flex size-14 items-center justify-center rounded-2xl border border-line-soft bg-console-2"
        aria-hidden="true"
      >
        <SearchXIcon className="size-7 text-ink-faint" />
      </div>
      <h2 className="mt-5 font-display text-lg font-bold tracking-tight text-ink">
        Chamado não encontrado
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        A ordem de serviço pode ter sido removida ou o endereço está incorreto.
      </p>
      <Link
        href="/chamados"
        className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 px-5")}
      >
        <ArrowLeftIcon aria-hidden="true" />
        Voltar para chamados
      </Link>
    </section>
  )
}
