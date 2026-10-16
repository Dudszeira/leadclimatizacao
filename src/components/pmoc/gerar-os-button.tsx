"use client"

import * as React from "react"
import { LoaderCircleIcon, ZapIcon } from "lucide-react"
import { toast } from "sonner"

import { gerarOsPmoc } from "@/server/actions/pmoc"
import { Button } from "@/components/ui/button"

/**
 * Dispara a geração de OS preventivas para os planos devidos (atrasados e
 * vencendo em até 7 dias) via RPC generate_pmoc_service_orders.
 */
export function GerarOsButton({ className }: { className?: string }) {
  const [isPending, startTransition] = React.useTransition()

  return (
    <Button
      disabled={isPending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          const result = await gerarOsPmoc()
          if (result.status === "success") toast.success(result.message)
          else toast.error(result.message)
        })
      }
    >
      {isPending ? (
        <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
      ) : (
        <ZapIcon aria-hidden="true" />
      )}
      {isPending ? "Gerando OS…" : "Gerar OS agora"}
    </Button>
  )
}
