"use client"

import * as React from "react"
import { CameraIcon, ImageOffIcon, LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { STORAGE_BUCKETS, type ServiceOrderPhotoView } from "@/lib/types"
import { fileBasename } from "@/lib/format"
import { registerServiceOrderPhoto } from "@/server/actions/service-orders"
import {
  LEGENDA_MAX,
  buildPhotoPath,
  validatePhotoInput,
  validatePhotoUpload,
  type FotoEtapa,
} from "@/components/chamados/execution-rules"
import { compressPhoto, uploadToBucket } from "@/components/chamados/execucao/upload"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type PhotosSectionProps = {
  osId: string
  demo: boolean
  editable: boolean
  photos: ServiceOrderPhotoView[]
  onAdded: (photo: ServiceOrderPhotoView) => void
}

const ETAPAS: Array<{ etapa: FotoEtapa; titulo: string; dica: string }> = [
  { etapa: "antes", titulo: "Antes", dica: "Estado encontrado ao chegar" },
  { etapa: "depois", titulo: "Depois", dica: "Obrigatória para concluir (mín. 1)" },
]

/** Fotos antes/depois: compressão no aparelho + upload direto ao Storage. */
export function PhotosSection({ osId, demo, editable, photos, onAdded }: PhotosSectionProps) {
  const [busy, setBusy] = React.useState<{ etapa: FotoEtapa; label: string } | null>(null)
  // Legenda opcional aplicada às fotos do próximo envio da etapa (validada no servidor).
  const [legendas, setLegendas] = React.useState<Record<FotoEtapa, string>>({ antes: "", depois: "" })
  const objectUrls = React.useRef<string[]>([])

  React.useEffect(() => {
    const urls = objectUrls.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  async function handleFiles(etapa: FotoEtapa, files: FileList | null) {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    const legenda = legendas[etapa].trim().slice(0, LEGENDA_MAX)
    let enviados = 0
    for (const [i, file] of list.entries()) {
      const prefix = list.length > 1 ? `${i + 1}/${list.length} · ` : ""
      const inputError = validatePhotoInput(file)
      if (inputError) {
        toast.error(`${file.name}: ${inputError}`)
        continue
      }
      try {
        setBusy({ etapa, label: `${prefix}Comprimindo…` })
        const blob = await compressPhoto(file)
        const uploadError = validatePhotoUpload({ type: blob.type || "image/jpeg", size: blob.size })
        if (uploadError) throw new Error(uploadError)
        const path = buildPhotoPath(osId, etapa)

        setBusy({ etapa, label: `${prefix}Enviando…` })
        if (!demo) await uploadToBucket(STORAGE_BUCKETS.fotos, path, blob, "image/jpeg")

        const result = await registerServiceOrderPhoto({
          osId,
          path,
          etapa,
          legenda: legenda || undefined,
          mime: "image/jpeg",
          size: blob.size,
        })
        if (result.status !== "success") throw new Error(result.message)

        if (result.demo || demo) {
          const url = URL.createObjectURL(blob)
          objectUrls.current.push(url)
          onAdded({
            id: `demo:${path}`,
            storage_path: path,
            etapa,
            legenda: legenda || null,
            created_at: new Date().toISOString(),
            url,
          })
        } else if (result.photo) {
          onAdded(result.photo)
        }
        enviados++
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Falha ao enviar a foto.")
      }
    }
    setBusy(null)
    if (enviados > 0) {
      setLegendas((prev) => ({ ...prev, [etapa]: "" }))
      const msg = `${enviados} foto${enviados > 1 ? "s" : ""} "${etapa}" adicionada${enviados > 1 ? "s" : ""}`
      if (demo) toast.info(`${msg} (modo demo, não salvo)`)
      else toast.success(`${msg}.`)
    }
  }

  return (
    <Card size="sm" className="border border-line bg-console ring-0">
      <CardHeader>
        <CardTitle className="text-ink">Fotos do serviço</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {ETAPAS.map(({ etapa, titulo, dica }) => {
          const items = photos.filter((p) => p.etapa === etapa)
          const inputId = `foto-${etapa}`
          const isBusy = busy?.etapa === etapa
          return (
            <section key={etapa} aria-labelledby={`${inputId}-titulo`}>
              <div className="flex items-baseline justify-between gap-2">
                <h3
                  id={`${inputId}-titulo`}
                  className="text-xs font-medium tracking-wider text-ink-faint uppercase"
                >
                  {titulo}{" "}
                  <span className="font-mono tabular-nums">({items.length})</span>
                </h3>
                <span className="text-xs text-ink-faint">{dica}</span>
              </div>
              {editable && (
                <div className="mt-2">
                  <label htmlFor={`${inputId}-legenda`} className="sr-only">
                    Legenda das próximas fotos {titulo.toLowerCase()} (opcional)
                  </label>
                  <Input
                    id={`${inputId}-legenda`}
                    value={legendas[etapa]}
                    maxLength={LEGENDA_MAX}
                    disabled={busy !== null}
                    placeholder="Legenda (opcional), ex.: dreno obstruído"
                    onChange={(e) => {
                      const value = e.currentTarget.value
                      setLegendas((prev) => ({ ...prev, [etapa]: value }))
                    }}
                    className="h-9 max-md:h-11"
                  />
                </div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {items.map((photo) => (
                  <PhotoTile key={photo.id} photo={photo} />
                ))}
                {editable && (
                  <label
                    htmlFor={inputId}
                    aria-disabled={busy !== null}
                    className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-signal/40 bg-signal-dim/40 px-2 text-center text-sm font-medium text-signal transition-colors hover:bg-signal-dim focus-within:ring-3 focus-within:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-60"
                  >
                    {isBusy ? (
                      <LoaderCircleIcon className="size-6 animate-spin" aria-hidden="true" />
                    ) : (
                      <CameraIcon className="size-6" aria-hidden="true" />
                    )}
                    <span aria-live="polite">
                      {isBusy ? busy.label : `Adicionar foto ${titulo.toLowerCase()}`}
                    </span>
                    <input
                      id={inputId}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="sr-only"
                      disabled={busy !== null}
                      onChange={(e) => {
                        const files = e.currentTarget.files
                        void handleFiles(etapa, files).finally(() => {
                          e.target.value = ""
                        })
                      }}
                    />
                  </label>
                )}
                {!editable && items.length === 0 && (
                  <p className="col-span-full text-sm text-ink-faint">Nenhuma foto registrada.</p>
                )}
              </div>
            </section>
          )
        })}
        {editable && (
          <p className="text-xs text-ink-faint">
            JPEG, PNG ou WebP. As fotos são reduzidas no aparelho (até 1600 px) antes do envio.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function PhotoTile({ photo }: { photo: ServiceOrderPhotoView }) {
  if (!photo.url) {
    return (
      <figure className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-console-2/60 px-2 text-center">
        <ImageOffIcon className="size-5 text-ink-faint" aria-hidden="true" />
        <figcaption className="max-w-full truncate font-mono text-[11px] text-ink-faint">
          {fileBasename(photo.storage_path)}
        </figcaption>
      </figure>
    )
  }
  return (
    <a
      href={photo.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block aspect-square overflow-hidden rounded-lg border border-line bg-console-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      aria-label={`Abrir foto ${photo.etapa}${photo.legenda ? `: ${photo.legenda}` : ""}`}
    >
      {/* URL assinada de curta duração: next/image não se aplica */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.legenda ?? `Foto ${photo.etapa} do serviço`}
        loading="lazy"
        decoding="async"
        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
      />
      {photo.legenda && (
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-[11px] text-white">
          {photo.legenda}
        </span>
      )}
    </a>
  )
}
