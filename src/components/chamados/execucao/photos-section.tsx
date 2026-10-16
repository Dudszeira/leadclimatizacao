"use client"

import * as React from "react"
import { cn } from "cn"
import {
  CameraIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ImageOffIcon,
  ImagesIcon,
  LoaderCircleIcon,
  RotateCwIcon,
  XIcon,
} from "lucide-react"
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
import { useSectionSync, type SectionSync } from "@/components/chamados/execucao/autosave"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StepHeading } from "@/components/chamados/execucao/section-heading"
import { Input } from "@/components/ui/input"

type PhotosSectionProps = {
  osId: string
  demo: boolean
  editable: boolean
  photos: ServiceOrderPhotoView[]
  onAdded: (photo: ServiceOrderPhotoView) => void
  sync?: SectionSync
  step?: number
}

const ETAPAS: Array<{ etapa: FotoEtapa; titulo: string; dica: string }> = [
  { etapa: "antes", titulo: "Antes", dica: "Estado encontrado ao chegar" },
  { etapa: "depois", titulo: "Depois", dica: "Pelo menos 1 para concluir" },
]

type Stage = "comprimindo" | "enviando" | "registrando" | "falhou" | "enviada"

/** Foto na fila de envio. O blob comprimido fica guardado para "Tentar de novo". */
type QueueItem = {
  id: string
  etapa: FotoEtapa
  nome: string
  file: File
  preview: string
  legenda: string
  stage: Stage
  error: string | null
  blob: Blob | null
  path: string | null
  /** Já está no Storage: tentar de novo só registra. */
  uploaded: boolean
}

const STAGE_LABEL: Record<Stage, string> = {
  comprimindo: "Comprimindo…",
  enviando: "Enviando…",
  registrando: "Registrando…",
  falhou: "Falhou",
  enviada: "Enviada",
}

