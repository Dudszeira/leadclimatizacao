import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

/** Volta para a lista de clientes (acima do PageHeader das subtelas). */
export function BackToClients({ label = "Clientes" }: { label?: string }) {
  return (
    <Link
      href="/clientes"
      className={buttonVariants({
        variant: "ghost",
        className: "-ml-3 mb-2 self-start px-3 md:-ml-2.5 md:px-2.5",
      })}
    >
      <ChevronLeftIcon aria-hidden="true" />
      {label}
    </Link>
  )
}
