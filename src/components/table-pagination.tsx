import Link from "next/link"
import { cn } from "cn"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"

type TablePaginationProps = {
  /** aria-label da nav, ex. "Paginação de clientes". */
  ariaLabel: string
  from: number
  to: number
  total: number
  page: number
  pageCount: number
  /** Substantivo no singular/plural, ex. "cliente"/"clientes". */
  singular: string
  plural: string
  prevHref: string
  nextHref: string
}

/** Rodapé de paginação das tabelas (contagem + página + anterior/próxima). */
export function TablePagination({
  ariaLabel,
  from,
  to,
  total,
  page,
  pageCount,
  singular,
  plural,
  prevHref,
  nextHref,
}: TablePaginationProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className="flex items-center justify-between gap-3 border-t border-line-soft px-4 py-3 md:px-5"
    >
      <p className="text-[0.8125rem] text-ink-dim">
        Mostrando{" "}
        <span className="text-ink tabular-nums">
          {from}–{to}
        </span>{" "}
        de <span className="text-ink tabular-nums">{total}</span>{" "}
        {total === 1 ? singular : plural}
      </p>
      <div className="flex items-center gap-2">
        <span className="hidden text-[0.8125rem] text-ink-faint tabular-nums sm:block">
          Página {page} de {pageCount}
        </span>
        <PaginationLink href={prevHref} disabled={page <= 1} label="Página anterior">
          <ChevronLeftIcon aria-hidden="true" />
        </PaginationLink>
        <PaginationLink
          href={nextHref}
          disabled={page >= pageCount}
          label="Próxima página"
        >
          <ChevronRightIcon aria-hidden="true" />
        </PaginationLink>
      </div>
    </nav>
  )
}

function PaginationLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  const className = cn(
    buttonVariants({ variant: "outline", size: "icon" }),
    disabled && "pointer-events-none opacity-50",
  )
  if (disabled) {
    return (
      <span className={className} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    )
  }
  return (
    <Link href={href} className={className} aria-label={label}>
      {children}
    </Link>
  )
}
