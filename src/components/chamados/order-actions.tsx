"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ptBR } from "date-fns/locale"
import {
  BanIcon,
  CalendarIcon,
  LoaderCircleIcon,
  UserRoundPlusIcon,
} from "lucide-react"
import { toast } from "sonner"

import type { OsStatus } from "@/lib/types"
import {
  assignTechnician,
  cancelServiceOrder,
  scheduleServiceOrder,
  type OsActionResult,
} from "@/server/actions/service-orders"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDateTimeFullBR } from "@/lib/format"

export type TechnicianOption = { id: string; label: string }

type OrderActionsProps = {
  osId: string
  status: OsStatus
  technicianId: string | null
  technicians: TechnicianOption[]
  scheduledAt: string | null
  /** Aplica a mudança no estado local da tela (modo demo e resposta imediata). */
  onStatusChange?: (status: OsStatus, patch?: { technicianId?: string; scheduledAt?: string }) => void
}

const HORARIOS = Array.from({ length: 12 }, (_, i) => {
  const h = String(7 + i).padStart(2, "0")
  return `${h}:00`
})

/**
 * Ações de escritório do ciclo da OS (admin/atendente), contextuais ao status:
 * aberto/agendado → designar, agendar/reagendar, cancelar · em campo →
 * cancelar. Check-in e conclusão ficam no painel de execução.
 */
export function OrderActions({
  osId,
  status,
  technicianId,
  technicians,
  scheduledAt,
  onStatusChange,
}: OrderActionsProps) {
  const router = useRouter()
  const [pendingAction, setPendingAction] = React.useState<string | null>(null)
  const [, startTransition] = React.useTransition()

  const [tecnico, setTecnico] = React.useState(technicianId ?? "")
  const [dataAgenda, setDataAgenda] = React.useState<Date | undefined>(
    scheduledAt ? new Date(scheduledAt) : undefined,
  )
  const [horaAgenda, setHoraAgenda] = React.useState("08:00")
  const [agendaOpen, setAgendaOpen] = React.useState(false)
  const [cancelOpen, setCancelOpen] = React.useState(false)

  const busy = pendingAction !== null

  function run(
    action: string,
    fn: () => Promise<OsActionResult>,
    onSuccess?: () => void,
  ) {
    setPendingAction(action)
    startTransition(async () => {
      try {
        const result = await fn()
        if (result.status === "success") {
          if (result.demo) toast.info(result.message)
          else toast.success(result.message)
          onSuccess?.()
          if (!result.demo) router.refresh()
        } else {
          toast.error(result.message)
        }
      } finally {
        setPendingAction(null)
      }
    })
  }

  if (status === "concluido" || status === "cancelado") return null

  const tecnicoItems: Record<string, string> = {
    "": "Selecione o técnico",
    ...Object.fromEntries(technicians.map((t) => [t.id, t.label])),
  }

  function handleAgendar() {
    if (!dataAgenda) {
      toast.error("Selecione a data da visita.")
      return
    }
    const [h, m] = horaAgenda.split(":").map(Number)
    const quando = new Date(dataAgenda)
    quando.setHours(h, m, 0, 0)
    setAgendaOpen(false)
    const iso = quando.toISOString()
    run("agendar", () => scheduleServiceOrder(osId, iso), () =>
      onStatusChange?.("agendado", { scheduledAt: iso }),
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {(status === "aberto" || status === "agendado") && (
        <div className="grid gap-1.5">
          <Label htmlFor="os-tecnico">
            {technicianId ? "Trocar técnico" : "Designar técnico"}
          </Label>
          <div className="flex gap-2">
            <Select
              items={tecnicoItems}
              value={tecnico}
              onValueChange={(value: string | null) => setTecnico(value ?? "")}
            >
              <SelectTrigger
                id="os-tecnico"
                aria-label="Técnico responsável"
                className="h-9 min-w-0 flex-1 max-md:h-11"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(tecnicoItems).map(([value, label]) => (
                  <SelectItem key={value} value={value} disabled={value === ""}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="h-9 max-md:h-11"
              disabled={busy || !tecnico || tecnico === technicianId}
              aria-busy={pendingAction === "designar"}
              onClick={() =>
                run("designar", () => assignTechnician(osId, tecnico), () =>
                  onStatusChange?.(status, { technicianId: tecnico }),
                )
              }
            >
              {pendingAction === "designar" ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              ) : (
                <UserRoundPlusIcon aria-hidden="true" />
              )}
              Designar
            </Button>
          </div>
        </div>
      )}

      {(status === "aberto" || status === "agendado") && (
        <div className="grid gap-1.5">
          <Label>{status === "agendado" ? "Reagendar visita" : "Agendar visita"}</Label>
          <Popover open={agendaOpen} onOpenChange={setAgendaOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  className="h-9 justify-start font-normal max-md:h-11"
                  disabled={busy}
                  aria-label="Escolher data e hora da visita"
                />
              }
            >
              <CalendarIcon className="text-ink-faint" aria-hidden="true" />
              {dataAgenda
                ? `${dataAgenda.toLocaleDateString("pt-BR")} às ${horaAgenda.replace(":", "h")}`
                : scheduledAt
                  ? formatDateTimeFullBR(scheduledAt)
                  : "Escolher data e hora"}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <Calendar
                mode="single"
                locale={ptBR}
                selected={dataAgenda}
                onSelect={setDataAgenda}
                disabled={{ before: new Date() }}
                autoFocus
              />
              <div className="mt-2 flex items-center gap-2 border-t border-line-soft pt-3">
                <Select
                  items={Object.fromEntries(HORARIOS.map((h) => [h, h]))}
                  value={horaAgenda}
                  onValueChange={(value: string | null) => {
                    if (value) setHoraAgenda(value)
                  }}
                >
                  <SelectTrigger
                    aria-label="Horário da visita"
                    className="h-9 flex-1 font-mono tabular-nums"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HORARIOS.map((h) => (
                      <SelectItem key={h} value={h} className="font-mono tabular-nums">
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="h-9"
                  disabled={!dataAgenda || busy}
                  aria-busy={pendingAction === "agendar"}
                  onClick={handleAgendar}
                >
                  {pendingAction === "agendar" && (
                    <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                  )}
                  Agendar
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogTrigger
          render={
            <Button
              variant="destructive"
              className="h-9 max-md:h-11"
              disabled={busy}
            />
          }
        >
          <BanIcon aria-hidden="true" />
          Cancelar chamado
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar este chamado?</DialogTitle>
            <DialogDescription>
              A ordem de serviço será marcada como cancelada e sai da fila de
              atendimento. Essa ação pode ser revertida pelo suporte.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={busy}
              className="max-md:h-11"
            >
              Manter chamado
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              aria-busy={pendingAction === "cancelar"}
              className="max-md:h-11"
              onClick={() => {
                setCancelOpen(false)
                run("cancelar", () => cancelServiceOrder(osId), () =>
                  onStatusChange?.("cancelado"),
                )
              }}
            >
              {pendingAction === "cancelar" ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              ) : (
                <BanIcon aria-hidden="true" />
              )}
              Cancelar chamado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
