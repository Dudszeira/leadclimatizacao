import * as React from "react"
import { cn } from "cn"

/**
 * Cabeçalho de página: título grande (o h1 da tela), descrição curta e ações.
 * No celular as ações descem para uma linha própria e esticam até a borda;
 * a barra superior mostra o título compacto quando a página rola.
 */
export function PageHeader({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  /** Abas ou filtros que pertencem ao cabeçalho (ficam abaixo do título). */
  children?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex flex-col gap-5 pb-6 md:pb-8", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="min-w-0 space-y-1.5">
          <h1
            data-page-title
            className="font-display text-[1.75rem] leading-[1.1] font-medium tracking-[-0.03em] text-ink md:text-[2.25rem]"
          >
            {title}
          </h1>
          {description ? (
            <p className="max-w-[60ch] text-[0.9375rem] leading-relaxed text-ink-dim">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 max-md:[&>*]:flex-1">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </header>
  )
}
