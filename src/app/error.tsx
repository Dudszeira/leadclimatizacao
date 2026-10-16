"use client"

import { useEffect } from "react"
import Link from "next/link"
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { StatusScreen } from "./auth/_components/status-screen"

/** Erro inesperado fora do console (login, autenticação). Não exibe detalhes. */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <StatusScreen
      mark={
        <span className="flex size-14 items-center justify-center rounded-full bg-amber-dim">
          <TriangleAlertIcon className="size-6 text-amber" />
        </span>
      }
      title="Algo saiu do esperado"
      description="Não conseguimos carregar esta página. Tente de novo; se continuar, informe o código abaixo ao suporte."
      code={error.digest}
    >
      <Button size="lg" onClick={() => retry()}>
        <RotateCcwIcon aria-hidden="true" />
        Tentar de novo
      </Button>
      <Link href="/" className={buttonVariants({ variant: "secondary", size: "lg" })}>
        Ir para o início
      </Link>
    </StatusScreen>
  )
}
