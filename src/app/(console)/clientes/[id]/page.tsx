import { cache } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cn } from "cn"
import {
  AirVentIcon,
  Building2Icon,
  FileTextIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  UserRoundIcon,
} from "lucide-react"

import type { BuildingWithEquipment, Equipment } from "@/lib/types"
import { getClient } from "@/server/clients"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatBRL, formatBtu, formatDateBR, maskCnpj } from "@/lib/format"
import {
  CLIENT_STATUS_META,
  CONTRACT_STATUS_META,
  CONTRACT_TYPE_LABELS,
  EQUIPMENT_STATUS_META,
  EQUIPMENT_TYPE_LABELS,
  regiaoLabel,
  segmentoLabel,
} from "@/lib/status-meta"
import { ClientFormDialog } from "@/components/clientes/client-form-dialog"
import { DataError } from "@/components/data-error"

type PageParams = { params: Promise<{ id: string }> }

const getClientCached = cache(getClient)

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { id } = await params
  const result = await getClientCached(id)
  return { title: result.data?.razao_social ?? "Cliente" }
}

function buildAddress(building: BuildingWithEquipment): string {
  const rua = [building.logradouro, building.numero].filter(Boolean).join(", ")
  const cidade = `${building.cidade}/${building.uf}`
  return [rua, building.bairro, cidade].filter(Boolean).join(" — ")
}

