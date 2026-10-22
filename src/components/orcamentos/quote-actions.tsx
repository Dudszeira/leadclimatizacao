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
  RotateCwIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import type { UserRole } from "@/lib/types"
import { addDaysToDateKey, formatBRL, todayBRT } from "@/lib/format"
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
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog, Field, invalidProps } from "@/components/clientes/form-kit"
import { DateField } from "./date-field"
import { Segmented } from "./segmented"

type QuoteActionsProps = {
  id: string
  numeroLabel: string
  aguardando: boolean
  role: UserRole
  /** Total do orçamento (mostrado no diálogo Aprovar). */
  total: number
  clienteNome: string
  /** quote.updated_at (ISO): o servidor recusa a aprovação se o orçamento mudou depois. */
  updatedAt: string
  /** Aguardando com validade já passada. */
  vencido: boolean
}

type DialogKind = "aprovar" | "declinar" | "excluir" | null

/**
 * Ações do orçamento. Os 3 papéis: PDF, editar (só aguardando) e duplicar.
 * Só admin: aprovar, declinar e excluir (escondidos para os demais).
 */
export function QuoteActions({
  id,
  numeroLabel,
  aguardando,
  role,
  total,
  clienteNome,
  updatedAt,
  vencido,
}: QuoteActionsProps) {
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
          <ApproveDialog
            info={{ id, numeroLabel, total, clienteNome, updatedAt, vencido }}
            open={dialog === "aprovar"}
            onOpenChange={close}
          />
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

type ApproveInfo = {
  id: string
  numeroLabel: string
  total: number
  clienteNome: string
  updatedAt: string
  vencido: boolean
}

function ApproveDialog({
  info,
  open,
  onOpenChange,
}: {
  info: ApproveInfo
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, setPending] = React.useState(false)
  // Sem foco inicial num campo: no celular o foco abriria o teclado/seletor de data.
  const popupRef = React.useRef<HTMLDivElement>(null)
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent ref={popupRef} initialFocus={popupRef} className="sm:max-w-md">
        {open && <ApproveBody info={info} onClose={() => onOpenChange(false)} onPending={setPending} />}
      </DialogContent>
    </Dialog>
  )
}

function ApproveBody({
  info,
  onClose,
  onPending,
}: {
  info: ApproveInfo
  onClose: () => void
  onPending: (pending: boolean) => void
}) {
  const { id, numeroLabel, total, clienteNome, updatedAt } = info
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [vencimento, setVencimento] = React.useState(() => addDaysToDateKey(todayBRT(), 7))
  const [metodo, setMetodo] = React.useState<"pix" | "boleto">("pix")
  // Vencido pelo relógio local ou porque o servidor respondeu code "vencido".
  const [vencido, setVencido] = React.useState(info.vencido)
  const [aceitarVencido, setAceitarVencido] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [result, setResult] = React.useState<QuoteActionResult | null>(null)
  const [conflito, setConflito] = React.useState<string | null>(null)

  React.useEffect(() => onPending(pending), [pending, onPending])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (vencido && !aceitarVencido) {
      setErrors({ aceitarVencido: "Marque para aprovar um orçamento com a validade vencida." })
      return
    }
    startTransition(async () => {
      let r: QuoteActionResult
      try {
        r = await approveQuote(id, {
          vencimento,
          metodo,
          updatedAt,
          ...(vencido ? { aceitarVencido: true } : {}),
        })
      } catch {
        r = { ok: false, message: "Falha de conexão. Tente novamente." }
      }
      setErrors(r.fieldErrors ?? {})
      if (!r.ok) {
        if (r.code === "alterado") {
          setConflito(r.message)
          return
        }
        if (r.code === "vencido") {
          setVencido(true)
          setErrors({ aceitarVencido: r.message })
          return
        }
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
        <form onSubmit={submit} noValidate className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <DialogHeader>
            <DialogTitle>Aprovar {numeroLabel}?</DialogTitle>
            <DialogDescription>
              Você vai aprovar {numeroLabel} de <span className="text-ink">{formatBRL(total)}</span> para{" "}
              <span className="text-ink">{clienteNome}</span>; isso cria a OS e a cobrança. Depois de aprovado, o
              orçamento não pode mais ser editado.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-w-0 flex-col gap-1.5 rounded-2xl bg-console px-4 py-3.5 ring-1 ring-line">
            <span className="truncate text-[0.8125rem] text-ink-dim">Total para {clienteNome}</span>
            <span className="font-display text-[1.75rem] leading-none font-medium tracking-[-0.03em] text-ink tabular-nums">
              {formatBRL(total)}
            </span>
          </div>
          {conflito ? (
            <div role="alert" className="flex flex-col gap-3 rounded-2xl bg-amber-dim px-4 py-3.5">
              <p className="flex gap-2 text-sm leading-snug text-ink">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber" aria-hidden="true" />
                {conflito}
              </p>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-fit"
                onClick={() => {
                  router.refresh()
                  onClose()
                }}
              >
                <RotateCwIcon aria-hidden="true" />
                Recarregar
              </Button>
            </div>
          ) : null}
          {vencido ? (
            <div className="flex flex-col gap-3 rounded-2xl bg-danger-dim px-4 py-3.5">
              <p className="flex gap-2 text-sm leading-snug text-ink">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                A validade deste orçamento já passou. Confirme preços e condições com o cliente antes de aprovar.
              </p>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink md:min-h-0">
                <input
                  type="checkbox"
                  checked={aceitarVencido}
                  onChange={(e) => {
                    setAceitarVencido(e.target.checked)
                    setErrors((prev) => {
                      const next = { ...prev }
                      delete next.aceitarVencido
                      return next
                    })
                  }}
                  aria-invalid={errors.aceitarVencido ? true : undefined}
                  aria-describedby={errors.aceitarVencido ? "aprovar-vencido-erro" : undefined}
                  className="size-5 shrink-0 cursor-pointer accent-ink"
                />
                Aprovar mesmo vencido
              </label>
              {errors.aceitarVencido ? (
                <p id="aprovar-vencido-erro" role="alert" className="text-[0.8125rem] text-danger">
                  {errors.aceitarVencido}
                </p>
              ) : null}
            </div>
          ) : null}
          <Field id="aprovar-vencimento" label="Vencimento da cobrança" error={errors.vencimento}>
            <DateField
              id="aprovar-vencimento"
              value={vencimento}
              min={todayBRT()}
              onChange={setVencimento}
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
            <Button type="submit" disabled={pending || conflito !== null} aria-busy={pending}>
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
