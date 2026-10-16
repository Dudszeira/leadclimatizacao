"use client"

import Link from "next/link"
import { cn } from "cn"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowUpRightIcon, InfoIcon } from "lucide-react"

import type { PmocPlanDetail } from "@/server/pmoc"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  EQUIPMENT_TYPE_LABELS,
  EVENTO_META,
  parseDia,
  type PmocEvento,
} from "./evento"

function formatData(iso: string | null | undefined): string {
  if (!iso) return "Sem registro"
  return format(parseDia(iso), "dd/MM/yyyy", { locale: ptBR })
}

function Linha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="shrink-0 text-sm text-ink-dim">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-ink">{children}</dd>
    </div>
  )
}

type PmocEventSheetProps = {
  evento: PmocEvento | null
  detalhe: PmocPlanDetail | undefined
  /** "bottom" no celular (folha que sobe), "right" no desktop. */
  side?: "right" | "bottom"
  onClose: () => void
}

/** Detalhes da manutenção tocada no calendário. */
export function PmocEventSheet({
  evento,
  detalhe,
  side = "right",
  onClose,
}: PmocEventSheetProps) {
  const meta = evento ? EVENTO_META[evento.situacao] : null

  return (
    <Sheet open={evento !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side={side} className="gap-0">
        {side === "bottom" && (
          <span
            aria-hidden="true"
            className="absolute top-2.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-line"
          />
        )}
        {evento && meta && (
          <>
            <SheetHeader className={cn("gap-2", side === "bottom" && "pt-7")}>
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-xl">{evento.codigo_interno}</SheetTitle>
                <Badge className={meta.badge}>{meta.label}</Badge>
              </div>
              <SheetDescription className="first-letter:uppercase">
                {format(parseDia(evento.data), "EEEE, d 'de' MMMM 'de' yyyy", {
                  locale: ptBR,
                })}
                {evento.projetada ? ", visita projetada pela periodicidade" : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
              <dl aria-label="Detalhes da manutenção" className="divide-y divide-line-soft">
                <Linha label="Equipamento">
                  <span className="block font-medium">{evento.codigo_interno}</span>
                  <span className="block text-[0.8125rem] text-ink-dim">
                    {EQUIPMENT_TYPE_LABELS[evento.equipamento_tipo]}
                    {detalhe?.marca ? `, ${detalhe.marca}` : ""}
                    {detalhe?.modelo ? ` ${detalhe.modelo}` : ""}
                  </span>
                </Linha>
                <Linha label="Prédio">
                  <span className="block truncate">{evento.predio}</span>
                </Linha>
                <Linha label="Cliente">
                  <span className="block truncate">{evento.cliente}</span>
                </Linha>
                <Linha label="Periodicidade">
                  <span className="tabular-nums">
                    {detalhe ? `A cada ${detalhe.periodicidade_dias} dias` : "Sem plano ativo"}
                  </span>
                </Linha>
                <Linha label="Última manutenção">
                  <span className="tabular-nums">
                    {evento.situacao === "concluida"
                      ? formatData(evento.data)
                      : formatData(detalhe?.ultima_manutencao)}
                  </span>
                </Linha>
                <Linha label="Próxima data">
                  <span className="tabular-nums">{formatData(detalhe?.proxima_data)}</span>
                </Linha>
              </dl>

              <div className="mt-5">
                {evento.os_id !== null ? (
                  <Link
                    href={`/chamados/${evento.os_id}`}
                    className={cn(buttonVariants({ size: "lg" }), "w-full")}
                  >
                    Ver OS
                    {evento.os_numero !== null && (
                      <span className="tabular-nums opacity-70">#{evento.os_numero}</span>
                    )}
                    <ArrowUpRightIcon aria-hidden="true" />
                  </Link>
                ) : (
                  <p className="flex items-start gap-2.5 rounded-2xl bg-console-3/60 px-4 py-3 text-[0.8125rem] leading-relaxed text-ink-dim">
                    <InfoIcon className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden="true" />
                    A OS será gerada automaticamente perto da data prevista.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
