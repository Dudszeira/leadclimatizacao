"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CalendarClockIcon, CalendarPlusIcon, LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import {
  generateMonthlyInvoices,
  markOverdueInvoices,
  type InvoiceActionResult,
} from "@/server/actions/invoices"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

export type CompetenciaChoice = { value: string; label: string }

type BillingRunActionsProps = {
  /** Competências oferecidas (BRT), a primeira é o mês corrente. */
  competencias: CompetenciaChoice[]
}

function notify(result: InvoiceActionResult) {
  if (result.status === "success") toast.success(result.message)
  else if (result.status === "info") toast.info(result.message)
  else toast.error(result.message)
}

/**
 * "Gerar faturas do mês" (RPC generate_monthly_invoices, com confirmação e
 * contagem de faturas criadas) e "Atualizar atrasadas" (mark_overdue_invoices).
 * Os jobs pg_cron já fazem isso sozinhos; aqui é o disparo manual do admin.
 */
export function BillingRunActions({ competencias }: BillingRunActionsProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [competencia, setCompetencia] = React.useState(competencias[0]?.value ?? "")
  const [pending, setPending] = React.useState<"gerar" | "atrasadas" | null>(null)
  const [, startTransition] = React.useTransition()
  const [lastResult, setLastResult] = React.useState<InvoiceActionResult | null>(null)
  const busyRef = React.useRef(false)

  const items = Object.fromEntries(competencias.map((c) => [c.value, c.label]))
  const label = items[competencia] ?? competencia

  function run(kind: "gerar" | "atrasadas", fn: () => Promise<InvoiceActionResult>) {
    if (busyRef.current) return
    busyRef.current = true
    setPending(kind)
    startTransition(async () => {
      try {
        const result = await fn()
        notify(result)
        if (kind === "gerar") setLastResult(result)
        if (result.status === "success") {
          if (kind === "gerar") setOpen(false)
          router.refresh()
        }
      } catch {
        toast.error("Não foi possível concluir a operação. Tente novamente.")
      } finally {
        busyRef.current = false
        setPending(null)
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        className="h-9 px-3 max-md:h-11"
        disabled={pending !== null}
        aria-busy={pending === "atrasadas"}
        onClick={() => run("atrasadas", () => markOverdueInvoices())}
      >
        {pending === "atrasadas" ? (
          <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
        ) : (
          <CalendarClockIcon aria-hidden="true" />
        )}
        Atualizar atrasadas
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return
          setOpen(next)
          if (next) setLastResult(null)
        }}
      >
        <DialogTrigger
          render={<Button className="h-9 px-3 max-md:h-11" disabled={pending !== null} />}
        >
          <CalendarPlusIcon aria-hidden="true" />
          Gerar faturas do mês
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar faturas da competência</DialogTitle>
            <DialogDescription>
              Cria uma fatura pendente para cada contrato ativo (exceto
              corretiva avulsa) vigente no mês, com vencimento no dia do
              contrato. Faturas que já existem não são duplicadas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="gerar-competencia">Competência</Label>
            <Select
              items={items}
              value={competencia}
              onValueChange={(value: string | null) => value && setCompetencia(value)}
            >
              <SelectTrigger id="gerar-competencia" aria-label="Competência" className="w-full max-md:h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {competencias.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {lastResult && lastResult.status !== "success" ? (
            <p
              role="status"
              className={
                lastResult.status === "error"
                  ? "rounded-lg border border-danger/40 bg-danger-dim px-3 py-2 text-sm text-danger"
                  : "rounded-lg border border-line bg-console-2 px-3 py-2 text-sm text-ink-dim"
              }
            >
              {lastResult.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending !== null}
              className="max-md:h-11"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => run("gerar", () => generateMonthlyInvoices(competencia))}
              disabled={pending !== null || !competencia}
              aria-busy={pending === "gerar"}
              className="max-md:h-11"
            >
              {pending === "gerar" ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              ) : (
                <CalendarPlusIcon aria-hidden="true" />
              )}
              Gerar faturas de {label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
