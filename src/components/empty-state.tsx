import type { LucideIcon } from "lucide-react"

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  /** Ação ou rodapé opcional, renderizado como veio (inclua o espaçamento). */
  children?: React.ReactNode
}

/** Estado vazio padrão das listas: ícone + título + descrição + ação. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: EmptyStateProps) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center rounded-[1.375rem] bg-console px-6 py-14 text-center ring-1 ring-line md:py-20">
      <div
        className="flex size-12 items-center justify-center rounded-full bg-console-2"
        aria-hidden="true"
      >
        <Icon className="size-5 text-ink-dim" />
      </div>
      <h3 className="mt-5 font-display text-xl font-medium tracking-[-0.02em] text-ink">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        {description}
      </p>
      {children}
    </section>
  )
}
