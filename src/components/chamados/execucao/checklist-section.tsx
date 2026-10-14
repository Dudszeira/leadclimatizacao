"use client"

import * as React from "react"
import { cn } from "cn"
import { CheckIcon, LoaderCircleIcon, SaveIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import type { ChecklistItem, ChecklistRespostas } from "@/lib/types"
import { saveChecklist } from "@/server/actions/service-orders"
import {
  isChecklistItemAnswered,
  isChecklistItemRequired,
  pendingRequiredItems,
} from "@/components/chamados/execution-rules"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type ChecklistSectionProps = {
  osId: string
  nome: string
  itens: ChecklistItem[]
  /** Respostas já gravadas (base da regra de conclusão). */
  saved: ChecklistRespostas
  editable: boolean
  onSaved: (respostas: ChecklistRespostas) => void
}

type Draft = Record<string, string | boolean | null>

function toDraft(itens: ChecklistItem[], r: ChecklistRespostas): Draft {
  const d: Draft = {}
  for (const item of itens) {
    const v = r[item.id]
    if (item.tipo === "checkbox") d[item.id] = typeof v === "boolean" ? v : null
    else d[item.id] = v === null || v === undefined ? "" : String(v)
  }
  return d
}

function fromDraft(itens: ChecklistItem[], d: Draft): ChecklistRespostas {
  const r: ChecklistRespostas = {}
  for (const item of itens) {
    const v = d[item.id]
    if (item.tipo === "checkbox") r[item.id] = typeof v === "boolean" ? v : null
    else if (item.tipo === "numero") {
      const s = typeof v === "string" ? v.trim().replace(",", ".") : ""
      r[item.id] = s === "" ? null : Number(s)
    } else {
      const s = typeof v === "string" ? v.trim() : ""
      r[item.id] = s === "" ? null : s
    }
  }
  return r
}

function sameAnswers(a: ChecklistRespostas, b: ChecklistRespostas): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    const x = a[k] ?? null
    const y = b[k] ?? null
    if (typeof x === "number" && typeof y === "number" && Number.isNaN(x) && Number.isNaN(y)) continue
    if (x !== y) return false
  }
  return true
}

/** Checklist do template: conforme/não conforme, medições e texto livre. */
export function ChecklistSection({
  osId,
  nome,
  itens,
  saved,
  editable,
  onSaved,
}: ChecklistSectionProps) {
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(itens, saved))
  const [pending, startTransition] = React.useTransition()
  const [invalid, setInvalid] = React.useState<Set<string>>(new Set())

  const current = fromDraft(itens, draft)
  const dirty = !sameAnswers(current, saved)
  const respondidos = itens.filter((i) => isChecklistItemAnswered(i, saved[i.id])).length
  const faltando = pendingRequiredItems(itens, saved).length

  function set(id: string, value: string | boolean | null) {
    setDraft((d) => ({ ...d, [id]: value }))
    if (invalid.has(id)) {
      setInvalid((s) => {
        const n = new Set(s)
        n.delete(id)
        return n
      })
    }
  }

  function handleSave() {
    const bad = new Set(
      itens
        .filter((i) => i.tipo === "numero")
        .filter((i) => {
          const v = current[i.id]
          return typeof v === "number" && !Number.isFinite(v)
        })
        .map((i) => i.id),
    )
    if (bad.size > 0) {
      setInvalid(bad)
      toast.error("Há medições com valor inválido — use apenas números.")
      return
    }
    startTransition(async () => {
      const result = await saveChecklist(osId, current)
      if (result.status === "success") {
        onSaved(current)
        if (result.demo) toast.info(result.message)
        else toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <Card size="sm" className="border border-line bg-console ring-0">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-ink">
          <span className="min-w-0 truncate">Checklist — {nome}</span>
          <span className="shrink-0 font-mono text-xs font-normal text-ink-faint tabular-nums">
            {respondidos}/{itens.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <ul className="flex flex-col divide-y divide-line-soft">
          {itens.map((item) => {
            const required = isChecklistItemRequired(item)
            const value = draft[item.id]
            const fieldId = `chk-${item.id}`
            return (
              <li key={item.id} className="flex flex-col gap-2 py-3">
                <div className="flex items-start justify-between gap-3">
                  <label
                    htmlFor={item.tipo === "checkbox" ? undefined : fieldId}
                    id={`${fieldId}-label`}
                    className="text-sm text-ink"
                  >
                    {item.label}
                    {item.unidade ? (
                      <span className="text-ink-faint"> ({item.unidade})</span>
                    ) : null}
                  </label>
                  <span
                    className={cn(
                      "shrink-0 text-[11px] tracking-wider uppercase",
                      required ? "text-amber" : "text-ink-faint",
                    )}
                  >
                    {required ? "Obrigatório" : "Opcional"}
                  </span>
                </div>

                {item.tipo === "checkbox" && (
                  <div
                    role="group"
                    aria-labelledby={`${fieldId}-label`}
                    className="grid grid-cols-2 gap-2"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      aria-pressed={value === true}
                      disabled={!editable || pending}
                      onClick={() => set(item.id, value === true ? null : true)}
                      className={cn(
                        "h-11 justify-center",
                        value === true &&
                          "border-clear/40 bg-clear-dim text-clear hover:bg-clear-dim hover:text-clear",
                      )}
                    >
                      <CheckIcon aria-hidden="true" />
                      Conforme
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      aria-pressed={value === false}
                      disabled={!editable || pending}
                      onClick={() => set(item.id, value === false ? null : false)}
                      className={cn(
                        "h-11 justify-center",
                        value === false &&
                          "border-danger/40 bg-danger-dim text-danger hover:bg-danger-dim hover:text-danger",
                      )}
                    >
                      <XIcon aria-hidden="true" />
                      Não conforme
                    </Button>
                  </div>
                )}

                {item.tipo === "numero" && (
                  <Input
                    id={fieldId}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={item.unidade ? `Valor em ${item.unidade}` : "Valor medido"}
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => set(item.id, e.target.value)}
                    disabled={!editable || pending}
                    aria-invalid={invalid.has(item.id) || undefined}
                    className="h-11 font-mono tabular-nums md:h-9"
                  />
                )}

                {item.tipo === "texto" && (
                  <Textarea
                    id={fieldId}
                    rows={2}
                    maxLength={2000}
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => set(item.id, e.target.value)}
                    disabled={!editable || pending}
                    placeholder={editable ? "Descreva…" : "—"}
                  />
                )}
              </li>
            )
          })}
        </ul>

        {editable && (
          <div className="flex flex-col gap-2 border-t border-line-soft pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-dim" aria-live="polite">
              {dirty
                ? "Alterações não salvas."
                : faltando > 0
                  ? `${faltando} ${faltando === 1 ? "item obrigatório pendente" : "itens obrigatórios pendentes"}.`
                  : "Checklist completo."}
            </p>
            <Button
              type="button"
              onClick={handleSave}
              disabled={!dirty || pending}
              aria-busy={pending}
              className="h-11 md:h-9"
            >
              {pending ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              ) : (
                <SaveIcon aria-hidden="true" />
              )}
              Salvar checklist
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
