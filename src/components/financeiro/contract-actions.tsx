"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArchiveXIcon, EllipsisVerticalIcon, LoaderCircleIcon, PencilLineIcon } from "lucide-react"
import { toast } from "sonner"

import type { Contract } from "@/lib/types"
import { closeContract } from "@/server/actions/contracts"
import { Button } from "@/components/ui/button"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContractFormDialog,
  type ContractClientOption,
} from "@/components/financeiro/contract-form-dialog"

type ContractActionsProps = {
  contract: Pick<
    Contract,
    | "id"
    | "client_id"
    | "tipo"
    | "valor_mensal"
    | "dia_vencimento"
    | "inicio"
    | "fim"
    | "status"
    | "observacoes"
  >
  clienteNome: string
  clients: ContractClientOption[]
  hoje: string
}

/** Editar / encerrar um contrato (linha da tabela da aba Contratos). */
export function ContractActions({ contract, clienteNome, clients, hoje }: ContractActionsProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const encerrado = contract.status === "encerrado"
  // Cliente inativo não vem nas opções; garante o rótulo no select da edição.
  const options = clients.some((c) => c.id === contract.client_id)
    ? clients
    : [...clients, { id: contract.client_id, label: clienteNome }]

  function handleClose() {
    if (pending) return
    startTransition(async () => {
      const result = await closeContract(contract.id)
      if (result.status === "success") {
        toast.success(result.message)
        setOpen(false)
        router.refresh()
      } else if (result.status === "info") {
        toast.info(result.message)
        setOpen(false)
      } else {
        toast.error(result.message ?? "Não foi possível encerrar o contrato.")
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              disabled={pending}
              aria-label={`Ações do contrato de ${clienteNome}`}
              className="text-ink-dim hover:text-ink"
            />
          }
        >
          {pending ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          ) : (
            <EllipsisVerticalIcon aria-hidden="true" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-56 [&_[data-slot=dropdown-menu-item]]:min-h-11 md:[&_[data-slot=dropdown-menu-item]]:min-h-9"
        >
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <PencilLineIcon aria-hidden="true" />
            Editar contrato
          </DropdownMenuItem>
          {!encerrado ? (
            <DropdownMenuItem variant="destructive" onClick={() => setOpen(true)}>
              <ArchiveXIcon aria-hidden="true" />
              Encerrar contrato
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ContractFormDialog
        clients={options}
        contract={contract}
        hoje={hoje}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {!encerrado ? (
        <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Encerrar o contrato de {clienteNome}?</DialogTitle>
              <DialogDescription>
                O contrato deixa de gerar faturas a partir do próximo mês e a
                vigência termina hoje. Faturas já emitidas continuam no
                financeiro.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Manter contrato
              </Button>
              <Button
                variant="destructive"
                onClick={handleClose}
                disabled={pending}
                aria-busy={pending}
              >
                {pending ? (
                  <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                ) : (
                  <ArchiveXIcon aria-hidden="true" />
                )}
                Encerrar contrato
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
