"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CheckIcon,
  CopyIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FileDownIcon,
  LoaderCircleIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import type { UserRole } from "@/lib/types"
import { addDaysToDateKey, todayBRT } from "@/lib/format"
import type { QuoteActionResult } from "@/lib/quotes/schemas"
import { approveQuote, declineQuote, deleteQuote, duplicateQuote } from "@/server/actions/quotes"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog, Field, invalidProps } from "@/components/clientes/form-kit"
import { Segmented } from "./segmented"

type QuoteActionsProps = {
  id: string
  numeroLabel: string
  aguardando: boolean
  role: UserRole
}

type DialogKind = "aprovar" | "declinar" | "excluir" | null

/**
 * Ações do orçamento. Os 3 papéis: PDF, editar (só aguardando) e duplicar.
 * Só admin: aprovar, declinar e excluir (escondidos para os demais).
 */
export function QuoteActions({ id, numeroLabel, aguardando, role }: QuoteActionsProps) {
  const router = useRouter()
  const [dialog, setDialog] = React.useState<DialogKind>(null)
  const [duplicating, startDuplicate] = React.useTransition()
  const admin = role === "admin"
  const close = (open: boolean) => !open && setDialog(null)

  function duplicar() {
    startDuplicate(async () => {
      let r: QuoteActionResult
      try {
        r = await duplicateQuote(id)
      } catch {
        r = { ok: false, message: "Falha de conexão. Tente novamente." }
      }
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      if (r.demo) toast.info(r.message)
      else toast.success(r.message)
      if (r.id) router.push(`/orcamentos/${r.id}/editar`)
      router.refresh()
    })
  }

  const pdf = (
    <a
      href={`/api/orcamentos/${id}/pdf`}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({ variant: "secondary" })}
    >
      <FileDownIcon aria-hidden="true" />
      Abrir PDF
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  )

  const editarHref = `/orcamentos/${id}/editar`

  return (
    <>
      {aguardando && admin ? (
        <Button onClick={() => setDialog("aprovar")}>
          <CheckIcon aria-hidden="true" />
          Aprovar
        </Button>
      ) : aguardando ? (
        <Link href={editarHref} className={buttonVariants()}>
          <PencilIcon aria-hidden="true" />
          Editar
        </Link>
      ) : null}
      {pdf}
      {!aguardando ? (
        <Button variant="outline" onClick={duplicar} disabled={duplicating} aria-busy={duplicating}>
          {duplicating ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          ) : (
            <CopyIcon aria-hidden="true" />
          )}
          Duplicar
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="secondary" aria-label="Mais ações do orçamento" disabled={duplicating} />}
          >
            {duplicating ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
            ) : (
              <EllipsisIcon aria-hidden="true" />
            )}
            <span className="md:sr-only">Mais</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {admin && (
              <DropdownMenuItem onClick={() => router.push(editarHref)}>
                <PencilIcon aria-hidden="true" />
                Editar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={duplicar}>
              <CopyIcon aria-hidden="true" />
              Duplicar
            </DropdownMenuItem>
            {admin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDialog("declinar")}>
                  <XIcon aria-hidden="true" />
                  Declinar
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => setDialog("excluir")}>
                  <Trash2Icon aria-hidden="true" />
                  Excluir
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {admin && aguardando && (
        <>
          <ApproveDialog id={id} numeroLabel={numeroLabel} open={dialog === "aprovar"} onOpenChange={close} />
          <DeclineDialog id={id} numeroLabel={numeroLabel} open={dialog === "declinar"} onOpenChange={close} />
          <ConfirmDialog
            open={dialog === "excluir"}
            onOpenChange={close}
            title={`Excluir ${numeroLabel}?`}
            description="O orçamento e os itens são apagados de vez. Para guardar o histórico, prefira declinar."
            confirmLabel="Excluir orçamento"
            action={async () => {
              const r = await deleteQuote(id)
              if (r.ok && !r.demo) router.push("/orcamentos")
              return r
            }}
          />
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Aprovar: vencimento + método; mostra o resultado (OS e cobrança)
// ---------------------------------------------------------------------------

function ApproveDialog({
  id,
  numeroLabel,
  open,
  onOpenChange,
}: {
  id: string
  numeroLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, setPending] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <ApproveBody id={id} numeroLabel={numeroLabel} onClose={() => onOpenChange(false)} onPending={setPending} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ApproveBody({
  id,
  numeroLabel,
  onClose,
  onPending,
}: {
  id: string
  numeroLabel: string
  onClose: () => void
  onPending: (pending: boolean) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [vencimento, setVencimento] = React.useState(() => addDaysToDateKey(todayBRT(), 7))
  const [metodo, setMetodo] = React.useState<"pix" | "boleto">("pix")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [result, setResult] = React.useState<QuoteActionResult | null>(null)

  React.useEffect(() => onPending(pending), [pending, onPending])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      let r: QuoteActionResult
      try {
        r = await approveQuote(id, { vencimento, metodo })
      } catch {
        r = { ok: false, message: "Falha de conexão. Tente novamente." }
      }
      setErrors(r.fieldErrors ?? {})
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      if (r.demo) toast.info("Modo demonstração: nada foi gravado.")
      else toast.success("Orçamento aprovado.")
      setResult(r)
      router.refresh()
    })
  }

  return (
    <>
      {result ? (
        <>
          <DialogHeader>
            <DialogTitle>{result.demo ? "Aprovação simulada" : `${numeroLabel} aprovado`}</DialogTitle>
            <DialogDescription>{result.message}</DialogDescription>
          </DialogHeader>
          {!result.demo && (
            <dl className="flex flex-col divide-y divide-line-soft rounded-2xl bg-console px-4 ring-1 ring-line">
              <div className="flex min-h-12 items-center justify-between gap-3 py-2.5">
                <dt className="text-sm text-ink-dim">Ordem de serviço</dt>
                <dd>
                  {result.serviceOrderId ? (
                    <Link
                      href={`/chamados/${result.serviceOrderId}`}
                      className="inline-flex min-h-11 items-center gap-1.5 text-sm text-signal underline-offset-4 hover:underline md:min-h-0"
                    >
                      Abrir OS
                      <ExternalLinkIcon className="size-3.5" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="text-sm text-ink-faint">Não informada</span>
                  )}
                </dd>
              </div>
              <div className="flex min-h-12 items-center justify-between gap-3 py-2.5">
                <dt className="text-sm text-ink-dim">Cobrança</dt>
                <dd>
                  {result.cobranca === "gerada" ? (
                    <span className="inline-flex h-6 items-center rounded-full bg-clear-dim px-2.5 text-xs font-medium text-clear">
                      Gerada
                    </span>
                  ) : (
                    <Link
                      href="/financeiro"
                      className="inline-flex h-6 items-center rounded-full bg-amber-dim px-2.5 text-xs font-medium text-amber outline-none focus-visible:ring-3 focus-visible:ring-signal/50"
                    >
                      Pendente, gere pelo Financeiro
                    </Link>
                  )}
                </dd>
              </div>
            </dl>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => onClose()}>
              Concluir
            </Button>
          </DialogFooter>
        </>
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Aprovar {numeroLabel}?</DialogTitle>
            <DialogDescription>
              Abre a ordem de serviço, cria a fatura e tenta gerar a cobrança no Asaas. Depois de aprovado, o orçamento
              não pode mais ser editado.
            </DialogDescription>
          </DialogHeader>
          <Field id="aprovar-vencimento" label="Vencimento da cobrança" error={errors.vencimento}>
            <Input
              id="aprovar-vencimento"
              type="date"
              value={vencimento}
              min={todayBRT()}
              onChange={(e) => setVencimento(e.target.value)}
              {...invalidProps("aprovar-vencimento", errors.vencimento)}
            />
          </Field>
          <div className="grid gap-1.5">
            <span id="aprovar-metodo-label" className="text-sm font-medium text-ink-dim">
              Forma de pagamento
            </span>
            <Segmented
              labelledBy="aprovar-metodo-label"
              value={metodo}
              onChange={(v) => setMetodo(v as "pix" | "boleto")}
              options={[
                { value: "pix", label: "Pix" },
                { value: "boleto", label: "Boleto" },
              ]}
            />
            {errors.metodo ? (
              <p role="alert" className="text-[0.8125rem] text-danger">
                {errors.metodo}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose()} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? (
                <>
                  <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                  Aprovando…
                </>
              ) : (
                "Aprovar e gerar OS"
              )}
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Declinar: motivo opcional
// ---------------------------------------------------------------------------

function DeclineDialog({
  id,
  numeroLabel,
  open,
  onOpenChange,
}: {
  id: string
  numeroLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, setPending] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <DeclineBody id={id} numeroLabel={numeroLabel} onClose={() => onOpenChange(false)} onPending={setPending} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DeclineBody({
  id,
  numeroLabel,
  onClose,
  onPending,
}: {
  id: string
  numeroLabel: string
  onClose: () => void
  onPending: (pending: boolean) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [motivo, setMotivo] = React.useState("")
  const [error, setError] = React.useState<string | undefined>()

  React.useEffect(() => onPending(pending), [pending, onPending])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      let r: QuoteActionResult
      try {
        r = await declineQuote(id, { motivo })
      } catch {
        r = { ok: false, message: "Falha de conexão. Tente novamente." }
      }
      setError(r.fieldErrors?.motivo)
      if (!r.ok) {
        toast.error(r.message)
        return
      }
      if (r.demo) toast.info(r.message)
      else toast.success(r.message)
      onClose()
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Declinar {numeroLabel}?</DialogTitle>
        <DialogDescription>
          O cliente não aceitou. O orçamento fica no histórico e pode ser duplicado depois.
        </DialogDescription>
      </DialogHeader>
      <Field id="declinar-motivo" label="Motivo (opcional)" error={error}>
        <Textarea
          id="declinar-motivo"
          rows={3}
          maxLength={1000}
          value={motivo}
          placeholder="Ex.: preço acima do orçamento do cliente"
          onChange={(e) => setMotivo(e.target.value)}
          {...invalidProps("declinar-motivo", error)}
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onClose()} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="destructive" disabled={pending} aria-busy={pending}>
          {pending && <LoaderCircleIcon className="animate-spin" aria-hidden="true" />}
          Declinar orçamento
        </Button>
      </DialogFooter>
    </form>
  )
}
