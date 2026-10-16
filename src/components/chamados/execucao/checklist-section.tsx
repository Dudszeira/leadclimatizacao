"use client"

import * as React from "react"
import { cn } from "cn"
import { CheckIcon, CircleCheckIcon, XIcon } from "lucide-react"

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
import { Card, CardContent } from "@/components/ui/card"
import { StepHeading } from "@/components/chamados/execucao/section-heading"
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
  /** Número da etapa no fluxo de execução. */
  step?: number
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
  step,
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

  const progresso = itens.length > 0 ? Math.round((respondidos / itens.length) * 100) : 0

  return (
    <Card>
      <StepHeading
        step={step}
        title="Checklist"
        done={faltando === 0}
        aside={
          <span className="shrink-0 text-[0.8125rem] text-ink-dim tabular-nums">
            {respondidos} de {itens.length}
          </span>
        }
      />
      <CardContent className="flex flex-col gap-1">
        <div className="flex flex-col gap-2 pb-2">
          <p className="truncate text-[0.8125rem] text-ink-faint">{nome}</p>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-console-2"
            role="progressbar"
            aria-label="Itens respondidos"
            aria-valuemin={0}
            aria-valuemax={itens.length}
            aria-valuenow={respondidos}
          >
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-300 ease-(--ease-out-expo) motion-reduce:transition-none"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>
        <ul className="flex flex-col divide-y divide-line-soft">
          {itens.map((item) => {
            const required = isChecklistItemRequired(item)
            const value = draft[item.id]
            const answered = isChecklistItemAnswered(item, current[item.id])
            const fieldId = `chk-${item.id}`
            return (
              <li key={item.id} className="flex flex-col gap-3 py-4">
                <div className="flex min-h-6 items-start justify-between gap-3">
                  <label
                    htmlFor={item.tipo === "checkbox" ? undefined : fieldId}
                    id={`${fieldId}-label`}
                    className="text-[0.9375rem] leading-snug text-ink"
                  >
                    {item.label}
                    {item.unidade ? (
                      <span className="text-ink-faint"> ({item.unidade})</span>
                    ) : null}
                  </label>
                  {answered ? (
                    <CircleCheckIcon
                      className="mt-0.5 size-4 shrink-0 text-clear"
                      aria-label="Respondido"
                    />
                  ) : (
                    <span
                      className={cn(
                        "shrink-0 text-xs",
                        required ? "text-amber" : "text-ink-faint",
                      )}
                    >
                      {required ? "Obrigatório" : "Opcional"}
                    </span>
                  )}
                </div>

                {item.tipo === "checkbox" && (
                  <div
                    role="group"
                    aria-labelledby={`${fieldId}-label`}
                    className="grid grid-cols-2 gap-2"
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      aria-pressed={value === true}
                      disabled={!editable}
                      onClick={() => set(item.id, true)}
                      className={cn(
                        "w-full px-3",
                        value === true &&
                          "bg-clear-dim text-clear hover:bg-clear-dim hover:text-clear disabled:opacity-100",
                      )}
                    >
                      <CheckIcon aria-hidden="true" />
                      Conforme
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      aria-pressed={value === false}
                      disabled={!editable}
                      onClick={() => set(item.id, false)}
                      className={cn(
                        "w-full px-3",
                        value === false &&
                          "bg-danger-dim text-danger hover:bg-danger-dim hover:text-danger disabled:opacity-100",
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
                    className="h-12 tabular-nums md:h-11"
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
            <p className="text-[0.8125rem] text-ink-dim">
              {faltando > 0
                ? `${faltando} ${faltando === 1 ? "item obrigatório pendente" : "itens obrigatórios pendentes"}`
                : "Checklist completo"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
