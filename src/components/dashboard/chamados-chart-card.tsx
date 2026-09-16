import { BarChart3Icon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getChamadosPorMes } from "@/server/dashboard"
import { DataError } from "@/components/data-error"
import { ChamadosChart } from "./chamados-chart"

/** Gráfico "Chamados abertos · últimos 6 meses" (série por tipo de OS). */
export async function ChamadosChartCard() {
  const result = await getChamadosPorMes(6)

  return (
    <Card className="console-enter h-full">
      <CardHeader>
        <CardTitle>Chamados abertos · últimos 6 meses</CardTitle>
        <CardDescription>
          Todas as OS criadas no período, empilhadas por tipo
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-end">
        {result.error !== null ? (
          <DataError message={result.error} compact />
        ) : result.data.every((p) => p.total === 0) ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
            <BarChart3Icon className="size-6 text-ink-faint" aria-hidden="true" />
            <p className="text-sm text-ink-dim">
              Nenhum chamado registrado nos últimos 6 meses.
            </p>
          </div>
        ) : (
          <ChamadosChart points={result.data} />
        )}
      </CardContent>
    </Card>
  )
}
