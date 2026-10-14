"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, toast, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Erros ficam 10s na tela e têm botão de fechar: quem está em campo pode não
// estar olhando no momento em que a falha aparece.
const ERROR_DURATION = 10_000
const patched = toast as typeof toast & { __errorDefaults?: boolean }
if (!patched.__errorDefaults) {
  const originalError = toast.error
  patched.error = (message, data) =>
    originalError(message, { duration: ERROR_DURATION, closeButton: true, ...data })
  patched.__errorDefaults = true
}

const MOBILE_QUERY = "(max-width: 767px)"

function subscribeMobile(onChange: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  // Celular: topo central (não briga com a barra de concluir nem com o teclado).
  const mobile = React.useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  )

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={mobile ? "top-center" : "bottom-right"}
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        closeButtonAriaLabel: "Fechar aviso",
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
