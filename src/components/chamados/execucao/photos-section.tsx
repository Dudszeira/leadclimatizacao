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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type PhotosSectionProps = {
  osId: string
  demo: boolean
  editable: boolean
  photos: ServiceOrderPhotoView[]
  onAdded: (photo: ServiceOrderPhotoView) => void
  sync?: SectionSync
}

const ETAPAS: Array<{ etapa: FotoEtapa; titulo: string; dica: string }> = [
  { etapa: "antes", titulo: "Antes", dica: "Estado encontrado ao chegar" },
  { etapa: "depois", titulo: "Depois", dica: "Obrigatória para concluir (mín. 1)" },
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
export function PhotosSection({ osId, demo, editable, photos, onAdded, sync }: PhotosSectionProps) {
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

  return (
    <Card size="sm" className="border border-line bg-console ring-0">
      <CardHeader>
        <CardTitle className="text-ink">Fotos do serviço</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {ETAPAS.map(({ etapa, titulo, dica }) => {
          const items = photos.filter((p) => p.etapa === etapa)
          const pendentes = queue.filter((q) => q.etapa === etapa)
          const inputId = `foto-${etapa}`
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
                <div className="mt-2 flex flex-col gap-2">
                  <label htmlFor={`${inputId}-legenda`} className="sr-only">
                    Legenda das próximas fotos {titulo.toLowerCase()} (opcional)
                  </label>
                  <Input
                    id={`${inputId}-legenda`}
                    value={legendas[etapa]}
                    maxLength={LEGENDA_MAX}
                    placeholder="Legenda (opcional), ex.: dreno obstruído"
                    onChange={(e) => {
                      const value = e.currentTarget.value
                      setLegendas((prev) => ({ ...prev, [etapa]: value }))
                    }}
                    className="h-9 max-md:h-11"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <PickButton
                      id={`${inputId}-camera`}
                      icon={<CameraIcon className="size-5" aria-hidden="true" />}
                      label={`Tirar foto ${titulo.toLowerCase()}`}
                      capture
                      onFiles={(files) => handleFiles(etapa, files)}
                      primary
                    />
                    <PickButton
                      id={`${inputId}-galeria`}
                      icon={<ImagesIcon className="size-5" aria-hidden="true" />}
                      label="Escolher da galeria"
                      onFiles={(files) => handleFiles(etapa, files)}
                    />
                  </div>
                </div>
              )}

              {pendentes.length > 0 && (
                <ul className="mt-2 flex flex-col gap-2" aria-label={`Envio das fotos ${titulo.toLowerCase()}`}>
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
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
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
          <p className="text-xs text-ink-faint">
            JPEG, PNG ou WebP. As fotos são reduzidas no aparelho (até 1600 px) antes do envio.
            Fotos já enviadas não podem ser apagadas por aqui; peça ao escritório se precisar.
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
  capture,
  primary,
  onFiles,
}: {
  id: string
  icon: React.ReactNode
  label: string
  capture?: boolean
  primary?: boolean
  onFiles: (files: File[]) => Promise<void>
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors focus-within:ring-3 focus-within:ring-ring/50",
        primary
          ? "border-signal/40 bg-signal-dim/60 text-signal hover:bg-signal-dim"
          : "border-line bg-console-2 text-ink hover:bg-console-3",
      )}
    >
      {icon}
      <span>{label}</span>
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
        "flex items-center gap-3 rounded-lg border p-2",
        item.stage === "falhou"
          ? "border-danger/40 bg-danger-dim"
          : item.stage === "enviada"
            ? "border-clear/30 bg-clear-dim"
            : "border-line bg-console-2",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.preview}
        alt=""
        className="size-14 shrink-0 rounded-md border border-line object-cover"
      />
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="truncate text-xs text-ink-dim">{item.legenda || item.nome}</p>
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
          {busy && <span className="font-mono text-xs font-normal text-ink-dim tabular-nums">{step}/3</span>}
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
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-danger/40 px-3 text-sm font-medium text-ink hover:bg-console-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <RotateCwIcon className="size-4" aria-hidden="true" />
            Tentar de novo
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 text-xs text-ink-dim hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <XIcon className="size-3.5" aria-hidden="true" />
            Descartar
          </button>
        </div>
      )}
    </li>
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
