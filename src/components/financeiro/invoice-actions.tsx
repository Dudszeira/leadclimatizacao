"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  BarcodeIcon,
  CheckCheckIcon,
  EllipsisVerticalIcon,
  FileTextIcon,
  Link2Icon,
  LoaderCircleIcon,
  QrCodeIcon,
} from "lucide-react"
import { toast } from "sonner"

import type { InvoiceStatus, PaymentMethod } from "@/lib/types"
import {
  generateCharge,
  issueNfse,
  markInvoicePaid,
  type InvoiceActionResult,
} from "@/server/actions/invoices"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type InvoiceActionsProps = {
  invoiceId: string
  status: InvoiceStatus
  clienteNome: string
  asaasId: string | null
  asaasUrl: string | null
  nfNumero: string | null
}

/**
 * Ações por linha da tabela de faturas: gerar cobrança (Pix/boleto) no Asaas,
 * marcar como pago manual, emitir NFS-e e copiar o link de pagamento.
 * Em modo demo as server actions devolvem a mensagem amigável (vira toast).
 */
export function InvoiceActions({
  invoiceId,
  status,
  clienteNome,
  asaasId,
  asaasUrl,
  nfNumero,
}: InvoiceActionsProps) {
  const router = useRouter()
  const [pendingAction, setPendingAction] = React.useState<string | null>(null)
  const [, startTransition] = React.useTransition()

  const busy = pendingAction !== null
  const emAberto = status === "pendente" || status === "atrasado"
  const podeGerarCobranca = emAberto && !asaasId
  const podeEmitirNf = status !== "cancelado" && !nfNumero

  function run(action: string, fn: () => Promise<InvoiceActionResult>) {
    setPendingAction(action)
    startTransition(async () => {
      try {
        const result = await fn()
        if (result.status === "success") {
          toast.success(result.message)
          router.refresh()
        } else {
          toast.error(result.message)
        }
      } finally {
        setPendingAction(null)
      }
    })
  }

  function handleGerarCobranca(metodo: PaymentMethod) {
    run(`cobranca-${metodo}`, () => generateCharge(invoiceId, metodo))
  }

  async function handleCopiarLink() {
    if (!asaasUrl) return
    try {
      await navigator.clipboard.writeText(asaasUrl)
      toast.success("Link de pagamento copiado.")
    } catch {
      toast.error("Não foi possível copiar o link — copie manualmente pelo Asaas.")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            aria-label={`Ações da fatura de ${clienteNome}`}
            className="relative z-10 size-8 text-ink-dim hover:text-ink max-md:size-10"
          />
        }
      >
        {busy ? (
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <EllipsisVerticalIcon className="size-4" aria-hidden="true" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuLabel>Cobrança</DropdownMenuLabel>
        <DropdownMenuItem
          disabled={busy || !podeGerarCobranca}
          onClick={() => handleGerarCobranca("pix")}
        >
          <QrCodeIcon aria-hidden="true" />
          Gerar cobrança Pix
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy || !podeGerarCobranca}
          onClick={() => handleGerarCobranca("boleto")}
        >
          <BarcodeIcon aria-hidden="true" />
          Gerar cobrança por boleto
        </DropdownMenuItem>
        {asaasUrl ? (
          <DropdownMenuItem disabled={busy} onClick={handleCopiarLink}>
            <Link2Icon aria-hidden="true" />
            Copiar link de pagamento
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={busy || !emAberto}
          onClick={() => run("pagar", () => markInvoicePaid(invoiceId))}
        >
          <CheckCheckIcon aria-hidden="true" />
          Marcar como pago (manual)
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy || !podeEmitirNf}
          onClick={() => run("nfse", () => issueNfse(invoiceId))}
        >
          <FileTextIcon aria-hidden="true" />
          Emitir NFS-e
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
