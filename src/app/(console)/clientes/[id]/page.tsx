import { cache } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { cn } from "cn"
import {
  AirVentIcon,
  Building2Icon,
  FileTextIcon,
  MapPinOffIcon,
  PhoneIcon,
  PlusIcon,
} from "lucide-react"
import Link from "next/link"

import type { BuildingWithEquipment, Equipment, PmocPlanListItem } from "@/lib/types"
import { requireRole } from "@/server/auth"
import { getClient } from "@/server/clients"
import { listPmocChecklistOptions, listPmocPlans } from "@/server/pmoc"
import { listQuotes } from "@/server/quotes"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatBRL, formatBtu, formatDateBR, todayBRT } from "@/lib/format"
import {
  CLIENT_STATUS_META,
  CONTRACT_STATUS_META,
  CONTRACT_TYPE_LABELS,
  EQUIPMENT_STATUS_META,
  EQUIPMENT_TYPE_LABELS,
  quoteNumeroLabel,
  regiaoLabel,
  segmentoLabel,
} from "@/lib/status-meta"
import { BackToClients } from "@/components/clientes/back-link"
import { ClientFormDialog } from "@/components/clientes/client-form-dialog"
import { ClientActionsMenu } from "@/components/clientes/client-actions"
import { BuildingCardActions, NewBuildingButton } from "@/components/clientes/building-dialogs"
import { EquipmentRowActions, NewEquipmentButton } from "@/components/clientes/equipment-dialogs"
import { maskDocumento } from "@/components/clientes/validators"
import { PlanoSituacaoBadge } from "@/components/pmoc/plano-situacao-badge"
import { DataError } from "@/components/data-error"
import { PageHeader } from "@/components/page-header"
import { QuoteStatusPill, VencidoPill, isQuoteVencido } from "@/components/orcamentos/quote-pills"

type PageParams = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const ABAS = ["dados", "predios", "equipamentos", "contratos", "orcamentos"] as const
const QUOTES_LIMIT = 10

const getClientCached = cache(getClient)

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { id } = await params
  const result = await getClientCached(id)
  return { title: result.data?.nome_fantasia ?? result.data?.razao_social ?? "Cliente" }
}

function buildAddress(building: BuildingWithEquipment): string {
  const rua = [building.logradouro, building.numero].filter(Boolean).join(", ")
  const cidade = `${building.cidade}/${building.uf}`
  return [rua, building.bairro, cidade].filter(Boolean).join(" · ")
}

type EquipmentItem = Equipment & { predio: string }

