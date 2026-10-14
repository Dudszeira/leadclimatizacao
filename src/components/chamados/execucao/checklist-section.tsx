"use client"

import * as React from "react"
import { cn } from "cn"
import { CheckIcon, XIcon } from "lucide-react"

import type { ChecklistItem, ChecklistRespostas } from "@/lib/types"
import { saveChecklist } from "@/server/actions/service-orders"
import {
  isChecklistItemAnswered,
  isChecklistItemRequired,
  pendingRequiredItems,
} from "@/components/chamados/execution-rules"
import {
  SaveIndicator,
  draftStorageKey,
  readStoredDraft,
  useAutosave,
  useSectionSync,
  type SectionSync,
} from "@/components/chamados/execucao/autosave"
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
  sync?: SectionSync
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

/** Serialização estável (NaN vira marcador para não se confundir com vazio). */
function answersKey(itens: ChecklistItem[], r: ChecklistRespostas): string {
  return JSON.stringify(
    itens.map((i) => {
      const v = r[i.id] ?? null
      return typeof v === "number" && Number.isNaN(v) ? "NaN" : v
    }),
  )
}

/** Checklist do template: conforme/não conforme, medições e texto livre. */
export function ChecklistSection({
  osId,
  nome,
  itens,
  saved,
  editable,
  onSaved,
  sync,
}: ChecklistSectionProps) {
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(itens, saved))
  const [invalid, setInvalid] = React.useState<Set<string>>(new Set())
  const storageKey = draftStorageKey(osId, "checklist")

  // Rascunho guardado neste aparelho (aba recarregada, sem rede): volta para a tela
  // e o autosave tenta gravar de novo.
  React.useEffect(() => {
    if (!editable) return
    const stored = readStoredDraft<Draft>(storageKey)
    if (!stored || typeof stored !== "object") return
    const restored: Draft = {}
    for (const item of itens) {
      const v = stored[item.id]
      if (item.tipo === "checkbox") restored[item.id] = typeof v === "boolean" ? v : null
      else restored[item.id] = typeof v === "string" ? v : ""
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage só existe após montar
    setDraft(restored)
    // só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const current = fromDraft(itens, draft)
  const respondidos = itens.filter((i) => isChecklistItemAnswered(i, saved[i.id])).length
  const faltando = pendingRequiredItems(itens, saved).length

  function findInvalid(): Set<string> {
    return new Set(
      itens
        .filter((i) => i.tipo === "numero")
        .filter((i) => {
          const v = current[i.id]
          return typeof v === "number" && !Number.isFinite(v)
        })
        .map((i) => i.id),
    )
  }

  const autosave = useAutosave({
    enabled: editable,
    storageKey,
    valueKey: answersKey(itens, current),
    savedKey: answersKey(itens, saved),
    persist: () => draft,
    validate: () => {
      const bad = findInvalid()
      if (bad.size === 0) return null
      setInvalid(bad)
      return "Há medição com valor inválido. Use apenas números."
    },
    save: async () => {
      const value = current
      const result = await saveChecklist(osId, value)
      if (result.status === "success") {
        onSaved(value)
        return { ok: true }
      }
      return { ok: false, message: result.message }
    },
  })
  useSectionSync("checklist", autosave.dirty, autosave.flush, sync ?? {})

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

  return (
    <Card size="sm" className="border border-line bg-console ring-0">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-ink">
          <span className="min-w-0 truncate">Checklist · {nome}</span>
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
                      disabled={!editable}
                      onClick={() => set(item.id, true)}
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
                      disabled={!editable}
                      onClick={() => set(item.id, false)}
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
                    disabled={!editable}
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
                    disabled={!editable}
                    placeholder={editable ? "Descreva…" : "Sem resposta"}
                  />
                )}
              </li>
            )
          })}
        </ul>

        {editable && (
          <div className="flex flex-col gap-1 border-t border-line-soft pt-2 sm:flex-row sm:items-center sm:justify-between">
            <SaveIndicator
              status={autosave.status}
              error={autosave.error}
              onRetry={() => void autosave.flush()}
            />
            <p className="text-xs text-ink-dim">
              {faltando > 0
                ? `${faltando} ${faltando === 1 ? "item obrigatório pendente" : "itens obrigatórios pendentes"}.`
                : "Checklist completo."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