export default async function ClienteDetalhePage({ params }: PageParams) {
  const { id } = await params
  const result = await getClientCached(id)

  if (result.error !== null) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <ClienteBreadcrumb label="Cliente" />
        <DataError message={result.error} />
      </div>
    )
  }
  if (!result.data) notFound()

  const client = result.data
  const statusMeta = client.ativo
    ? CLIENT_STATUS_META.ativo
    : CLIENT_STATUS_META.inativo
  const equipment: Array<Equipment & { predio: string }> = client.buildings
    .flatMap((b) => b.equipment.map((e) => ({ ...e, predio: b.nome })))
    .sort((a, b) => a.codigo_interno.localeCompare(b.codigo_interno, "pt-BR"))
  const contracts = [...client.contracts].sort(
    (a, b) => b.valor_mensal - a.valor_mensal,
  )

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ClienteBreadcrumb label={client.razao_social} />

      <Card className="border border-line bg-console ring-0">
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold tracking-tight text-ink">
                  {client.razao_social}
                </h2>
                <Badge
                  variant="outline"
                  className={cn("font-medium", statusMeta.badgeClassName)}
                >
                  {statusMeta.label}
                </Badge>
                {client.segmento && (
                  <Badge variant="outline" className="border-line text-ink-dim">
                    {segmentoLabel(client.segmento)}
                  </Badge>
                )}
              </div>
              {client.nome_fantasia && (
                <p className="mt-1 text-sm text-ink-dim">
                  {client.nome_fantasia}
                </p>
              )}
            </div>
            <ClientFormDialog client={client} />
          </div>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                CNPJ
              </dt>
              <dd className="mt-1 font-mono text-sm text-ink">
                {client.cnpj ? maskCnpj(client.cnpj) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                Contato
              </dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm text-ink">
                <UserRoundIcon
                  className="size-3.5 shrink-0 text-ink-faint"
                  aria-hidden="true"
                />
                <span className="truncate">{client.contato_nome ?? "—"}</span>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                E-mail
              </dt>
              <dd className="mt-1 flex items-center gap-1.5 text-sm">
                <MailIcon
                  className="size-3.5 shrink-0 text-ink-faint"
                  aria-hidden="true"
                />
                {client.contato_email ? (
                  <a
                    href={`mailto:${client.contato_email}`}
                    className="truncate text-ink underline-offset-4 hover:text-signal hover:underline"
                  >
                    {client.contato_email}
                  </a>
                ) : (
                  <span className="text-ink">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                Telefone
              </dt>
              <dd className="mt-1 flex items-center gap-1.5 font-mono text-sm">
                <PhoneIcon
                  className="size-3.5 shrink-0 text-ink-faint"
                  aria-hidden="true"
                />
                {client.contato_telefone ? (
                  <a
                    href={`tel:${client.contato_telefone.replace(/\D/g, "")}`}
                    className="text-ink underline-offset-4 hover:text-signal hover:underline"
                  >
                    {client.contato_telefone}
                  </a>
                ) : (
                  <span className="text-ink">—</span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Tabs defaultValue="predios" className="gap-4">
        <TabsList className="h-10 w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="predios" className="min-h-8 gap-1.5 px-3">
            <Building2Icon aria-hidden="true" />
            Prédios
            <span className="font-mono text-xs text-ink-faint">
              {client.buildings.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="equipamentos" className="min-h-8 gap-1.5 px-3">
            <AirVentIcon aria-hidden="true" />
            Equipamentos
            <span className="font-mono text-xs text-ink-faint">
              {equipment.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="contratos" className="min-h-8 gap-1.5 px-3">
            <FileTextIcon aria-hidden="true" />
            Contratos
            <span className="font-mono text-xs text-ink-faint">
              {contracts.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="predios">
          {client.buildings.length === 0 ? (
            <TabEmpty message="Nenhum prédio cadastrado para este cliente." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {client.buildings.map((building) => {
                const comChamado = building.equipment.filter(
                  (e) =>
                    e.status === "chamado_aberto" ||
                    e.status === "tecnico_em_campo",
                ).length
                return (
                  <Card
                    key={building.id}
                    size="sm"
                    className="border border-line bg-console ring-0"
                  >
                    <CardHeader>
                      <CardTitle className="flex items-start justify-between gap-2 text-ink">
                        <span className="min-w-0 truncate">{building.nome}</span>
                        {building.regiao && (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-line font-mono text-[10px] tracking-wider text-ink-dim uppercase"
                          >
                            {regiaoLabel(building.regiao)}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-3">
                      <p className="flex items-start gap-1.5 text-sm leading-relaxed text-ink-dim">
                        <MapPinIcon
                          className="mt-0.5 size-3.5 shrink-0 text-ink-faint"
                          aria-hidden="true"
                        />
                        <span>
                          {buildAddress(building)}
                          {building.cep && (
                            <span className="block font-mono text-xs text-ink-faint">
                              CEP {building.cep}
                            </span>
                          )}
                        </span>
                      </p>
                      <div className="mt-auto flex items-center gap-3 border-t border-line-soft pt-3 text-sm">
                        <span className="flex items-center gap-1.5 text-ink">
                          <AirVentIcon
                            className="size-3.5 text-ink-faint"
                            aria-hidden="true"
                          />
                          <span className="font-mono">
                            {building.equipment.length}
                          </span>
                          <span className="text-ink-dim">
                            {building.equipment.length === 1
                              ? "equipamento"
                              : "equipamentos"}
                          </span>
                        </span>
                        {comChamado > 0 && (
                          <span className="flex items-center gap-1.5 text-amber">
                            <span
                              className="size-1.5 rounded-full bg-amber"
                              aria-hidden="true"
                            />
                            <span className="font-mono">{comChamado}</span> com
                            chamado
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="equipamentos">
          {equipment.length === 0 ? (
            <TabEmpty message="Nenhum equipamento cadastrado para este cliente." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-console">
              <Table aria-label={`Equipamentos de ${client.razao_social}`}>
                <TableHeader>
                  <TableRow className="border-line-soft hover:bg-transparent">
                    <TableHead className="px-4 text-xs font-medium tracking-wider text-ink-faint uppercase">
                      Código
                    </TableHead>
                    <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                      Tipo
                    </TableHead>
                    <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                      Marca
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium tracking-wider text-ink-faint uppercase">
                      Capacidade
                    </TableHead>
                    <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                      Prédio
                    </TableHead>
                    <TableHead className="px-4 text-xs font-medium tracking-wider text-ink-faint uppercase">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipment.map((item) => {
                    const meta = EQUIPMENT_STATUS_META[item.status]
                    return (
                      <TableRow
                        key={item.id}
                        className="border-line-soft hover:bg-console-2/60"
                      >
                        <TableCell className="px-4 py-3 font-mono text-signal">
                          {item.codigo_interno}
                        </TableCell>
                        <TableCell className="py-3 text-ink">
                          {EQUIPMENT_TYPE_LABELS[item.tipo]}
                        </TableCell>
                        <TableCell className="py-3 text-ink-dim">
                          {item.marca ?? "—"}
                        </TableCell>
                        <TableCell className="py-3 text-right font-mono text-ink">
                          {formatBtu(item.capacidade_btu)}
                        </TableCell>
                        <TableCell className="max-w-52 py-3">
                          <span className="block truncate text-ink-dim">
                            {item.predio}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-2 shrink-0 rounded-full",
                                meta.dotClassName,
                              )}
                              aria-hidden="true"
                            />
                            <span className="text-ink-dim">{meta.label}</span>
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="contratos">
          {contracts.length === 0 ? (
            <TabEmpty message="Nenhum contrato cadastrado para este cliente." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-console">
              <Table aria-label={`Contratos de ${client.razao_social}`}>
                <TableHeader>
                  <TableRow className="border-line-soft hover:bg-transparent">
                    <TableHead className="px-4 text-xs font-medium tracking-wider text-ink-faint uppercase">
                      Tipo
                    </TableHead>
                    <TableHead className="text-right text-xs font-medium tracking-wider text-ink-faint uppercase">
                      Valor mensal
                    </TableHead>
                    <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-medium tracking-wider text-ink-faint uppercase">
                      Vencimento
                    </TableHead>
                    <TableHead className="px-4 text-xs font-medium tracking-wider text-ink-faint uppercase">
                      Início
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => {
                    const meta = CONTRACT_STATUS_META[contract.status]
                    return (
                      <TableRow
                        key={contract.id}
                        className="border-line-soft hover:bg-console-2/60"
                      >
                        <TableCell className="px-4 py-3 text-ink">
                          {CONTRACT_TYPE_LABELS[contract.tipo]}
                        </TableCell>
                        <TableCell className="py-3 text-right font-mono text-ink">
                          {formatBRL(contract.valor_mensal)}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            variant="outline"
                            className={cn("font-medium", meta.badgeClassName)}
                          >
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-ink-dim">
                          Todo dia{" "}
                          <span className="font-mono text-ink">
                            {contract.dia_vencimento}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 font-mono text-ink-dim">
                          {formatDateBR(contract.inicio)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ClienteBreadcrumb({ label }: { label: string }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink
            render={<Link href="/clientes" />}
            className="inline-flex min-h-11 items-center md:min-h-0"
          >
            Clientes
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="max-w-64 truncate sm:max-w-none">
            {label}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function TabEmpty({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-line bg-console/50 px-6 py-10 text-center text-sm text-ink-dim">
      {message}
    </p>
  )
}
