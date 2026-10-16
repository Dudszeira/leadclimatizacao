import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"

import { requireRole } from "@/server/auth"
import { PageHeader } from "@/components/page-header"
import { Importer } from "@/components/importar/importer"

export const metadata: Metadata = {
  title: "Importar planilha",
}

/** Carga inicial por CSV, só admin (a action também exige admin). */
export default async function ImportarPage() {
  await requireRole("admin")
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Link
        href="/clientes"
        className="-ml-1 mb-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-2 text-sm text-ink-dim transition-colors hover:text-ink focus-visible:ring-3 focus-visible:ring-signal/50 focus-visible:outline-none md:min-h-8"
      >
        <ChevronLeftIcon className="size-4" aria-hidden="true" />
        Clientes
      </Link>
      <PageHeader
        title="Importar planilha"
        description="Traga clientes, prédios e equipamentos de um CSV. Você confere linha a linha antes de gravar."
      />
      <Importer />
    </div>
  )
}
