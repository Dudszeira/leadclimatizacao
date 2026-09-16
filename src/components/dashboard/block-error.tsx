"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

type BlockErrorProps = {
  message: string
  className?: string
}

/** Estado de erro de um bloco do dashboard: mensagem do data layer + tentar de novo. */
export function BlockError({ message, className }: BlockErrorProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-danger/40 bg-danger-dim/50 px-6 py-8 text-center",
        className
      )}
    >
      <TriangleAlertIcon className="size-5 text-danger" aria-hidden="true" />
      <p className="max-w-sm text-sm leading-relaxed text-ink-dim">{message}</p>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        <RotateCcwIcon aria-hidden="true" />
        {pending ? "Recarregando…" : "Tentar de novo"}
      </Button>
    </div>
  )
}
