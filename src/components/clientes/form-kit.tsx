"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import type { ActionResult } from "./action-result"
import type { FieldErrors } from "./schemas"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Peças compartilhadas dos formulários de cadastro (clientes, prédios,
 * equipamentos, leads, PMOC): campo com erro acessível, select simples,
 * execução de action com toast/refresh e diálogo de confirmação.
 */

export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  const hintId = hint ? `${id}-dica` : null
  const errorId = error ? `${id}-erro` : null
  // A dica fica ligada ao campo sempre (não só quando há erro).
  let control = children
  if (hintId && React.isValidElement<{ "aria-describedby"?: string }>(children)) {
    const current = children.props["aria-describedby"]
    const ids = new Set([...(current ? current.split(" ") : []), hintId, ...(errorId ? [errorId] : [])])
    control = React.cloneElement(children, { "aria-describedby": [...ids].join(" ") })
  }
  return (
    <div className={className ? `grid min-w-0 gap-1.5 ${className}` : "grid min-w-0 gap-1.5"}>
      <Label htmlFor={id} className="text-ink-dim">{label}</Label>
      {control}
      {hint ? (
        <p id={`${id}-dica`} className="text-[0.8125rem] leading-snug text-ink-faint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-erro`} role="alert" className="text-[0.8125rem] leading-snug text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Props de acessibilidade do input conforme o erro do campo. */
export function invalidProps(id: string, error?: string) {
  return error
    ? { "aria-invalid": true as const, "aria-describedby": `${id}-erro` }
    : {}
}

export function SelectField({
  id,
  value,
  onChange,
  items,
  ariaLabel,
  error,
  disabled,
  className,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  items: Record<string, string>
  ariaLabel?: string
  error?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v: string | null) => onChange(v ?? "")}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        className={className ?? "w-full"}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([v, label]) => (
          <SelectItem key={v} value={v}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Executa uma server action de cadastro: controla o pending, mostra o toast
 * (info no modo demo), devolve os erros por campo e faz refresh no sucesso.
 */
export function useCadastroAction() {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})

  const run = React.useCallback(
    (action: () => Promise<ActionResult>, onSuccess?: (r: ActionResult) => void) => {
      startTransition(async () => {
        let result: ActionResult
        try {
          result = await action()
        } catch {
          result = { ok: false, message: "Falha de conexão. Tente novamente." }
        }
        setFieldErrors(result.fieldErrors ?? {})
        if (result.ok) {
          if (result.demo) toast.info(result.message)
          else toast.success(result.message)
          onSuccess?.(result)
          router.refresh()
        } else {
          toast.error(result.message)
        }
      })
    },
    [router],
  )

  return { pending, run, fieldErrors, setFieldErrors }
}

export function SubmitButton({
  pending,
  children,
  pendingLabel = "Salvando…",
  variant,
}: {
  pending: boolean
  children: React.ReactNode
  pendingLabel?: string
  variant?: "default" | "destructive"
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  )
}

/**
 * Confirmação antes de ações destrutivas/irreversíveis (inativar, encerrar,
 * excluir). Controlado pelo pai via open/onOpenChange.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = true,
  action,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel: string
  destructive?: boolean
  action: () => Promise<ActionResult>
  children?: React.ReactNode
}) {
  const { pending, run } = useCadastroAction()
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            aria-busy={pending}
            onClick={() => run(action, () => onOpenChange(false))}
          >
            {pending && <LoaderCircleIcon className="animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
