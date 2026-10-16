import * as React from "react"
import { cn } from "cn"
import { CheckIcon } from "lucide-react"

import { CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Cabeçalho de etapa da execução: número da etapa (vira um check quando a
 * etapa está completa), título e um complemento à direita (progresso).
 */
export function StepHeading({
  step,
  title,
  done,
  aside,
  id,
}: {
  step?: number
  title: React.ReactNode
  done?: boolean
  aside?: React.ReactNode
  id?: string
}) {
  return (
    <CardHeader>
      <div className="flex min-h-9 items-center gap-3">
        {step !== undefined && (
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-[0.8125rem] font-medium tabular-nums transition-colors duration-200",
              done ? "bg-clear-dim text-clear" : "bg-console-2 text-ink-dim",
            )}
            aria-hidden="true"
          >
            {done ? <CheckIcon className="size-4" /> : step}
          </span>
        )}
        <CardTitle id={id} className="min-w-0 flex-1">
          {title}
          {done !== undefined && <span className="sr-only">{done ? ", completa" : ", pendente"}</span>}
        </CardTitle>
        {aside}
      </div>
    </CardHeader>
  )
}
