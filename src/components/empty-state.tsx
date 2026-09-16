import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  actionLabel: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
}: EmptyStateProps) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-console/50 px-6 py-16 text-center">
      <div
        className="flex size-16 items-center justify-center rounded-2xl border border-line-soft bg-console-2"
        aria-hidden="true"
      >
        <Icon className="size-8 text-ink-faint" />
      </div>
      <h2 className="mt-6 font-display text-lg font-bold tracking-tight text-ink">
        {title}
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        {description}
      </p>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              disabled
              focusableWhenDisabled
              className="mt-8 h-11 px-5 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:bg-primary"
            />
          }
        >
          {actionLabel}
        </TooltipTrigger>
        <TooltipContent>Disponível na próxima etapa</TooltipContent>
      </Tooltip>
    </section>
  )
}
