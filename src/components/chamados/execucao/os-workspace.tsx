"use client"

import * as React from "react"
import { cn } from "cn"
import {
  CheckCheckIcon,
  ChevronUpIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  FlaskConicalIcon,
  LoaderCircleIcon,
  MapPinIcon,
  NavigationIcon,
} from "lucide-react"
import { toast } from "sonner"

import type {
  ChecklistItem,
  ChecklistRespostas,
  OsStatus,
  ServiceOrderPhotoView,
  UserRole,
} from "@/lib/types"
import { formatDateTimeFullBR, formatOsNumero } from "@/lib/format"
import {
  concludeServiceOrder,
  startServiceOrder,
} from "@/server/actions/service-orders"
import { evaluateConclusion } from "@/components/chamados/execution-rules"
import type { FlushFn, SectionSync } from "@/components/chamados/execucao/autosave"
import { ChecklistSection } from "@/components/chamados/execucao/checklist-section"
import { LaudoSection } from "@/components/chamados/execucao/laudo-section"
import { PhotosSection } from "@/components/chamados/execucao/photos-section"
import {
  SignatureSection,
  type SignatureState,
} from "@/components/chamados/execucao/signature-section"
import { OrderActions, type TechnicianOption } from "@/components/chamados/order-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StepHeading } from "@/components/chamados/execucao/section-heading"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type OsWorkspaceData = {
  id: string
  numero: number
  status: OsStatus
  technicianId: string | null
  scheduledAt: string | null
  checkinAt: string | null
  checkinLat: number | null
  checkinLng: number | null
  template: { nome: string; itens: ChecklistItem[] } | null
  respostas: ChecklistRespostas
  laudo: string
  observacoes: string
  assinatura: SignatureState
  photos: ServiceOrderPhotoView[]
}

type OsWorkspaceProps = {
  os: OsWorkspaceData
  demo: boolean
  role: UserRole
  /** Técnico dono da OS ou escritório (admin/atendente). */
  canExecute: boolean
  technicians: TechnicianOption[]
  technicianError: string | null
  evidenceError: string | null
  /** Linha do tempo renderizada no servidor. */
  timeline: React.ReactNode
  /** Resumo (cliente, local, equipamento, técnico) renderizado no servidor. */
  summary: React.ReactNode
}

/** Campo de digitação focado (o teclado do celular está aberto). */
function isTypingTarget(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLElement && el.isContentEditable) return true
  if (el instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "file", "submit", "reset", "range", "color"].includes(el.type)
  }
  return false
}

function useTypingFocus(): boolean {
  const [typing, setTyping] = React.useState(false)
  React.useEffect(() => {
    const update = () => setTyping(isTypingTarget(document.activeElement))
    // focusout dispara antes de o próximo campo receber o foco
    const onFocusOut = () => window.setTimeout(update, 0)
    document.addEventListener("focusin", update)
    document.addEventListener("focusout", onFocusOut)
    return () => {
      document.removeEventListener("focusin", update)
      document.removeEventListener("focusout", onFocusOut)
    }
  }, [])
  return typing
}

type Coords = { lat: number | null; lng: number | null }

function getPosition(): Promise<Coords> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ lat: null, lng: null })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    )
  })
}

/**
 * Tela de execução da OS: check-in, checklist, fotos, laudo, assinatura e
 * conclusão. Estado local é a verdade após cada ação bem-sucedida (o
 * servidor revalida a rota); no modo demo nada é gravado.
 */
