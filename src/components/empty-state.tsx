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
    <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-console/50 px-6 py-16 text-center">
      <div
        className="flex size-14 items-center justify-center rounded-2xl border border-line-soft bg-console-2"
        aria-hidden="true"
      >
        <Icon className="size-7 text-ink-faint" />
      </div>
      <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-ink">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        {description}
      </p>
      {children}
    </section>
  )
}
