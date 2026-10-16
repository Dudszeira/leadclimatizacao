import { BrandMark } from "@/components/brand-mark"

type StatusScreenProps = {
  /** Marca grande acima do título (ex.: "404") ou um ícone. */
  mark: React.ReactNode
  title: string
  description: React.ReactNode
  /** Código técnico opcional (digest do erro), mostrado discreto. */
  code?: string
  /** Botões de ação (o primeiro é o principal). */
  children: React.ReactNode
}

/**
 * Tela de estado fora do console (404 e erros na raiz): mesmo mundo do login,
 * tela cheia em grafite no celular e painel arredondado sobre a moldura no desktop.
 */
export function StatusScreen({ mark, title, description, code, children }: StatusScreenProps) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-void md:bg-shell md:p-2">
      <div className="flex flex-1 flex-col md:rounded-[1.75rem] md:bg-void md:ring-1 md:ring-line-soft">
        <header className="flex items-center gap-3 pt-[calc(env(safe-area-inset-top)+1.25rem)] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] md:px-8 md:pt-7">
          <BrandMark className="size-9" />
          <div className="leading-tight">
            <p className="font-display text-[0.9375rem] font-medium tracking-[-0.015em] text-ink">
              Control Lead
            </p>
            <p className="text-[0.8125rem] text-ink-dim">Lead Climatização</p>
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pl-[max(1rem,env(safe-area-inset-left))] pt-10 md:items-center md:px-8 md:text-center">
          <div className="w-full max-w-[28rem] md:flex md:flex-col md:items-center">
            <div aria-hidden="true">{mark}</div>
            <h1 className="mt-6 font-display text-[1.75rem] leading-[1.1] font-medium tracking-[-0.03em] text-ink md:text-[2rem]">
              {title}
            </h1>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-dim">{description}</p>
            <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:flex-wrap md:justify-center [&>*]:max-sm:w-full">
              {children}
            </div>
            {code ? (
              <p className="mt-6 text-[0.8125rem] text-ink-faint">
                Código para o suporte: <span className="text-ink-dim tabular-nums select-all">{code}</span>
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
