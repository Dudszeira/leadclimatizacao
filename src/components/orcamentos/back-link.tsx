import Link from "next/link"
import { cn } from "cn"
import { ChevronLeftIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

/** Volta (acima do PageHeader das subtelas de orçamentos). */
export function QuotesBackLink({ href = "/orcamentos", label = "Orçamentos" }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-3 w-fit md:-ml-3")}
    >
      <ChevronLeftIcon aria-hidden="true" />
      {label}
    </Link>
  )
}
