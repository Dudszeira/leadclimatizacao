"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  LoaderCircleIcon,
  PackagePlusIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import type { CatalogItem, QuoteClientOption, QuoteServiceType } from "@/lib/types"
import { formatBRL } from "@/lib/format"
import {
  MAX_QUOTE_ITEMS,
  parseNumeroBR,
  quoteFieldErrors,
  quoteSchema,
  quoteSubtotal,
  type QuoteActionResult,
  type QuoteFieldErrors,
  type QuoteInput,
} from "@/lib/quotes/schemas"
import { createQuote, updateQuote } from "@/server/actions/quotes"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Field, SelectField, invalidProps } from "@/components/clientes/form-kit"
import { numeroParaCampo } from "./form-utils"
import { DateField } from "./date-field"
import { Segmented } from "./segmented"

// ---------------------------------------------------------------------------
// Tipos e conversões
// ---------------------------------------------------------------------------

export type QuoteFormItem = {
  catalog_item_id: string | null
  descricao: string
  unidade: string
  /** Texto do campo (aceita "2,5"). */
  quantidade: string
  /** Texto do campo (aceita "1.234,56"). */
  preco_unitario: string
}

export type QuoteFormValues = {
  client_id: string
  building_id: string
  tipo_servico: QuoteServiceType
  titulo: string
  validade: string
  observacoes: string
  condicoes_pagamento: string
  prazo_execucao: string
  garantia: string
  desconto: string
  items: QuoteFormItem[]
}

type RowItem = QuoteFormItem & { key: string }

let seq = 0
const nextKey = () => `item-${++seq}`

