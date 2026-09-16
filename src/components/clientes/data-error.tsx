"use client"

import { useRouter } from "next/navigation"
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

type DataErrorProps = {
  message: string
}

/** Estado de erro do data layer com ação de tentar novamente. */
export function DataError({ message }: DataErrorProps) {
  const router = useRouter()

  return (
    <section
      role="alert"
      className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-console/50 px-6 py-16 text-center"
    >
      <div
        className="flex size-14 items-center justify-center rounded-2xl border border-line-soft bg-danger-dim"
        aria-hidden="true"
      >
        <TriangleAlertIcon className="size-7 text-danger" />
      </div>
      <h2 className="mt-5 font-display text-lg font-bold tracking-tight text-ink">
        Algo deu errado
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        {message}
      </p>
      <Button
        variant="outline"
        className="mt-6 h-11 px-5"
        onClick={() => router.refresh()}
      >
        <RotateCwIcon aria-hidden="true" />
        Tentar novamente
      </Button>
    </section>
  )
}
