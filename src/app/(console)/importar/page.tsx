import type { Metadata } from "next"
import Link from "next/link"

import { requireRole } from "@/server/auth"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Importer } from "@/components/importar/importer"

export const metadata: Metadata = {
  title: "Importar planilha",
}

/** Carga inicial por CSV — só admin (a action também exige admin). */
export default async function ImportarPage() {
  await requireRole("admin")
  return (
    <div className="flex flex-1 flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link href="/clientes" />}
              className="inline-flex min-h-11 items-center md:min-h-0"
            >
              Clientes
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Importar planilha</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-ink">
          Importar planilha
        </h2>
        <p className="mt-1 text-sm text-ink-dim">
          Carga inicial de clientes, prédios e equipamentos a partir de CSV, com
          pré-visualização e validação linha a linha antes de gravar.
        </p>
      </header>
      <Importer />
    </div>
  )
}