function parseOuZero(v: string): number {
  const n = parseNumeroBR(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

const TIPO_OPTIONS: Array<{ value: QuoteServiceType; label: string }> = [
  { value: "instalacao", label: "Instalação" },
  { value: "corretiva", label: "Corretiva" },
]

// ---------------------------------------------------------------------------
// Formulário
// ---------------------------------------------------------------------------

type QuoteFormProps = {
  /** null = novo orçamento. */
  quoteId: string | null
  initial: QuoteFormValues
  clientOptions: QuoteClientOption[]
  catalog: CatalogItem[]
  /** Para onde "Cancelar" volta. */
  cancelHref: string
}

/**
 * Formulário de orçamento (novo e edição): cliente → prédio, tipo, título,
 * validade, itens (catálogo ou livres) com total ao vivo, condições e
 * observações. Valida com o mesmo schema do servidor antes de enviar.
 */
export function QuoteForm({ quoteId, initial, clientOptions, catalog, cancelHref }: QuoteFormProps) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [errors, setErrors] = React.useState<QuoteFieldErrors>({})
  const [typing, setTyping] = React.useState(false)

  const [clientId, setClientId] = React.useState(initial.client_id)
  const [buildingId, setBuildingId] = React.useState(initial.building_id)
  const [tipo, setTipo] = React.useState<QuoteServiceType>(initial.tipo_servico)
  const [titulo, setTitulo] = React.useState(initial.titulo)
  const [validade, setValidade] = React.useState(initial.validade)
  const [observacoes, setObservacoes] = React.useState(initial.observacoes)
  const [condicoes, setCondicoes] = React.useState(initial.condicoes_pagamento)
  const [prazo, setPrazo] = React.useState(initial.prazo_execucao)
  const [garantia, setGarantia] = React.useState(initial.garantia)
  const [desconto, setDesconto] = React.useState(initial.desconto)
  const [items, setItems] = React.useState<RowItem[]>(() =>
    initial.items.map((i) => ({ ...i, key: nextKey() })),
  )
  const focusKey = React.useRef<string | null>(null)

  // Clientes únicos a partir das linhas cliente × prédio.
  const clients = React.useMemo(() => {
    const map = new Map<string, { id: string; label: string; razao: string; predios: QuoteClientOption[] }>()
    for (const o of clientOptions) {
      let c = map.get(o.client_id)
      if (!c) {
        c = { id: o.client_id, label: o.nome_fantasia ?? o.razao_social, razao: o.razao_social, predios: [] }
        map.set(o.client_id, c)
      }
      c.predios.push(o)
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
  }, [clientOptions])

  const selectedClient = clients.find((c) => c.id === clientId) ?? null
  const predioItems = React.useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {
      "": selectedClient ? "Selecione a unidade" : "Escolha o cliente primeiro",
    }
    for (const p of selectedClient?.predios ?? []) {
      const local = [p.bairro, p.cidade].filter(Boolean).join(", ")
      out[p.building_id] = local ? `${p.building_nome} (${local})` : p.building_nome
    }
    return out
  }, [selectedClient])

  function chooseClient(id: string) {
    setClientId(id)
    const c = clients.find((x) => x.id === id)
    setBuildingId(c && c.predios.length === 1 ? c.predios[0].building_id : "")
    clearError("client_id", "building_id")
  }

  function clearError(...keys: string[]) {
    setErrors((prev) => {
      if (!keys.some((k) => prev[k])) return prev
      const next = { ...prev }
      for (const k of keys) delete next[k]
      return next
    })
  }

  // ---- itens ----
  function addItem(item: QuoteFormItem) {
    if (items.length >= MAX_QUOTE_ITEMS) {
      toast.error(`Máximo de ${MAX_QUOTE_ITEMS} itens por orçamento.`)
      return
    }
    const key = nextKey()
    focusKey.current = key
    setItems((prev) => [...prev, { ...item, key }])
    clearError("items")
  }

  function updateItem(key: string, patch: Partial<QuoteFormItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
    // os índices dos erros mudam: limpa os erros de itens
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("items."))))
  }

  function moveItem(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith("items."))))
  }

  React.useEffect(() => {
    if (!focusKey.current) return
    const el = document.getElementById(`${focusKey.current}-descricao`)
    focusKey.current = null
    el?.focus()
  }, [items.length])

  // ---- totais ao vivo ----
  const subtotal = quoteSubtotal(
    items.map((i) => ({ quantidade: parseOuZero(i.quantidade), preco_unitario: parseOuZero(i.preco_unitario) })),
  )
  const descontoNum = parseOuZero(desconto)
  const total = Math.max(0, Math.round((subtotal - descontoNum) * 100) / 100)

  // ---- envio ----
  function buildInput(): QuoteInput {
    return {
      client_id: clientId,
      building_id: buildingId,
      tipo_servico: tipo,
      titulo,
      validade,
      observacoes,
      condicoes_pagamento: condicoes,
      prazo_execucao: prazo,
      garantia,
      desconto: desconto.trim() === "" ? "0" : desconto,
      items: items.map((i) => ({
        catalog_item_id: i.catalog_item_id,
        descricao: i.descricao,
        unidade: i.unidade,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
      })),
    }
  }

  function focusFirstError(errs: QuoteFieldErrors) {
    const order = ["client_id", "building_id", "titulo", "validade", "items"]
    const first = order.find((k) => errs[k]) ?? Object.keys(errs).find((k) => k.startsWith("items.")) ?? Object.keys(errs)[0]
    if (!first) return
    let id = `orc-${first}`
    const m = first.match(/^items\.(\d+)\.(\w+)$/)
    if (m) id = `${items[Number(m[1])]?.key}-${m[2]}`
    if (first === "items") id = "orc-itens"
    requestAnimationFrame(() => document.getElementById(id)?.focus())
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    const input = buildInput()
    const parsed = quoteSchema.safeParse(input)
    if (!parsed.success) {
      const errs = quoteFieldErrors(parsed.error)
      setErrors(errs)
      toast.error("Revise os campos destacados antes de salvar.")
      focusFirstError(errs)
      return
    }
    startTransition(async () => {
      let result: QuoteActionResult
      try {
        result = quoteId ? await updateQuote(quoteId, input) : await createQuote(input)
      } catch {
        result = { ok: false, message: "Falha de conexão. Tente novamente." }
      }
      setErrors(result.fieldErrors ?? {})
      if (!result.ok) {
        toast.error(result.message)
        if (result.fieldErrors) focusFirstError(result.fieldErrors)
        return
      }
      if (result.demo) toast.info(result.message)
      else toast.success(result.message)
      router.push(result.id ? `/orcamentos/${result.id}` : "/orcamentos")
      router.refresh()
    })
  }

  const saveLabel = quoteId ? "Salvar alterações" : "Criar orçamento"
  const itemsError = errors.items

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      onFocusCapture={(e) => {
        const t = e.target as HTMLElement
        if (t.matches("input:not([type=date]), textarea")) setTyping(true)
      }}
      onBlurCapture={() => setTyping(false)}
      className="grid gap-4 max-md:pb-24 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
    >
      <div className="flex min-w-0 flex-col gap-4">
        {/* Cliente e serviço */}
        <Card>
          <CardHeader>
            <CardTitle>Cliente e serviço</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="orc-client_id" label="Cliente" error={errors.client_id}>
                <ClientCombobox
                  id="orc-client_id"
                  clients={clients}
                  value={clientId}
                  onChange={chooseClient}
                  invalid={Boolean(errors.client_id)}
                />
              </Field>
              <Field id="orc-building_id" label="Unidade ou prédio" error={errors.building_id}>
                <SelectField
                  id="orc-building_id"
                  value={buildingId}
                  onChange={(v) => {
                    setBuildingId(v)
                    clearError("building_id")
                  }}
                  items={predioItems}
                  ariaLabel="Unidade ou prédio"
                  error={errors.building_id}
                  disabled={!selectedClient}
                />
              </Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid min-w-0 gap-1.5">
                <span id="orc-tipo-label" className="text-sm font-medium text-ink-dim">
                  Tipo de serviço
                </span>
                <Segmented
                  labelledBy="orc-tipo-label"
                  value={tipo}
                  onChange={(v) => setTipo(v as QuoteServiceType)}
                  options={TIPO_OPTIONS}
                />
                <p className="text-[0.8125rem] leading-snug text-ink-faint">
                  Define o tipo da OS aberta quando o orçamento for aprovado.
                </p>
              </div>
              <Field id="orc-validade" label="Válido até" error={errors.validade}>
                <DateField
                  id="orc-validade"
                  value={validade}
                  onChange={(iso) => {
                    setValidade(iso)
                    clearError("validade")
                  }}
                  {...invalidProps("orc-validade", errors.validade)}
                />
              </Field>
            </div>
            <Field id="orc-titulo" label="Título" error={errors.titulo}>
              <Input
                id="orc-titulo"
                value={titulo}
                maxLength={200}
                placeholder="Ex.: Instalação de 3 splits no 2º andar"
                onChange={(e) => {
                  setTitulo(e.target.value)
                  clearError("titulo")
                }}
                {...invalidProps("orc-titulo", errors.titulo)}
              />
            </Field>
          </CardContent>
        </Card>

        {/* Itens */}
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle id="orc-itens-titulo">
              Itens <span className="text-ink-faint tabular-nums">{items.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {items.length === 0 ? (
              <p
                id="orc-itens"
                tabIndex={-1}
                className={cn(
                  "rounded-2xl bg-console-2 px-4 py-8 text-center text-sm leading-relaxed text-ink-dim outline-none",
                  itemsError && "text-danger ring-1 ring-danger/40",
                )}
              >
                Nenhum item ainda. Adicione do catálogo ou crie um item livre.
              </p>
            ) : (
              <ol aria-labelledby="orc-itens-titulo" className="flex flex-col divide-y divide-line-soft">
                {items.map((item, index) => (
                  <ItemRow
                    key={item.key}
                    item={item}
                    index={index}
                    count={items.length}
                    errors={errors}
                    onChange={(patch) => {
                      updateItem(item.key, patch)
                      clearError(...Object.keys(patch).map((k) => `items.${index}.${k}`))
                    }}
                    onRemove={() => removeItem(index)}
                    onMove={(dir) => moveItem(index, dir)}
                  />
                ))}
              </ol>
            )}
            {itemsError && items.length > 0 ? (
              <p role="alert" className="text-[0.8125rem] text-danger">{itemsError}</p>
            ) : itemsError ? (
              <p role="alert" className="sr-only">{itemsError}</p>
            ) : null}
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <CatalogCombobox catalog={catalog} onPick={addItem} />
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  addItem({ catalog_item_id: null, descricao: "", unidade: "un", quantidade: "1", preco_unitario: "" })
                }
              >
                <PlusIcon aria-hidden="true" />
                Item livre
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Condições */}
        <Card>
          <CardHeader>
            <CardTitle>Condições</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field id="orc-condicoes_pagamento" label="Condições de pagamento" error={errors.condicoes_pagamento}>
              <Textarea
                id="orc-condicoes_pagamento"
                rows={2}
                maxLength={1000}
                value={condicoes}
                onChange={(e) => setCondicoes(e.target.value)}
                {...invalidProps("orc-condicoes_pagamento", errors.condicoes_pagamento)}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="orc-prazo_execucao" label="Prazo de execução" error={errors.prazo_execucao}>
                <Textarea
                  id="orc-prazo_execucao"
                  rows={2}
                  maxLength={500}
                  className="min-h-0"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                  {...invalidProps("orc-prazo_execucao", errors.prazo_execucao)}
                />
              </Field>
              <Field id="orc-garantia" label="Garantia" error={errors.garantia}>
                <Textarea
                  id="orc-garantia"
                  rows={2}
                  maxLength={500}
                  className="min-h-0"
                  value={garantia}
                  onChange={(e) => setGarantia(e.target.value)}
                  {...invalidProps("orc-garantia", errors.garantia)}
                />
              </Field>
            </div>
            <Field
              id="orc-observacoes"
              label="Observações"
              hint="Aparece no PDF enviado ao cliente."
              error={errors.observacoes}
            >
              <Textarea
                id="orc-observacoes"
                rows={3}
                maxLength={4000}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                {...invalidProps("orc-observacoes", errors.observacoes)}
              />
            </Field>
          </CardContent>
        </Card>
      </div>

      {/* Totais: coluna fixa no desktop, bloco no fim no celular */}
      <aside aria-label="Totais" className="lg:sticky lg:top-20">
        <Card>
          <CardHeader>
            <CardTitle>Totais</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-dim">Subtotal</dt>
                <dd className="text-ink tabular-nums">{formatBRL(subtotal)}</dd>
              </div>
            </dl>
            <Field id="orc-desconto" label="Desconto (R$)" error={errors.desconto}>
              <Input
                id="orc-desconto"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={desconto}
                onChange={(e) => {
                  setDesconto(e.target.value)
                  clearError("desconto")
                }}
                {...invalidProps("orc-desconto", errors.desconto)}
              />
            </Field>
            <div className="flex items-baseline justify-between gap-3 border-t border-line-soft pt-4">
              <span className="text-sm text-ink-dim">Total</span>
              <span
                className="font-display text-[1.75rem] leading-none font-medium tracking-[-0.03em] text-ink"
                aria-live="polite"
              >
                {formatBRL(total)}
              </span>
            </div>
            {errors._ ? (
              <p role="alert" className="text-[0.8125rem] text-danger">{errors._}</p>
            ) : null}
            <div className="flex flex-col gap-2 max-md:hidden">
              <SaveButton pending={pending} label={saveLabel} />
              <Link href={cancelHref} className={buttonVariants({ variant: "ghost" })}>
                Cancelar
              </Link>
            </div>
          </CardContent>
        </Card>
      </aside>

      {/* Celular: barra fixa acima do dock com total e salvar */}
      <div
        className={cn(
          "fixed inset-x-2 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+0.875rem)] z-30 flex h-14 items-center gap-3 rounded-[1.5rem] bg-console-2/95 pr-1.5 pl-4 shadow-[0_-8px_32px_rgba(0,0,0,0.55)] ring-1 ring-line backdrop-blur-xl min-[400px]:inset-x-3 md:hidden",
          typing && "hidden",
        )}
      >
        <p className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="text-[0.8125rem] text-ink-faint">Total</span>
          <span className="truncate font-display text-lg leading-tight font-medium text-ink tabular-nums">
            {formatBRL(total)}
          </span>
        </p>
        <SaveButton pending={pending} label={saveLabel} size="default" className="shrink-0" />
      </div>
    </form>
  )
}

