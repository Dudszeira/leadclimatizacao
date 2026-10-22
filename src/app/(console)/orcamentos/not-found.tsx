import Link from "next/link"
import { cn } from "cn"
import { ArrowLeftIcon, SearchXIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

export default function OrcamentoNaoEncontrado() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center rounded-[1.375rem] bg-console px-6 py-16 text-center ring-1 ring-line">
      <div className="flex size-12 items-center justify-center rounded-full bg-console-2" aria-hidden="true">
        <SearchXIcon className="size-5 text-ink-dim" />
      </div>
      <h2 className="mt-5 font-display text-xl font-medium tracking-[-0.02em] text-ink">
        Orçamento não encontrado
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        O endereço não corresponde a nenhum orçamento. Ele pode ter sido excluído.
      </p>
      <Link href="/orcamentos" className={cn(buttonVariants({ variant: "outline" }), "mt-6")}>
        <ArrowLeftIcon aria-hidden="true" />
        Voltar para orçamentos
      </Link>
    </section>
  )
}
