"use client"

import * as React from "react"
import { LoaderCircleIcon, PenLineIcon, RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"

import { STORAGE_BUCKETS } from "@/lib/types"
import { fileBasename, formatDateTimeFullBR } from "@/lib/format"
import { saveSignature } from "@/server/actions/service-orders"
import {
  SIGNATURE_TYPE,
  buildSignaturePath,
  validateSignatureUpload,
} from "@/components/chamados/execution-rules"
import { uploadToBucket } from "@/components/chamados/execucao/upload"
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/chamados/execucao/signature-pad"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type SignatureState = {
  path: string | null
  url: string | null
  nome: string | null
  em: string | null
}

type SignatureSectionProps = {
  osId: string
  demo: boolean
  editable: boolean
  value: SignatureState
  onSaved: (v: SignatureState) => void
}

/** Assinatura do responsável no local + nome de quem assinou. */
export function SignatureSection({ osId, demo, editable, value, onSaved }: SignatureSectionProps) {
  const padRef = React.useRef<SignaturePadHandle>(null)
  const objectUrl = React.useRef<string | null>(null)
  const [nome, setNome] = React.useState(value.nome ?? "")
  const [hasInk, setHasInk] = React.useState(false)
  const [redo, setRedo] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [nomeErro, setNomeErro] = React.useState<string | null>(null)

  React.useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    },
    [],
  )

  const signed = Boolean(value.path)
  const showPad = editable && (!signed || redo)

  async function handleSave() {
    const nomeLimpo = nome.trim()
    if (nomeLimpo.length < 3) {
      setNomeErro("Informe o nome de quem assinou.")
      return
    }
    if (!padRef.current || padRef.current.isEmpty()) {
      toast.error("Peça para o responsável assinar no quadro.")
      return
    }
    setPending(true)
    try {
      const blob = await padRef.current.toPngBlob()
      if (!blob) throw new Error("Não foi possível gerar a imagem da assinatura.")
      const fileError = validateSignatureUpload({ type: blob.type || SIGNATURE_TYPE, size: blob.size })
      if (fileError) throw new Error(fileError)
      const path = buildSignaturePath(osId)
      if (!demo) await uploadToBucket(STORAGE_BUCKETS.assinaturas, path, blob, SIGNATURE_TYPE)
      const result = await saveSignature({
        osId,
        path,
        nome: nomeLimpo,
        mime: SIGNATURE_TYPE,
        size: blob.size,
      })
      if (result.status !== "success") throw new Error(result.message)

      let url = result.url ?? null
      if (result.demo || demo) {
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
        objectUrl.current = URL.createObjectURL(blob)
        url = objectUrl.current
        toast.info(result.message)
      } else {
        toast.success(result.message)
      }
      onSaved({ path, url, nome: nomeLimpo, em: new Date().toISOString() })
      setRedo(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar a assinatura.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Card size="sm" className="border border-line bg-console ring-0">
      <CardHeader>
        <CardTitle className="text-ink">Assinatura do responsável</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {signed && !redo && (
          <div className="flex flex-col gap-3">
            {value.url ? (
              <div className="max-w-sm overflow-hidden rounded-lg border border-line bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value.url}
                  alt={`Assinatura de ${value.nome ?? "responsável"}`}
                  className="h-auto w-full"
                />
              </div>
            ) : (
              <div className="flex h-20 max-w-xs flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line bg-console-2/60 px-3 text-center">
                <PenLineIcon className="size-4 text-ink-faint" aria-hidden="true" />
                <span className="max-w-full truncate font-mono text-[11px] text-ink-faint">
                  {value.path ? fileBasename(value.path) : ""}
                </span>
              </div>
            )}
            <p className="text-sm text-ink-dim">
              {value.nome ? (
                <>
                  Assinado por <span className="text-ink">{value.nome}</span>
                </>
              ) : (
                "Assinatura registrada"
              )}
              {value.em ? (
                <span className="font-mono text-xs text-ink-faint tabular-nums">
                  {" "}
                  · {formatDateTimeFullBR(value.em)}
                </span>
              ) : null}
            </p>
            {editable && (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-fit md:h-8"
                onClick={() => setRedo(true)}
              >
                <RotateCcwIcon aria-hidden="true" />
                Refazer assinatura
              </Button>
            )}
          </div>
        )}

        {!signed && !editable && (
          <p className="text-sm text-ink-faint">Assinatura ainda não coletada.</p>
        )}

        {showPad && (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="os-assinante">Nome de quem assina</Label>
              <Input
                id="os-assinante"
                autoComplete="name"
                value={nome}
                maxLength={120}
                onChange={(e) => {
                  setNome(e.target.value)
                  if (nomeErro) setNomeErro(null)
                }}
                disabled={pending}
                aria-invalid={nomeErro ? true : undefined}
                aria-describedby={nomeErro ? "os-assinante-erro" : undefined}
                placeholder="Ex.: Mariana Souza, síndica"
                className="h-11 md:h-9"
              />
              {nomeErro && (
                <p id="os-assinante-erro" className="text-xs text-danger">
                  {nomeErro}
                </p>
              )}
            </div>
            <SignaturePad ref={padRef} disabled={pending} onInkChange={setHasInk} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {redo && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 md:h-9"
                  disabled={pending}
                  onClick={() => setRedo(false)}
                >
                  Manter assinatura atual
                </Button>
              )}
              <Button
                type="button"
                className="h-11 md:h-9"
                onClick={handleSave}
                disabled={pending || !hasInk || nome.trim().length < 3}
                aria-busy={pending}
              >
                {pending ? (
                  <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                ) : (
                  <PenLineIcon aria-hidden="true" />
                )}
                Salvar assinatura
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
