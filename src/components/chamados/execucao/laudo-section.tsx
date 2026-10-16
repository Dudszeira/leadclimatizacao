"use client"

import * as React from "react"

import { saveLaudo } from "@/server/actions/service-orders"
import {
  SaveIndicator,
  draftStorageKey,
  readStoredDraft,
  useAutosave,
  useSectionSync,
  type SectionSync,
} from "@/components/chamados/execucao/autosave"
import { Card, CardContent } from "@/components/ui/card"
import { StepHeading } from "@/components/chamados/execucao/section-heading"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type LaudoSectionProps = {
  osId: string
  editable: boolean
  laudo: string
  observacoes: string
  onSaved: (v: { laudo: string; observacoes: string }) => void
  sync?: SectionSync
  step?: number
}

const MAX = 4000

/** Laudo técnico (vai para o cliente) e observações técnicas internas. */
export function LaudoSection({
  osId,
  editable,
  laudo,
  observacoes,
  onSaved,
  sync,
  step,
}: LaudoSectionProps) {
  const [draftLaudo, setDraftLaudo] = React.useState(laudo)
  const [draftObs, setDraftObs] = React.useState(observacoes)
  const storageKey = draftStorageKey(osId, "laudo")

  // Rascunho guardado neste aparelho volta para a tela e é regravado pelo autosave.
  React.useEffect(() => {
    if (!editable) return
    const stored = readStoredDraft<{ laudo?: unknown; observacoes?: unknown }>(storageKey)
    if (!stored || typeof stored !== "object") return
    if (typeof stored.laudo === "string") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage só existe após montar
      setDraftLaudo(stored.laudo.slice(0, MAX))
    }
    if (typeof stored.observacoes === "string") setDraftObs(stored.observacoes.slice(0, MAX))
    // só na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = { laudo: draftLaudo.trim(), observacoes: draftObs.trim() }
  const autosave = useAutosave({
    enabled: editable,
    storageKey,
    valueKey: JSON.stringify([value.laudo, value.observacoes]),
    savedKey: JSON.stringify([laudo.trim(), observacoes.trim()]),
    persist: () => ({ laudo: draftLaudo, observacoes: draftObs }),
    save: async () => {
      const v = value
      const result = await saveLaudo(osId, v)
      if (result.status === "success") {
        onSaved(v)
        return { ok: true }
      }
      return { ok: false, message: result.message }
    },
  })
  useSectionSync("laudo", autosave.dirty, autosave.flush, sync ?? {})

  if (!editable && !laudo && !observacoes) {
    return (
      <Card>
        <StepHeading step={step} title="Laudo técnico" done={false} />
        <CardContent>
          <p className="text-sm text-ink-faint">Laudo ainda não registrado pelo técnico.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <StepHeading
        step={step}
        title="Laudo técnico"
        done={laudo.trim().length > 0}
        aside={<span className="shrink-0 text-[0.8125rem] text-ink-faint">Opcional</span>}
      />
      <CardContent className="flex flex-col gap-5">
        {editable ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="os-laudo">Laudo para o cliente</Label>
              <Textarea
                id="os-laudo"
                rows={4}
                maxLength={MAX}
                value={draftLaudo}
                onChange={(e) => setDraftLaudo(e.target.value)}
                placeholder="O que foi encontrado, o que foi feito e o estado final do equipamento."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="os-obs-tecnicas">Observações internas</Label>
              <Textarea
                id="os-obs-tecnicas"
                rows={3}
                maxLength={MAX}
                value={draftObs}
                onChange={(e) => setDraftObs(e.target.value)}
                placeholder="Peças a orçar, riscos, recomendações para a próxima visita…"
              />
            </div>
            <SaveIndicator
              status={autosave.status}
              error={autosave.error}
              onRetry={() => void autosave.flush()}
            />
          </>
        ) : (
          <>
            {laudo && <p className="text-sm leading-relaxed whitespace-pre-line text-ink-dim">{laudo}</p>}
            {observacoes && (
              <div>
                <p className="text-[0.8125rem] text-ink-faint">Observações internas</p>
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-ink-dim">
                  {observacoes}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
