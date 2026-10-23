"use client"

import * as React from "react"
import { EllipsisIcon, PencilIcon, PlusIcon, PowerIcon, PowerOffIcon } from "lucide-react"

import type { CatalogItem } from "@/lib/types"
import { catalogItemSchema, quoteFieldErrors } from "@/lib/quotes/schemas"
import { toggleCatalogItem, upsertCatalogItem } from "@/server/actions/quotes"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog, Field, SubmitButton, invalidProps, useCadastroAction } from "@/components/clientes/form-kit"
import { numeroParaCampo } from "./form-utils"

type EditableItem = Pick<CatalogItem, "id" | "nome" | "descricao" | "unidade" | "preco" | "ativo">

/** Botão "Novo item" do catálogo. */
export function NewCatalogItemButton() {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        Novo item
      </Button>
      <CatalogItemDialog open={open} onOpenChange={setOpen} item={null} />
    </>
  )
}

/** Menu da linha: editar e ativar/inativar. */
export function CatalogItemActions({ item }: { item: EditableItem }) {
  const [dialog, setDialog] = React.useState<"editar" | "status" | null>(null)
  const close = (open: boolean) => !open && setDialog(null)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label={`Ações de ${item.nome}`} />}
        >
          <EllipsisIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={() => setDialog("editar")}>
            <PencilIcon aria-hidden="true" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("status")}>
            {item.ativo ? <PowerOffIcon aria-hidden="true" /> : <PowerIcon aria-hidden="true" />}
            {item.ativo ? "Inativar" : "Reativar"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CatalogItemDialog open={dialog === "editar"} onOpenChange={close} item={item} />
      <ConfirmDialog
        open={dialog === "status"}
        onOpenChange={close}
        destructive={item.ativo}
        title={item.ativo ? `Inativar ${item.nome}?` : `Reativar ${item.nome}?`}
        description={
          item.ativo
            ? "O item some da busca ao montar orçamentos. Os orçamentos que já usam o item não mudam."
            : "O item volta a aparecer na busca ao montar orçamentos."
        }
        confirmLabel={item.ativo ? "Inativar item" : "Reativar item"}
        action={() => toggleCatalogItem(item.id, !item.ativo)}
      />
    </>
  )
}

function CatalogItemDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: EditableItem | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <CatalogItemForm item={item} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function CatalogItemForm({ item, onDone }: { item: EditableItem | null; onDone: () => void }) {
  const { pending, run, fieldErrors, setFieldErrors } = useCadastroAction()
  const [nome, setNome] = React.useState(item?.nome ?? "")
  const [descricao, setDescricao] = React.useState(item?.descricao ?? "")
  const [unidade, setUnidade] = React.useState(item?.unidade ?? "un")
  const [preco, setPreco] = React.useState(item ? numeroParaCampo(item.preco) : "")

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const input = { id: item?.id ?? null, nome, descricao, unidade, preco, ativo: item?.ativo ?? true }
    const parsed = catalogItemSchema.safeParse(input)
    if (!parsed.success) {
      setFieldErrors(quoteFieldErrors(parsed.error))
      return
    }
    run(() => upsertCatalogItem(input), onDone)
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{item ? "Editar item do catálogo" : "Novo item do catálogo"}</DialogTitle>
        <DialogDescription>
          Preço de referência. No orçamento dá para ajustar descrição, unidade e preço.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <Field id="cat-nome" label="Nome" error={fieldErrors.nome}>
          <Input
            id="cat-nome"
            value={nome}
            maxLength={200}
            onChange={(e) => setNome(e.target.value)}
            {...invalidProps("cat-nome", fieldErrors.nome)}
          />
        </Field>
        <Field id="cat-descricao" label="Descrição (opcional)" error={fieldErrors.descricao}>
          <Textarea
            id="cat-descricao"
            rows={2}
            maxLength={2000}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            {...invalidProps("cat-descricao", fieldErrors.descricao)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="cat-unidade" label="Unidade" hint="un, m, kg, mês" error={fieldErrors.unidade}>
            <Input
              id="cat-unidade"
              value={unidade}
              maxLength={20}
              onChange={(e) => setUnidade(e.target.value)}
              {...invalidProps("cat-unidade", fieldErrors.unidade)}
            />
          </Field>
          <Field id="cat-preco" label="Preço (R$)" error={fieldErrors.preco}>
            <Input
              id="cat-preco"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={preco}
              onChange={(e) => setPreco(e.target.value)}
              {...invalidProps("cat-preco", fieldErrors.preco)}
            />
          </Field>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <SubmitButton pending={pending}>{item ? "Salvar item" : "Adicionar item"}</SubmitButton>
      </DialogFooter>
    </form>
  )
}
