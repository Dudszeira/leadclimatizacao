import Link from "next/link"
import { ArrowLeftIcon, SearchXIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"

export default function ClienteNaoEncontrado() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Cliente" />
      <EmptyState
        icon={SearchXIcon}
        title="Cliente não encontrado"
        description="O cliente pode ter sido removido ou o endereço está incorreto. Volte para a lista e busque pelo nome ou CNPJ."
      >
        <Link
          href="/clientes"
          className={buttonVariants({ variant: "secondary", className: "mt-6" })}
        >
          <ArrowLeftIcon aria-hidden="true" />
          Voltar para clientes
        </Link>
      </EmptyState>
    </div>
  )
}