/** Fotos antes/depois: compressão no aparelho + upload direto ao Storage, com fila visível. */
export function PhotosSection({ osId, demo, editable, photos, onAdded, sync, step }: PhotosSectionProps) {
  const [queue, setQueue] = React.useState<QueueItem[]>([])
  // Legenda opcional aplicada às fotos do próximo envio da etapa (validada no servidor).
  const [legendas, setLegendas] = React.useState<Record<FotoEtapa, string>>({ antes: "", depois: "" })
  const objectUrls = React.useRef<string[]>([])
  const seqRef = React.useRef(0)
  const queueRef = React.useRef<QueueItem[]>([])
  React.useEffect(() => {
    queueRef.current = queue
  }, [queue])

  React.useEffect(() => {
    const urls = objectUrls.current
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
      queueRef.current.forEach((q) => URL.revokeObjectURL(q.preview))
    }
  }, [])

  const sending = queue.some((q) => q.stage !== "falhou" && q.stage !== "enviada")
  const failed = queue.filter((q) => q.stage === "falhou").length

  const flush = React.useCallback(async (): Promise<string | null> => {
    const q = queueRef.current
    if (q.some((i) => i.stage !== "falhou" && i.stage !== "enviada")) {
      return "Aguarde o envio das fotos terminar."
    }
    return null
  }, [])
  useSectionSync("fotos", sending || failed > 0, flush, sync ?? {})

  function patch(id: string, p: Partial<QueueItem>) {
    setQueue((list) => list.map((q) => (q.id === id ? { ...q, ...p } : q)))
  }

  function dismiss(id: string) {
    setQueue((list) => {
      const item = list.find((q) => q.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return list.filter((q) => q.id !== id)
    })
  }

  async function processItem(item: QueueItem): Promise<boolean> {
    let { blob, path, uploaded } = item
    try {
      if (!blob) {
        patch(item.id, { stage: "comprimindo", error: null })
        blob = await compressPhoto(item.file)
        const uploadError = validatePhotoUpload({ type: blob.type || "image/jpeg", size: blob.size })
        if (uploadError) throw new Error(uploadError)
        path = buildPhotoPath(osId, item.etapa)
        patch(item.id, { blob, path })
      }
      if (!path) path = buildPhotoPath(osId, item.etapa)
      if (!uploaded) {
        patch(item.id, { stage: "enviando", error: null })
        if (!demo) await uploadToBucket(STORAGE_BUCKETS.fotos, path, blob, "image/jpeg")
        uploaded = true
        patch(item.id, { uploaded: true, path })
      }

      patch(item.id, { stage: "registrando", error: null })
      const result = await registerServiceOrderPhoto({
        osId,
        path,
        etapa: item.etapa,
        legenda: item.legenda || undefined,
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
          etapa: item.etapa,
          legenda: item.legenda || null,
          created_at: new Date().toISOString(),
          url,
        })
      } else if (result.photo) {
        onAdded(result.photo)
      }
      patch(item.id, { stage: "enviada", error: null })
      // A foto já aparece na grade: o bloco "Enviada" some depois de um instante.
      window.setTimeout(() => dismiss(item.id), 2500)
      return true
    } catch (err) {
      patch(item.id, {
        stage: "falhou",
        error: err instanceof Error ? err.message : "Falha ao enviar a foto.",
      })
      return false
    }
  }

  async function handleFiles(etapa: FotoEtapa, files: File[]) {
    if (files.length === 0) return
    const legenda = legendas[etapa].trim().slice(0, LEGENDA_MAX)
    const novos: QueueItem[] = []
    for (const file of files) {
      const inputError = validatePhotoInput(file)
      if (inputError) {
        toast.error(`${file.name}: ${inputError}`)
        continue
      }
      seqRef.current += 1
      novos.push({
        id: `q${seqRef.current}`,
        etapa,
        nome: file.name,
        file,
        preview: URL.createObjectURL(file),
        legenda,
        stage: "comprimindo",
        error: null,
        blob: null,
        path: null,
        uploaded: false,
      })
    }
    if (novos.length === 0) return
    setQueue((list) => [...list, ...novos])
    setLegendas((prev) => ({ ...prev, [etapa]: "" }))
    // Uma por vez: rede ruim em campo não aguenta envios em paralelo.
    let enviados = 0
    for (const item of novos) {
      if (await processItem(item)) enviados++
    }
    if (enviados > 0 && demo) {
      toast.info(`${enviados} foto${enviados > 1 ? "s" : ""} adicionada${enviados > 1 ? "s" : ""} (modo demo, não salvo).`)
    }
    if (enviados < novos.length) {
      toast.error("Alguma foto não foi enviada. Use \"Tentar de novo\" na foto marcada.")
    }
  }

  function retry(id: string) {
    const item = queueRef.current.find((q) => q.id === id)
    if (!item || item.stage !== "falhou") return
    void processItem(item)
  }

  const depois = photos.filter((p) => p.etapa === "depois").length

  return (
    <Card>
      <StepHeading
        step={step}
        title="Fotos do serviço"
        done={depois > 0}
        aside={
          <span className="shrink-0 text-[0.8125rem] text-ink-dim tabular-nums">
            {photos.length} {photos.length === 1 ? "foto" : "fotos"}
          </span>
        }
      />
      <CardContent className="flex flex-col divide-y divide-line-soft">
        {ETAPAS.map(({ etapa, titulo, dica }) => {
          const items = photos.filter((p) => p.etapa === etapa)
          const pendentes = queue.filter((q) => q.etapa === etapa)
          const inputId = `foto-${etapa}`
          return (
            <section
              key={etapa}
              aria-labelledby={`${inputId}-titulo`}
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3
                  id={`${inputId}-titulo`}
                  className="text-[0.9375rem] font-medium text-ink"
                >
                  {titulo}{" "}
                  <span className="font-normal text-ink-faint tabular-nums">{items.length}</span>
                </h3>
                <span className="min-w-0 text-right text-[0.8125rem] text-ink-faint">{dica}</span>
              </div>
              {editable && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <PickButton
                      id={`${inputId}-camera`}
                      icon={<CameraIcon className="size-5" aria-hidden="true" />}
                      label="Tirar foto"
                      srLabel={`Tirar foto ${titulo.toLowerCase()}`}
                      capture
                      onFiles={(files) => handleFiles(etapa, files)}
                    />
                    <PickButton
                      id={`${inputId}-galeria`}
                      icon={<ImagesIcon className="size-5" aria-hidden="true" />}
                      label="Galeria"
                      srLabel={`Escolher fotos ${titulo.toLowerCase()} da galeria`}
                      onFiles={(files) => handleFiles(etapa, files)}
                    />
                  </div>
                  <label htmlFor={`${inputId}-legenda`} className="sr-only">
                    Legenda das próximas fotos {titulo.toLowerCase()} (opcional)
                  </label>
                  <Input
                    id={`${inputId}-legenda`}
                    value={legendas[etapa]}
                    maxLength={LEGENDA_MAX}
                    placeholder="Legenda opcional, ex.: dreno obstruído"
                    onChange={(e) => {
                      const value = e.currentTarget.value
                      setLegendas((prev) => ({ ...prev, [etapa]: value }))
                    }}
                  />
                </>
              )}

              {pendentes.length > 0 && (
                <ul className="flex flex-col gap-2" aria-label={`Envio das fotos ${titulo.toLowerCase()}`}>
                  {pendentes.map((q) => (
                    <QueueRow
                      key={q.id}
                      item={q}
                      onRetry={() => retry(q.id)}
                      onDismiss={() => dismiss(q.id)}
                    />
                  ))}
                </ul>
              )}

              {(items.length > 0 || !editable) && (
                <div className="grid grid-cols-3 gap-2">
                  {items.map((photo) => (
                    <PhotoTile key={photo.id} photo={photo} />
                  ))}
                  {!editable && items.length === 0 && (
                    <p className="col-span-full text-sm text-ink-faint">Nenhuma foto registrada.</p>
                  )}
                </div>
              )}
            </section>
          )
        })}
        {editable && (
          <p className="pt-4 text-[0.8125rem] leading-relaxed text-ink-faint">
            As fotos são reduzidas no aparelho antes do envio. Para apagar uma foto já enviada,
            fale com o escritório.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function PickButton({
  id,
  icon,
  label,
  srLabel,
  capture,
  onFiles,
}: {
  id: string
  icon: React.ReactNode
  label: string
  srLabel: string
  capture?: boolean
  onFiles: (files: File[]) => Promise<void>
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl bg-console-2 px-3 py-2.5 text-center text-sm font-medium text-ink ring-1 ring-line transition-[background-color,transform] duration-150 select-none hover:bg-console-3 focus-within:ring-3 focus-within:ring-signal/60 active:scale-[0.98] motion-reduce:transition-none"
    >
      {icon}
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">{srLabel}</span>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        {...(capture ? { capture: "environment" as const } : { multiple: true })}
        className="sr-only"
        onChange={(e) => {
          const input = e.currentTarget
          // copia antes de limpar: o mesmo arquivo pode ser escolhido de novo depois
          const files = input.files ? Array.from(input.files) : []
          input.value = ""
          if (files.length > 0) void onFiles(files)
        }}
      />
    </label>
  )
}

function QueueRow({
  item,
  onRetry,
  onDismiss,
}: {
  item: QueueItem
  onRetry: () => void
  onDismiss: () => void
}) {
  const busy = item.stage === "comprimindo" || item.stage === "enviando" || item.stage === "registrando"
  const step = item.stage === "comprimindo" ? 1 : item.stage === "enviando" ? 2 : item.stage === "registrando" ? 3 : 0
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl p-2.5",
        item.stage === "falhou"
          ? "bg-danger-dim"
          : item.stage === "enviada"
            ? "bg-clear-dim"
            : "bg-console-2",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.preview}
        alt=""
        className="size-14 shrink-0 rounded-xl object-cover"
      />
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="truncate text-[0.8125rem] text-ink-dim">{item.legenda || item.nome}</p>
        <p
          className={cn(
            "mt-0.5 flex items-center gap-1.5 text-sm font-medium",
            item.stage === "falhou" ? "text-danger" : item.stage === "enviada" ? "text-clear" : "text-ink",
          )}
        >
          {busy ? (
            <LoaderCircleIcon className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : item.stage === "falhou" ? (
            <CircleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <CircleCheckIcon className="size-4 shrink-0" aria-hidden="true" />
          )}
          {STAGE_LABEL[item.stage]}
          {busy && <span className="text-xs font-normal text-ink-dim tabular-nums">{step} de 3</span>}
        </p>
        {busy && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-console-3" aria-hidden="true">
            <div
              className="h-full rounded-full bg-signal transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        )}
        {item.stage === "falhou" && item.error && (
          <p className="mt-0.5 text-xs text-danger">{item.error}</p>
        )}
      </div>
      {item.stage === "falhou" && (
        <div className="flex w-full gap-2 *:flex-1">
          <Button type="button" variant="secondary" onClick={onRetry}>
            <RotateCwIcon aria-hidden="true" />
            Tentar de novo
          </Button>
          <Button type="button" variant="ghost" onClick={onDismiss}>
            <XIcon aria-hidden="true" />
            Descartar
          </Button>
        </div>
      )}
    </li>
  )
}

function PhotoTile({ photo }: { photo: ServiceOrderPhotoView }) {
  if (!photo.url) {
    return (
      <figure className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl bg-console-2 px-2 text-center">
        <ImageOffIcon className="size-5 text-ink-faint" aria-hidden="true" />
        <figcaption className="max-w-full truncate text-xs text-ink-faint">
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
      className="group relative block aspect-square overflow-hidden rounded-2xl bg-console-2 focus-visible:ring-3 focus-visible:ring-signal/60 focus-visible:outline-none"
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
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/65 px-2 py-1 text-xs text-white">
          {photo.legenda}
        </span>
      )}
    </a>
  )
}