function SaveButton({
  pending,
  label,
  className,
  size = "lg",
}: {
  pending: boolean
  label: string
  className?: string
  size?: "default" | "lg"
}) {
  return (
    <Button type="submit" size={size} disabled={pending} aria-busy={pending} className={className}>
      {pending ? (
        <>
          <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          Salvando…
        </>
      ) : (
        label
      )}
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Linha de item
// ---------------------------------------------------------------------------

function ItemRow({
  item,
  index,
  count,
  errors,
  onChange,
  onRemove,
  onMove,
}: {
  item: RowItem
  index: number
  count: number
  errors: QuoteFieldErrors
  onChange: (patch: Partial<QuoteFormItem>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const n = index + 1
  const err = (k: string) => errors[`items.${index}.${k}`]
  const id = (k: string) => `${item.key}-${k}`
  const valor = quoteSubtotal([
    { quantidade: parseOuZero(item.quantidade), preco_unitario: parseOuZero(item.preco_unitario) },
  ])

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2">
        <span className="mt-3 w-5 shrink-0 text-[0.8125rem] text-ink-faint tabular-nums" aria-hidden="true">
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <Field id={id("descricao")} label={`Descrição do item ${n}`} error={err("descricao")}>
            <Textarea
              id={id("descricao")}
              rows={1}
              maxLength={500}
              value={item.descricao}
              placeholder="O que será feito ou fornecido"
              className="min-h-11 md:min-h-10"
              onChange={(e) => onChange({ descricao: e.target.value })}
              {...invalidProps(id("descricao"), err("descricao"))}
            />
          </Field>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.3fr)] gap-2 pl-7 sm:grid-cols-[6rem_5rem_9rem_minmax(0,1fr)] sm:gap-3">
        <Field id={id("quantidade")} label="Qtd." error={err("quantidade")}>
          <Input
            id={id("quantidade")}
            inputMode="decimal"
            autoComplete="off"
            value={item.quantidade}
            onChange={(e) => onChange({ quantidade: e.target.value })}
            {...invalidProps(id("quantidade"), err("quantidade"))}
          />
        </Field>
        <Field id={id("unidade")} label="Unid." error={err("unidade")}>
          <Input
            id={id("unidade")}
            maxLength={20}
            autoComplete="off"
            value={item.unidade}
            onChange={(e) => onChange({ unidade: e.target.value })}
            {...invalidProps(id("unidade"), err("unidade"))}
          />
        </Field>
        <Field id={id("preco_unitario")} label="Preço unit. (R$)" error={err("preco_unitario")}>
          <Input
            id={id("preco_unitario")}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={item.preco_unitario}
            onChange={(e) => onChange({ preco_unitario: e.target.value })}
            {...invalidProps(id("preco_unitario"), err("preco_unitario"))}
          />
        </Field>
        <div className="col-span-3 flex items-center justify-between gap-2 sm:col-span-1 sm:justify-end sm:self-end">
          <p className="text-sm text-ink-dim sm:hidden">
            Valor <span className="font-medium text-ink tabular-nums">{formatBRL(valor)}</span>
          </p>
          <p className="hidden pb-2.5 text-sm font-medium text-ink tabular-nums sm:block" aria-label={`Valor do item ${n}`}>
            {formatBRL(valor)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 pl-7">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Subir item ${n}`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUpIcon aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Descer item ${n}`}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDownIcon aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remover item ${n}`}
          className="text-ink-dim hover:text-danger"
          onClick={onRemove}
        >
          <Trash2Icon aria-hidden="true" />
        </Button>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Comboboxes
// ---------------------------------------------------------------------------

const comboTrigger =
  "h-11 w-full justify-between rounded-xl border-line bg-console-2 pr-3 pl-3.5 text-base font-normal hover:border-[#333] hover:bg-console-2 md:h-10 md:text-sm"

function ClientCombobox({
  id,
  clients,
  value,
  onChange,
  invalid,
}: {
  id: string
  clients: Array<{ id: string; label: string; razao: string }>
  value: string
  onChange: (id: string) => void
  invalid?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selected = clients.find((c) => c.id === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${id}-erro` : undefined}
            className={comboTrigger}
          />
        }
      >
        <span className={cn("min-w-0 truncate", !selected && "text-ink-faint")}>
          {selected ? selected.label : "Buscar cliente"}
        </span>
        <ChevronsUpDownIcon className="text-ink-faint" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-[min(20rem,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder="Nome ou razão social" aria-label="Buscar cliente" />
          <CommandList>
            <CommandEmpty>Nenhum cliente ativo com esse nome.</CommandEmpty>
            <CommandGroup>
              {clients.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.label} ${c.id}`}
                  keywords={[c.razao]}
                  data-checked={c.id === value}
                  onSelect={() => {
                    onChange(c.id)
                    setOpen(false)
                  }}
                  className="min-h-11 md:min-h-9"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{c.label}</span>
                    {c.razao !== c.label && (
                      <span className="truncate text-xs text-ink-faint">{c.razao}</span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function CatalogCombobox({
  catalog,
  onPick,
}: {
  catalog: CatalogItem[]
  onPick: (item: QuoteFormItem) => void
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="outline" aria-expanded={open} />}>
        <PackagePlusIcon aria-hidden="true" />
        Do catálogo
      </PopoverTrigger>
      <PopoverContent className="w-[min(26rem,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar serviço ou produto" aria-label="Buscar no catálogo" />
          <CommandList>
            <CommandEmpty>
              {catalog.length === 0 ? "O catálogo está vazio. Use um item livre." : "Nada no catálogo com esse nome."}
            </CommandEmpty>
            <CommandGroup>
              {catalog.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.nome} ${c.id}`}
                  keywords={c.descricao ? [c.descricao] : undefined}
                  onSelect={() => {
                    onPick({
                      catalog_item_id: c.id,
                      descricao: c.descricao ? `${c.nome}: ${c.descricao}` : c.nome,
                      unidade: c.unidade,
                      quantidade: "1",
                      preco_unitario: numeroParaCampo(c.preco),
                    })
                    setOpen(false)
                  }}
                  className="min-h-11 md:min-h-9"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{c.nome}</span>
                    {c.descricao && <span className="truncate text-xs text-ink-faint">{c.descricao}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-ink-dim tabular-nums">
                    {formatBRL(c.preco)}/{c.unidade}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