export default async function ClienteDetalhePage({ params, searchParams }: PageParams) {
  const profile = await requireRole("admin", "atendente")
  const { id } = await params
  const { aba } = await searchParams
  const abaInicial = ABAS.find((a) => a === aba) ?? "dados"
  const result = await getClientCached(id)

  if (result.error !== null) {
    return (
      <div className="flex flex-1 flex-col">
        <BackToClients />
        <PageHeader title="Cliente" />
        <DataError message={result.error} />
      </div>
    )
  }
  if (!result.data) notFound()

  const client = result.data
  const [plansResult, checklistResult, quotesResult] = await Promise.all([
    listPmocPlans({ clientId: client.id }),
    listPmocChecklistOptions(),
    listQuotes({ clientId: client.id, pageSize: QUOTES_LIMIT }),
  ])
  const hoje = todayBRT()
  const planByEquipment = new Map<string, PmocPlanListItem>(
    (plansResult.data ?? []).map((p) => [p.equipment_id, p]),
  )
  const checklistOptions = checklistResult.data ?? []
  const buildingOptions = client.buildings
    .map((b) => ({ id: b.id, nome: b.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
  const statusMeta = client.ativo
    ? CLIENT_STATUS_META.ativo
    : CLIENT_STATUS_META.inativo
  const equipment: EquipmentItem[] = client.buildings
    .flatMap((b) => b.equipment.map((e) => ({ ...e, predio: b.nome })))
    .sort((a, b) => a.codigo_interno.localeCompare(b.codigo_interno, "pt-BR"))
  const contracts = [...client.contracts].sort(
    (a, b) => b.valor_mensal - a.valor_mensal,
  )

  const nome = client.nome_fantasia ?? client.razao_social
  const canDelete = profile.role === "admin"
  const telefone = client.contato_telefone?.replace(/\D/g, "") ?? ""

  return (
    <div className="flex flex-1 flex-col">
      <BackToClients />
      <PageHeader
        title={nome}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {client.nome_fantasia && (
              <span className="min-w-0 basis-full truncate sm:basis-auto">
                {client.razao_social}
              </span>
            )}
            <Badge variant="outline" className={statusMeta.badgeClassName}>
              {statusMeta.label}
            </Badge>
            {client.segmento && (
              <Badge variant="outline">{segmentoLabel(client.segmento)}</Badge>
            )}
          </span>
        }
        actions={
          <>
            {telefone && (
              <a
                href={`tel:${telefone}`}
                className={buttonVariants({ variant: "secondary", className: "md:hidden" })}
              >
                <PhoneIcon aria-hidden="true" />
                Ligar
              </a>
            )}
            <ClientFormDialog
              client={{
                id: client.id,
                razao_social: client.razao_social,
                nome_fantasia: client.nome_fantasia,
                cnpj: client.cnpj,
                segmento: client.segmento,
                contato_nome: client.contato_nome,
                contato_email: client.contato_email,
                contato_telefone: client.contato_telefone,
                observacoes: client.observacoes,
              }}
            />
            <ClientActionsMenu
              client={{
                id: client.id,
                razao_social: client.razao_social,
                ativo: client.ativo,
                codigo_servico_municipal: client.codigo_servico_municipal,
                aliquota_iss: client.aliquota_iss,
                reter_iss: client.reter_iss,
              }}
            />
          </>
        }
      />

      <Tabs defaultValue={abaInicial} className="gap-6 md:gap-8">
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList variant="line" className="min-w-full max-md:gap-5">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="predios">
              Prédios
              <TabCount value={client.buildings.length} />
            </TabsTrigger>
            <TabsTrigger value="equipamentos">
              Equipamentos
              <TabCount value={equipment.length} />
            </TabsTrigger>
            <TabsTrigger value="contratos">
              Contratos
              <TabCount value={contracts.length} />
            </TabsTrigger>
            <TabsTrigger value="orcamentos">
              Orçamentos
              {quotesResult.data && <TabCount value={quotesResult.data.total} />}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="dados" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Contato</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-line-soft">
                <InfoRow label="Responsável">
                  {client.contato_nome ?? <Missing />}
                </InfoRow>
                <InfoRow label="Telefone">
                  {client.contato_telefone ? (
                    <a
                      href={`tel:${telefone}`}
                      className="text-ink underline-offset-4 hover:text-signal hover:underline"
                    >
                      {client.contato_telefone}
                    </a>
                  ) : (
                    <Missing />
                  )}
                </InfoRow>
                <InfoRow label="E-mail">
                  {client.contato_email ? (
                    <a
                      href={`mailto:${client.contato_email}`}
                      className="block truncate text-ink underline-offset-4 hover:text-signal hover:underline"
                    >
                      {client.contato_email}
                    </a>
                  ) : (
                    <Missing />
                  )}
                </InfoRow>
                <InfoRow label={client.cnpj && client.cnpj.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ"}>
                  {client.cnpj ? (
                    maskDocumento(client.cnpj)
                  ) : (
                    <Missing />
                  )}
                </InfoRow>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Nota fiscal de serviço</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-line-soft">
                <InfoRow label="Serviço municipal">
                  {client.codigo_servico_municipal ?? <Missing />}
                </InfoRow>
                <InfoRow label="Alíquota ISS">
                  <span className="tabular-nums">
                    {String(client.aliquota_iss ?? 5).replace(".", ",")}%
                  </span>
                </InfoRow>
                <InfoRow label="Retenção">
                  {client.reter_iss ? "Retido pelo tomador" : "Sem retenção"}
                </InfoRow>
              </dl>
            </CardContent>
          </Card>
          {client.observacoes && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink-dim">
                  {client.observacoes}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="predios" className="flex flex-col gap-4">
          <SectionBar
            text={countLabel(client.buildings.length, "prédio", "prédios")}
            action={<NewBuildingButton clientId={client.id} />}
          />
          {client.buildings.length === 0 ? (
            <TabEmpty message="Nenhum prédio cadastrado. Cadastre o primeiro endereço atendido para vincular equipamentos." />
          ) : (
            <ListCard label={`Prédios de ${nome}`}>
              {client.buildings.map((building) => {
                const comChamado = building.equipment.filter(
                  (e) =>
                    e.status === "chamado_aberto" ||
                    e.status === "tecnico_em_campo",
                ).length
                const semCoordenadas = building.lat == null || building.lng == null
                return (
                  <li
                    key={building.id}
                    className="flex items-start gap-3 py-3.5 pr-2 pl-4 md:pl-5"
                  >
                    <IconTile icon={Building2Icon} />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="truncate text-[0.9375rem] font-medium text-ink">
                        {building.nome}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[0.8125rem] leading-snug text-ink-dim">
                        {buildAddress(building)}
                        {building.cep && <span className="tabular-nums">{` · CEP ${building.cep}`}</span>}
                      </p>
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.8125rem] text-ink-dim">
                        <span>
                          <span className="text-ink tabular-nums">{building.equipment.length}</span>{" "}
                          {building.equipment.length === 1 ? "equipamento" : "equipamentos"}
                        </span>
                        {building.regiao && <span>{regiaoLabel(building.regiao)}</span>}
                        {comChamado > 0 && (
                          <Badge variant="outline" className="border-transparent bg-amber-dim text-amber">
                            {comChamado} com chamado
                          </Badge>
                        )}
                        {semCoordenadas && (
                          <span className="inline-flex items-center gap-1 text-ink-faint">
                            <MapPinOffIcon className="size-3.5" aria-hidden="true" />
                            Fora do mapa
                          </span>
                        )}
                      </p>
                    </div>
                    <BuildingCardActions
                      building={building}
                      buildings={buildingOptions}
                      equipmentCount={building.equipment.length}
                      canDelete={canDelete}
                    />
                  </li>
                )
              })}
            </ListCard>
          )}
        </TabsContent>

        <TabsContent value="equipamentos" className="flex flex-col gap-4">
          <SectionBar
            text={countLabel(equipment.length, "equipamento", "equipamentos")}
            action={<NewEquipmentButton buildings={buildingOptions} />}
          />
          {equipment.length === 0 ? (
            <TabEmpty
              message={
                client.buildings.length === 0
                  ? "Cadastre um prédio primeiro; os equipamentos ficam vinculados a ele."
                  : "Nenhum equipamento cadastrado. Use Novo equipamento para registrar o primeiro."
              }
            />
          ) : (
            <>
              <ListCard label={`Equipamentos de ${nome}`} className="md:hidden">
                {equipment.map((item) => (
                  <EquipmentListRow
                    key={item.id}
                    item={item}
                    plan={planByEquipment.get(item.id) ?? null}
                    buildingOptions={buildingOptions}
                    checklistOptions={checklistOptions}
                  />
                ))}
              </ListCard>
              <div className="overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line max-md:hidden">
                <Table aria-label={`Equipamentos de ${nome}`}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Marca e modelo</TableHead>
                      <TableHead className="text-right">Capacidade</TableHead>
                      <TableHead>Prédio</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>PMOC</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Ações</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipment.map((item) => {
                      const meta = EQUIPMENT_STATUS_META[item.status]
                      const plan = planByEquipment.get(item.id) ?? null
                      const marcaModelo = [item.marca, item.modelo].filter(Boolean).join(" ")
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-ink tabular-nums">
                            {item.codigo_interno}
                          </TableCell>
                          <TableCell className="text-ink">
                            {EQUIPMENT_TYPE_LABELS[item.tipo]}
                          </TableCell>
                          <TableCell className="max-w-56">
                            <span className="block truncate text-ink-dim">
                              {marcaModelo || <Missing />}
                            </span>
                            {item.numero_serie && (
                              <span className="mt-0.5 block truncate text-[0.8125rem] text-ink-faint tabular-nums">
                                Série {item.numero_serie}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-ink tabular-nums">
                            {formatBtu(item.capacidade_btu)}
                          </TableCell>
                          <TableCell className="max-w-52">
                            <span className="block truncate text-ink-dim">{item.predio}</span>
                          </TableCell>
                          <TableCell>
                            <StatusDot className={meta.dotClassName} label={meta.label} />
                          </TableCell>
                          <TableCell>
                            {plan ? (
                              <PlanoSituacaoBadge plan={plan} />
                            ) : (
                              <span className="text-[0.8125rem] text-ink-faint">Sem plano</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <EquipmentRowActions
                              equipment={item}
                              buildings={buildingOptions}
                              plan={plan}
                              checklistOptions={checklistOptions}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="contratos" className="flex flex-col gap-4">
          {contracts.length === 0 ? (
            <TabEmpty message="Nenhum contrato cadastrado para este cliente." />
          ) : (
            <ListCard label={`Contratos de ${nome}`}>
              {contracts.map((contract) => {
                const meta = CONTRACT_STATUS_META[contract.status]
                return (
                  <li key={contract.id} className="flex items-center gap-3 px-4 py-3.5 md:px-5">
                    <IconTile icon={FileTextIcon} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate text-[0.9375rem] font-medium text-ink">
                          {CONTRACT_TYPE_LABELS[contract.tipo]}
                        </p>
                        <p className="shrink-0 font-display text-base font-medium text-ink tabular-nums">
                          {formatBRL(contract.valor_mensal)}
                          <span className="font-sans text-[0.8125rem] font-normal text-ink-faint">/mês</span>
                        </p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                        <p className="text-[0.8125rem] text-ink-dim">
                          Desde <span className="tabular-nums">{formatDateBR(contract.inicio)}</span>
                          , vence dia{" "}
                          <span className="tabular-nums">{contract.dia_vencimento}</span>
                        </p>
                        <Badge variant="outline" className={meta.badgeClassName}>
                          {meta.label}
                        </Badge>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ListCard>
          )}
        </TabsContent>

        <TabsContent value="orcamentos" className="flex flex-col gap-4">
          <SectionBar
            text={
              quotesResult.data
                ? quotesResult.data.total > QUOTES_LIMIT
                  ? `Últimos ${QUOTES_LIMIT} de ${quotesResult.data.total} orçamentos`
                  : countLabel(quotesResult.data.total, "orçamento", "orçamentos")
                : "Orçamentos"
            }
            action={
              <Link
                href={`/orcamentos/novo?client=${client.id}`}
                className={buttonVariants({ variant: "secondary" })}
              >
                <PlusIcon aria-hidden="true" />
                Novo orçamento
              </Link>
            }
          />
          {quotesResult.error !== null ? (
            <DataError message={quotesResult.error} compact />
          ) : quotesResult.data.items.length === 0 ? (
            <TabEmpty message="Nenhum orçamento para este cliente. Use Novo orçamento para montar o primeiro." />
          ) : (
            <ListCard label={`Orçamentos de ${nome}`}>
              {quotesResult.data.items.map((q) => {
                const vencido = isQuoteVencido(q, hoje)
                return (
                  <li key={q.id}>
                    <Link
                      href={`/orcamentos/${q.id}`}
                      aria-label={`Abrir orçamento ${quoteNumeroLabel(q.numero)}: ${q.titulo}`}
                      className="flex items-center gap-3 px-4 py-3.5 outline-none hover:bg-console-2/60 focus-visible:bg-console-2 md:px-5"
                    >
                      <span className="shrink-0 max-md:hidden">
                        <IconTile icon={FileTextIcon} />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[0.8125rem] font-medium text-ink-dim tabular-nums">
                            {quoteNumeroLabel(q.numero)}
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {vencido && <VencidoPill />}
                            <QuoteStatusPill status={q.status} />
                          </span>
                        </div>
                        <p className="line-clamp-2 text-[0.9375rem] leading-snug text-ink">{q.titulo}</p>
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="min-w-0 truncate text-[0.8125rem] text-ink-dim">
                            Válido até{" "}
                            <span className={vencido ? "text-danger tabular-nums" : "tabular-nums"}>
                              {formatDateBR(q.validade)}
                            </span>
                          </p>
                          <p className="shrink-0 font-display text-base font-medium text-ink tabular-nums">
                            {formatBRL(q.total)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ListCard>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Peças da tela
// ---------------------------------------------------------------------------

function countLabel(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

function TabCount({ value }: { value: number }) {
  return <span className="text-ink-faint tabular-nums">{value}</span>
}

function Missing() {
  return <span className="text-ink-faint">Não informado</span>
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-sm text-ink-dim">{label}</dt>
      <dd className="min-w-0 text-right text-[0.9375rem] text-ink">{children}</dd>
    </div>
  )
}

function SectionBar({ text, action }: { text: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-ink-dim">{text}</p>
      {action}
    </div>
  )
}

function ListCard({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <ul
      aria-label={label}
      className={cn(
        "divide-y divide-line-soft overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line",
        className,
      )}
    >
      {children}
    </ul>
  )
}

function IconTile({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-console-3"
    >
      <Icon className="size-[1.125rem] text-ink-dim" />
    </span>
  )
}

function StatusDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("size-2 shrink-0 rounded-full", className)} aria-hidden="true" />
      <span className="text-ink-dim">{label}</span>
    </span>
  )
}

function EquipmentListRow({
  item,
  plan,
  buildingOptions,
  checklistOptions,
}: {
  item: EquipmentItem
  plan: PmocPlanListItem | null
  buildingOptions: React.ComponentProps<typeof EquipmentRowActions>["buildings"]
  checklistOptions: React.ComponentProps<typeof EquipmentRowActions>["checklistOptions"]
}) {
  const meta = EQUIPMENT_STATUS_META[item.status]
  const detalhe = [
    [item.marca, item.modelo].filter(Boolean).join(" "),
    item.capacidade_btu != null ? formatBtu(item.capacidade_btu) : null,
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <li className="flex items-start gap-3 py-3.5 pr-2 pl-4">
      <IconTile icon={AirVentIcon} />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="truncate text-[0.9375rem] text-ink">
          <span className="font-medium tabular-nums">{item.codigo_interno}</span>
          <span className="text-ink-dim">{` · ${EQUIPMENT_TYPE_LABELS[item.tipo]}`}</span>
        </p>
        <p className="mt-0.5 truncate text-[0.8125rem] text-ink-dim">
          {detalhe || "Marca não informada"}
        </p>
        <p className="mt-0.5 truncate text-[0.8125rem] text-ink-faint">{item.predio}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.8125rem]">
          <StatusDot className={meta.dotClassName} label={meta.label} />
          {plan ? (
            <PlanoSituacaoBadge plan={plan} />
          ) : (
            <span className="text-ink-faint">Sem plano PMOC</span>
          )}
        </div>
      </div>
      <EquipmentRowActions
        equipment={item}
        buildings={buildingOptions}
        plan={plan}
        checklistOptions={checklistOptions}
      />
    </li>
  )
}

function TabEmpty({ message }: { message: string }) {
  return (
    <p className="rounded-[1.375rem] bg-console px-6 py-12 text-center text-sm leading-relaxed text-ink-dim ring-1 ring-line">
      {message}
    </p>
  )
}
