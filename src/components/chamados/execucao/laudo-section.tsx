"use client"

import * as React from "react"
import { LoaderCircleIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

import { saveLaudo } from "@/server/actions/service-orders"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type LaudoSectionProps = {
  osId: string
  editable: boolean
  laudo: string
  observacoes: string
  onSaved: (v: { laudo: string; observacoes: string }) => void
}

const MAX = 4000

/** Laudo técnico (vai para o cliente) e observações técnicas internas. */
export function LaudoSection({ osId, editable, laudo, observacoes, onSaved }: LaudoSectionProps) {
  const [draftLaudo, setDraftLaudo] = React.useState(laudo)
  const [draftObs, setDraftObs] = React.useState(observacoes)
  const [pending, startTransition] = React.useTransition()
  const dirty = draftLaudo.trim() !== laudo.trim() || draftObs.trim() !== observacoes.trim()

  if (!editable && !laudo && !observacoes) {
    return (
      <Card size="sm" className="border border-line bg-console ring-0">
        <CardHeader>
          <CardTitle className="text-ink">Laudo técnico</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-faint">Laudo ainda não registrado pelo técnico.</p>
        </CardContent>
      </Card>
    )
  }

  function handleSave() {
    startTransition(async () => {
      const value = { laudo: draftLaudo.trim(), observacoes: draftObs.trim() }
      const result = await saveLaudo(osId, value)
      if (result.status === "success") {
        onSaved(value)
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
        <CardTitle className="text-ink">Laudo técnico</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {editable ? (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="os-laudo">Laudo (visível ao cliente)</Label>
              <Textarea
                id="os-laudo"
                rows={4}
                maxLength={MAX}
                value={draftLaudo}
                onChange={(e) => setDraftLaudo(e.target.value)}
                disabled={pending}
                placeholder="O que foi encontrado, o que foi feito e o estado final do equipamento."
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="os-obs-tecnicas">Observações técnicas (internas)</Label>
              <Textarea
                id="os-obs-tecnicas"
                rows={3}
                maxLength={MAX}
                value={draftObs}
                onChange={(e) => setDraftObs(e.target.value)}
                disabled={pending}
                placeholder="Peças a orçar, riscos, recomendações para a próxima visita…"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-dim" aria-live="polite">
                {dirty ? "Alterações não salvas." : "Salvo."}
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
                Salvar laudo
              </Button>
            </div>
          </>
        ) : (
          <>
            {laudo && <p className="text-sm leading-relaxed whitespace-pre-line text-ink-dim">{laudo}</p>}
            {observacoes && (
              <div>
                <p className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                  Observações técnicas
                </p>
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
