"use client"

import * as React from "react"
import { cn } from "cn"
import { ChevronsUpDownIcon, LoaderCircleIcon } from "lucide-react"

import type { EquipmentOption } from "@/lib/types"
import { searchEquipmentOptions } from "@/server/actions/service-orders"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type EquipmentComboboxProps = {
  id?: string
  buildingId: string
  value: string
  onChange: (id: string, label: string) => void
  invalid?: boolean
  describedBy?: string
}

const NONE = "__none__"

/**
 * Combobox de equipamento com busca no servidor (código, ambiente, marca,
 * modelo) restrita ao prédio selecionado — sem teto silencioso de itens.
 */
export function EquipmentCombobox({
  id,
  buildingId,
  value,
  onChange,
  invalid,
  describedBy,
}: EquipmentComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [items, setItems] = React.useState<EquipmentOption[]>([])
  const [total, setTotal] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [selectedLabel, setSelectedLabel] = React.useState("")
  const requestId = React.useRef(0)

  React.useEffect(() => {
    if (!open || !buildingId) return
    const current = ++requestId.current
    const handle = window.setTimeout(async () => {
      setLoading(true)
      const result = await searchEquipmentOptions(buildingId, query)
      if (current !== requestId.current) return
      setItems(result.items)
      setTotal(result.total)
      setError(result.error)
      setLoading(false)
    }, query ? 250 : 0)
    return () => window.clearTimeout(handle)
  }, [open, buildingId, query])

  const disabled = !buildingId
  const label = value ? selectedLabel || "Equipamento selecionado" : ""

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            disabled={disabled}
            className="h-8 w-full justify-between font-normal max-md:h-11"
          />
        }
      >
        <span className={cn("truncate", !label && "text-muted-foreground")}>
          {label || (buildingId ? "Sem equipamento específico" : "Escolha o prédio primeiro")}
        </span>
        <ChevronsUpDownIcon className="text-ink-faint" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar código, ambiente, marca…"
            value={query}
            onValueChange={setQuery}
            aria-label="Buscar equipamento"
          />
          <CommandList>
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-dim">
                <LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
                Buscando…
              </div>
            ) : (
              <CommandEmpty>{error ?? "Nenhum equipamento encontrado neste prédio."}</CommandEmpty>
            )}
            <CommandGroup>
              <CommandItem
                value={NONE}
                data-checked={!value}
                onSelect={() => {
                  onChange("", "")
                  setSelectedLabel("")
                  setOpen(false)
                }}
                className="min-h-11 md:min-h-8"
              >
                Sem equipamento específico
              </CommandItem>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  data-checked={value === item.id}
                  onSelect={() => {
                    onChange(item.id, item.label)
                    setSelectedLabel(item.label)
                    setOpen(false)
                  }}
                  className="min-h-11 md:min-h-8"
                >
                  <span className="truncate">{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {total > items.length && (
              <p className="border-t border-line-soft px-3 py-2 text-xs text-ink-faint">
                Mostrando {items.length} de {total} — refine a busca.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
