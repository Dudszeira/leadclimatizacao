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
  if (!iso) return "—"
  return format(parseDia(iso), "dd/MM/yyyy", { locale: ptBR })
}

function Linha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-soft py-2.5 last:border-0">
      <dt className="shrink-0 text-[0.68rem] tracking-[0.08em] text-ink-faint uppercase">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-sm text-ink">{children}</dd>
    </div>
  )
}

type PmocEventSheetProps = {
  evento: PmocEvento | null
  detalhe: PmocPlanDetail | undefined
  onClose: () => void
}

/** Sheet lateral com os detalhes da manutenção clicada no calendário. */
export function PmocEventSheet({ evento, detalhe, onClose }: PmocEventSheetProps) {
  const meta = evento ? EVENTO_META[evento.situacao] : null

  return (
    <Sheet open={evento !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="border-line bg-console">
        {evento && meta && (
          <>
            <SheetHeader className="border-b border-line-soft">
              <div className="flex items-center gap-2">
                <SheetTitle className="font-mono text-base tracking-tight text-ink">
                  {evento.codigo_interno}
                </SheetTitle>
                <Badge variant="outline" className={cn("font-medium", meta.badge)}>
                  {meta.label}
                </Badge>
              </div>
              <SheetDescription className="text-ink-dim">
                Manutenção preventiva ·{" "}
                {format(parseDia(evento.data), "EEEE, d 'de' MMMM 'de' yyyy", {
                  locale: ptBR,
                })}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4">
              <dl aria-label="Detalhes da manutenção">
                <Linha label="Equipamento">
                  <span className="font-mono">{evento.codigo_interno}</span>
                  <span className="block text-xs text-ink-dim">
                    {EQUIPMENT_TYPE_LABELS[evento.equipamento_tipo]}
                    {detalhe?.marca ? ` · ${detalhe.marca}` : ""}
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
                  <span className="font-mono tabular-nums">
                    {detalhe
                      ? `a cada ${detalhe.periodicidade_dias} dias`
                      : "—"}
                  </span>
                </Linha>
                <Linha label="Última manutenção">
                  <span className="font-mono tabular-nums">
                    {evento.situacao === "concluida"
                      ? formatData(evento.data)
                      : formatData(detalhe?.ultima_manutencao)}
                  </span>
                </Linha>
                <Linha label="Próxima data">
                  <span className="font-mono tabular-nums">
                    {formatData(detalhe?.proxima_data)}
                  </span>
                </Linha>
                <Linha label="Status">
                  <span className={cn("inline-flex items-center gap-1.5")}>
                    <span
                      className={cn("size-2 rounded-full", meta.dot)}
                      aria-hidden="true"
                    />
                    {meta.label}
                    {evento.projetada && (
                      <span className="text-xs text-ink-faint">(projetada)</span>
                    )}
                  </span>
                </Linha>
              </dl>

              <div className="mt-4">
                {evento.os_id !== null ? (
                  <Link
                    href={`/chamados/${evento.os_id}`}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "h-9 w-full px-4"
                    )}
                  >
                    Ver OS
                    {evento.os_numero !== null && (
                      <span className="font-mono text-xs text-ink-dim">
                        OS-{evento.os_numero}
                      </span>
                    )}
                    <ArrowUpRightIcon aria-hidden="true" />
                  </Link>
                ) : (
                  <p className="flex items-start gap-2 rounded-lg border border-line-soft bg-console-2 px-3 py-2.5 text-xs leading-relaxed text-ink-dim">
                    <InfoIcon
                      className="mt-0.5 size-3.5 shrink-0 text-signal"
                      aria-hidden="true"
                    />
                    A OS será gerada automaticamente na data prevista.
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
