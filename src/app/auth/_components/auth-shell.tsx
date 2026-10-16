import { BrandMark } from "@/components/brand-mark"

type AuthShellProps = {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}

/**
 * Moldura das telas públicas de autenticação (login, recuperação, senha).
 * Celular: tela cheia em grafite, marca no topo e formulário direto no fundo.
 * Desktop: painel arredondado sobre a moldura, como o resto do sistema, com a
 * coluna da marca à esquerda e o formulário em cartão à direita.
 */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-void lg:bg-shell lg:p-2">
      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:overflow-hidden lg:rounded-[1.75rem] lg:bg-void lg:ring-1 lg:ring-line-soft">
        {/* Marca (topo no celular, coluna inteira no desktop) */}
        <div className="flex flex-col pt-[calc(env(safe-area-inset-top)+1.25rem)] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] sm:px-8 lg:justify-between lg:p-12 xl:p-14">
          <BrandLockup />
          <div className="hidden lg:block">
            <AirflowLines />
            <p className="mt-10 max-w-[18ch] font-display text-[2.5rem] leading-[1.06] font-medium tracking-[-0.03em] text-ink xl:text-[2.875rem]">
              Chamados, PMOC e equipe de campo no mesmo painel.
            </p>
          </div>
          <p className="hidden text-[0.8125rem] text-ink-faint lg:block">
            Acesso restrito à equipe autorizada da Lead Climatização.
          </p>
        </div>

        {/* Formulário */}
        <div className="flex flex-1 flex-col justify-center pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] pt-10 pb-8 sm:px-8 lg:px-12 lg:py-12">
          <section className="mx-auto w-full max-w-[25rem] lg:max-w-[27rem] lg:rounded-[1.375rem] lg:bg-console lg:p-9 lg:ring-1 lg:ring-line">
            <h1 className="font-display text-[1.75rem] leading-[1.1] font-medium tracking-[-0.03em] text-ink sm:text-[2rem] lg:text-[1.875rem]">
              {title}
            </h1>
            {description ? (
              <div className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink-dim">
                {description}
              </div>
            ) : null}
            <div className="mt-8">{children}</div>
            {footer ? (
              <div className="mt-8 border-t border-line-soft pt-6 text-sm leading-relaxed text-ink-dim">
                {footer}
              </div>
            ) : null}
          </section>
        </div>

        <footer className="pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pl-[max(1rem,env(safe-area-inset-left))] text-[0.8125rem] text-ink-faint sm:px-8 lg:hidden">
          Acesso restrito à equipe autorizada da Lead Climatização.
        </footer>
      </div>
    </main>
  )
}

function BrandLockup() {
  return (
    <div className="flex items-center gap-3">
      <BrandMark className="size-10 lg:size-11" />
      <div className="leading-tight">
        <p className="font-display text-base font-medium tracking-[-0.015em] text-ink">
          Control Lead
        </p>
        <p className="text-[0.8125rem] text-ink-dim">Lead Climatização</p>
      </div>
    </div>
  )
}

/**
 * Linhas de fluxo de ar saindo de um difusor: o mesmo traço curvo do símbolo,
 * repetido em linhas finas. Só decoração (cor de linha, sem brilho).
 */
function AirflowLines() {
  const rows = [-3, -2, -1, 0, 1, 2, 3]
  return (
    <svg
      viewBox="0 0 560 220"
      fill="none"
      aria-hidden="true"
      className="h-auto w-full max-w-[34rem]"
    >
      {rows.map((r) => {
        const y = 110 + r * 22
        const end = 110 + r * 34
        return (
          <path
            key={r}
            d={`M0 ${y} H200 C300 ${y} 330 ${end} 560 ${end}`}
            stroke={r === 1 ? "var(--signal)" : "var(--line)"}
            strokeOpacity={r === 1 ? 0.7 : 1}
            strokeWidth={r === 1 ? 2 : 1.25}
            strokeLinecap="round"
          />
        )
      })}
      <rect x="0" y="36" width="10" height="148" rx="5" fill="var(--console-3)" />
    </svg>
  )
}
