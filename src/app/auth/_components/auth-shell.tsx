import { AirVentIcon } from "lucide-react"

type AuthShellProps = {
  /** Rótulo mono acima do título (ex.: "Acesso restrito"). */
  eyebrow: string
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}

/** Moldura das telas públicas de autenticação (login, recuperação, senha). */
export function AuthShell({ eyebrow, title, description, children, footer }: AuthShellProps) {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col bg-void">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/40 to-transparent"
      />
      <header className="flex items-center gap-3 px-4 pt-6 sm:px-8 sm:pt-8">
        <div
          className="flex size-9 items-center justify-center rounded-lg bg-signal-dim text-signal"
          aria-hidden="true"
        >
          <AirVentIcon className="size-4" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-sm font-bold tracking-tight text-ink">Control Lead</p>
          <p className="font-mono text-[10px] tracking-wider text-ink-faint uppercase">
            Console · Lead Climatização
          </p>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <section className="w-full max-w-[400px]">
          <p className="font-mono text-[11px] tracking-[0.18em] text-signal uppercase">{eyebrow}</p>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
            {title}
          </h1>
          {description ? (
            <div className="mt-2 text-sm leading-relaxed text-ink-dim">{description}</div>
          ) : null}
          <div className="mt-8 rounded-xl border border-line bg-console p-5 sm:p-6">{children}</div>
          {footer ? <div className="mt-6 text-sm text-ink-dim">{footer}</div> : null}
        </section>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-4 py-4 font-mono text-[10px] tracking-wider text-ink-faint uppercase sm:px-8">
        <span>Acesso monitorado · somente equipe autorizada</span>
        <span>Lead Climatização</span>
      </footer>
    </main>
  )
}