export function OsWorkspace({
  os,
  demo,
  role,
  canExecute,
  technicians,
  technicianError,
  evidenceError,
  timeline,
  summary,
}: OsWorkspaceProps) {
  const [status, setStatus] = React.useState<OsStatus>(os.status)
  const [syncedStatus, setSyncedStatus] = React.useState<OsStatus>(os.status)
  // Mudança vinda do servidor (revalidação) prevalece sobre o estado local.
  if (os.status !== syncedStatus) {
    setSyncedStatus(os.status)
    setStatus(os.status)
  }
  const [technicianId, setTechnicianId] = React.useState(os.technicianId)
  const [scheduledAt, setScheduledAt] = React.useState(os.scheduledAt)
  const [checkin, setCheckin] = React.useState({
    at: os.checkinAt,
    lat: os.checkinLat,
    lng: os.checkinLng,
  })
  const [respostas, setRespostas] = React.useState<ChecklistRespostas>(os.respostas)
  const [photos, setPhotos] = React.useState<ServiceOrderPhotoView[]>(os.photos)
  const [laudo, setLaudo] = React.useState({ laudo: os.laudo, observacoes: os.observacoes })
  const [assinatura, setAssinatura] = React.useState<SignatureState>(os.assinatura)
  const [pending, setPending] = React.useState<"checkin" | "concluir" | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [pendenciasOpen, setPendenciasOpen] = React.useState(false)
  const typing = useTypingFocus()

  // Seções com algo ainda não confirmado pelo servidor + "salvar agora" de cada uma.
  const [dirtyMap, setDirtyMap] = React.useState<Record<string, boolean>>({})
  const flushers = React.useRef(new Map<string, FlushFn>())
  const onDirtyChange = React.useCallback((key: string, dirty: boolean) => {
    setDirtyMap((m) => (m[key] === dirty ? m : { ...m, [key]: dirty }))
  }, [])
  const registerFlush = React.useCallback((key: string, flush: FlushFn | null) => {
    if (flush) flushers.current.set(key, flush)
    else flushers.current.delete(key)
  }, [])
  const sync = React.useMemo<SectionSync>(
    () => ({ onDirtyChange, registerFlush }),
    [onDirtyChange, registerFlush],
  )
  const anyDirty = Object.values(dirtyMap).some(Boolean)

  React.useEffect(() => {
    if (!anyDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [anyDirty])

  const office = role === "admin" || role === "atendente"
  const editable = canExecute && status === "em_campo"
  const encerrada = status === "concluido" || status === "cancelado"
  const fotosDepois = photos.filter((p) => p.etapa === "depois").length
  const readiness = evaluateConclusion({
    status,
    itens: os.template?.itens ?? null,
    respostas,
    fotosDepois,
    assinaturaPath: assinatura.path,
    assinadoPorNome: assinatura.nome,
  })

  async function handleCheckin() {
    setPending("checkin")
    try {
      const coords = await getPosition()
      const result = await startServiceOrder(os.id, coords)
      if (result.status === "success") {
        setStatus("em_campo")
        setCheckin({ at: new Date().toISOString(), lat: coords.lat, lng: coords.lng })
        if (result.demo) toast.info(result.message)
        else toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("Falha de conexão. Tente o check-in novamente.")
    } finally {
      setPending(null)
    }
  }

  async function handleConcluir() {
    if (!readiness.ready) {
      toast.error(readiness.pendencias[0])
      return
    }
    setConfirmOpen(false)
    setPending("concluir")
    try {
      // Salva o que estiver pendente (checklist, laudo) e só então conclui.
      const erros = await Promise.all([...flushers.current.values()].map((f) => f()))
      const erro = erros.find((e): e is string => e !== null)
      if (erro) {
        toast.error(`Não deu para concluir: ${erro}`)
        return
      }
      const result = await concludeServiceOrder(os.id)
      if (result.status === "success") {
        setStatus("concluido")
        if (result.demo) toast.info(result.message)
        else toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error("Falha de conexão. Tente concluir novamente.")
    } finally {
      setPending(null)
    }
  }

  const showExecution = status === "em_campo" || encerrada
  const canCheckin = canExecute && (status === "aberto" || status === "agendado")
  const showBar = editable || canCheckin
  const etapas = {
    checklist: os.template ? 1 : undefined,
    fotos: os.template ? 2 : 1,
    laudo: os.template ? 3 : 2,
    assinatura: os.template ? 4 : 3,
  }

  return (
    // Celular: uma coluna (resumo, execução, ações, ciclo). Desktop (lg):
    // execução à esquerda e resumo/ações/ciclo numa coluna lateral.
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-none lg:col-start-1 lg:row-start-1">
        {demo && (
          <p className="flex items-start gap-2.5 rounded-2xl bg-amber-dim px-4 py-3 text-sm text-amber">
            <FlaskConicalIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Modo demo: o fluxo funciona, mas nada é salvo. Fotos ficam só nesta aba.
          </p>
        )}

        {(status === "aberto" || status === "agendado") && (
          <Card>
            <StepHeading title="Execução em campo" />
            <CardContent className="flex flex-col gap-3">
              {canExecute ? (
                <>
                  <p className="text-[0.9375rem] leading-relaxed text-ink-dim">
                    Ao chegar no local, faça o check-in. Checklist, fotos, laudo e assinatura
                    são liberados em seguida.
                  </p>
                  <p className="text-[0.8125rem] text-ink-faint">
                    A localização do aparelho é pedida no check-in e é opcional.
                  </p>
                  {!technicianId && office && (
                    <p className="text-[0.8125rem] text-amber">
                      Designe o técnico antes: ele só enxerga as OS atribuídas a ele.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[0.9375rem] text-ink-dim">
                  Aguardando o técnico responsável fazer o check-in no local.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {evidenceError && (
          <p className="rounded-2xl bg-danger-dim px-4 py-3 text-sm text-danger">
            {evidenceError}
          </p>
        )}

        {showExecution && (
          <>
            {os.template && (
              <ChecklistSection
                osId={os.id}
                nome={os.template.nome}
                itens={os.template.itens}
                saved={respostas}
                editable={editable}
                onSaved={setRespostas}
                sync={sync}
                step={etapas.checklist}
              />
            )}
            <PhotosSection
              osId={os.id}
              demo={demo}
              editable={editable}
              photos={photos}
              onAdded={(p) => setPhotos((list) => [...list, p])}
              sync={sync}
              step={etapas.fotos}
            />
            <LaudoSection
              osId={os.id}
              editable={editable}
              laudo={laudo.laudo}
              observacoes={laudo.observacoes}
              onSaved={setLaudo}
              sync={sync}
              step={etapas.laudo}
            />
            <SignatureSection
              osId={os.id}
              demo={demo}
              editable={editable}
              value={assinatura}
              onSaved={setAssinatura}
              step={etapas.assinatura}
            />
          </>
        )}

        {showBar && (
          <div
            className={cn(
              // Celular: faixa única opaca que desce até o rodapé, por trás do dock
              // de abas (z-40), sem vão entre a barra e o dock. md+: laje que gruda
              // no rodapé da coluna.
              "fixed inset-x-0 bottom-0 z-30 border-t border-line-soft bg-void/95 px-3 pt-2 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+1.25rem)] backdrop-blur-xl md:sticky md:inset-x-auto md:bottom-4 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none",
              // teclado aberto no celular: a barra sai da frente do campo
              typing && "max-md:hidden",
            )}
          >
            <div className="md:rounded-[1.5rem] md:bg-console-2/92 md:p-2 md:shadow-[0_-8px_32px_rgba(0,0,0,0.55)] md:ring-1 md:ring-line md:backdrop-blur-xl">
              {canCheckin ? (
                <div className="flex items-center gap-3">
                  <p className="hidden min-w-0 flex-1 pl-3 text-sm text-ink-dim sm:block">
                    Chegou no local? Faça o check-in para liberar a execução.
                  </p>
                  <Button
                    type="button"
                    size="lg"
                    className="w-full sm:w-auto"
                    onClick={handleCheckin}
                    disabled={pending !== null}
                    aria-busy={pending === "checkin"}
                  >
                    {pending === "checkin" ? (
                      <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                    ) : (
                      <NavigationIcon aria-hidden="true" />
                    )}
                    {pending === "checkin" ? "Registrando check-in…" : "Fazer check-in e iniciar"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col">
                  {!readiness.ready && (
                    <ul
                      id="os-pendencias"
                      className={cn(
                        "max-h-[40dvh] flex-col gap-2 overflow-y-auto px-3 pt-2 pb-3 text-sm text-ink-dim md:hidden",
                        pendenciasOpen ? "flex" : "hidden",
                      )}
                    >
                      {readiness.pendencias.map((p) => (
                        <li key={p} className="flex items-start gap-2">
                          <CircleAlertIcon
                            className="mt-0.5 size-4 shrink-0 text-amber"
                            aria-hidden="true"
                          />
                          {p}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1" aria-live="polite">
                      {readiness.ready ? (
                        <p className="flex min-h-12 items-center gap-2 pl-3 text-sm font-medium text-clear">
                          <CircleCheckIcon className="size-4 shrink-0" aria-hidden="true" />
                          Tudo pronto
                        </p>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="flex min-h-12 w-full items-center gap-2 rounded-full pr-2 pl-3 text-left text-sm font-medium text-amber outline-none focus-visible:ring-3 focus-visible:ring-signal/50 md:hidden"
                            aria-expanded={pendenciasOpen}
                            aria-controls="os-pendencias"
                            onClick={() => setPendenciasOpen((v) => !v)}
                          >
                            <CircleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
                            <span className="truncate">
                              Faltam {readiness.pendencias.length}{" "}
                              {readiness.pendencias.length === 1 ? "item" : "itens"}
                            </span>
                            <ChevronUpIcon
                              className={cn(
                                "size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
                                pendenciasOpen && "rotate-180",
                              )}
                              aria-hidden="true"
                            />
                          </button>
                          <ul className="hidden flex-col gap-1 py-1 pl-3 text-sm text-ink-dim md:flex">
                            {readiness.pendencias.map((p) => (
                              <li key={p} className="flex items-start gap-2">
                                <CircleAlertIcon
                                  className="mt-0.5 size-4 shrink-0 text-amber"
                                  aria-hidden="true"
                                />
                                {p}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="lg"
                      className="shrink-0"
                      disabled={!readiness.ready || pending !== null}
                      aria-busy={pending === "concluir"}
                      onClick={() => setConfirmOpen(true)}
                    >
                      {pending === "concluir" ? (
                        <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                      ) : (
                        <CheckCheckIcon aria-hidden="true" />
                      )}
                      {pending === "concluir" ? "Concluindo…" : "Concluir OS"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Coluna lateral no desktop; no celular os filhos entram na ordem da página. */}
      <div className="contents lg:col-start-2 lg:row-start-1 lg:flex lg:min-w-0 lg:flex-col lg:gap-4">
        <div className="order-1 min-w-0 lg:order-none">{summary}</div>

        {(office || !encerrada) && (
          <Card className={cn("order-3 lg:order-none", !office && "max-lg:hidden")}>
            <StepHeading title={office ? "Ações do chamado" : "Próximo passo"} />
            <CardContent>
              {encerrada ? (
                <p className="text-sm leading-relaxed text-ink-dim">
                  {status === "concluido"
                    ? "Chamado concluído. Nenhuma ação pendente."
                    : "Chamado cancelado. Nenhuma ação disponível."}
                </p>
              ) : office ? (
                <OrderActions
                  osId={os.id}
                  status={status}
                  technicianId={technicianId}
                  technicians={technicians}
                  scheduledAt={scheduledAt}
                  onStatusChange={(next, patch) => {
                    setStatus(next)
                    if (patch?.technicianId) setTechnicianId(patch.technicianId)
                    if (patch?.scheduledAt) setScheduledAt(patch.scheduledAt)
                  }}
                />
              ) : (
                <p className="text-sm leading-relaxed text-ink-dim">
                  {status === "em_campo"
                    ? "Preencha checklist, fotos e assinatura. Depois conclua a OS."
                    : "Faça o check-in ao chegar no local."}
                </p>
              )}
              {technicianError && office && !encerrada && (
                <p className="mt-3 text-[0.8125rem] text-danger">{technicianError}</p>
              )}
            </CardContent>
          </Card>
        )}

        {checkin.at && (
          <Card className="order-3 lg:order-none">
            <StepHeading title="Check-in" />
            <CardContent className="flex flex-col gap-1.5 text-sm">
              <p className="text-ink tabular-nums">{formatDateTimeFullBR(checkin.at)}</p>
              <p className="flex items-center gap-1.5 text-[0.8125rem] text-ink-dim">
                <MapPinIcon className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" />
                {checkin.lat !== null && checkin.lng !== null ? (
                  <span className="tabular-nums">
                    {checkin.lat.toFixed(4)}, {checkin.lng.toFixed(4)}
                  </span>
                ) : (
                  <span className="text-ink-faint">Sem coordenadas registradas</span>
                )}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="order-4 min-w-0 lg:order-none">{timeline}</div>
      </div>

      {/* Espaço para a barra fixa não cobrir o fim da página no celular. */}
      {showBar && <div aria-hidden="true" className="order-last h-20 md:hidden" />}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Concluir a OS {formatOsNumero(os.numero)}?</DialogTitle>
            <DialogDescription>
              Depois de concluída, ninguém consegue mais alterar checklist, fotos ou
              assinatura. A próxima preventiva PMOC é reprogramada automaticamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)}>
              Voltar
            </Button>
            <Button type="button" onClick={handleConcluir} disabled={pending !== null}>
              <CheckCheckIcon aria-hidden="true" />
              Concluir OS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
