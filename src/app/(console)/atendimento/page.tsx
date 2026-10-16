import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { cn } from "cn"
import {
  BotMessageSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessageSquareTextIcon,
  SearchXIcon,
} from "lucide-react"

import { isDemoMode } from "@/lib/env"
import { MESSAGING_NOT_CONFIGURED, isMessagingConfigured } from "@/lib/messaging"
import type { ConversationStatus, ConversationWithMessages, Paginated } from "@/lib/types"
import { requireRole } from "@/server/auth"
import {
  THREAD_MESSAGES_MAX,
  THREAD_MESSAGES_STEP,
  getConversation,
  getServiceOrderRefsByNumeros,
  listConversations,
  type ConversationOsRef,
} from "@/server/conversations"
import { OS_PRIORITY_META } from "@/lib/status-meta"
import { buttonVariants } from "@/components/ui/button"
import { DataError } from "@/components/data-error"
import { PageHeader } from "@/components/page-header"
import { EmptyState } from "@/components/empty-state"
import { AiPanel, type AiStep } from "@/components/atendimento/ai-panel"
import { ConversationList } from "@/components/atendimento/conversation-list"
import {
  ConversationsSearch,
  type ConversationStatusParam,
} from "@/components/atendimento/conversations-search"
import { isChamadoAberto, messageOsNumero } from "@/components/atendimento/format"
import { AtendimentoSkeleton } from "@/components/atendimento/skeletons"
import { Thread } from "@/components/atendimento/thread"

export const metadata: Metadata = {
  title: "Atendimento",
}

const CONVERSATION_STATUSES: ConversationStatus[] = [
  "ia",
  "transferido",
  "encerrado",
]

type Filters = {
  q: string
  status: ConversationStatusParam
  /** Id da conversa selecionada (searchParam `c`). */
  c: string
  /** Página da lista de conversas (searchParam `p`, 1-based). */
  p: number
  /** Mensagens carregadas na thread (searchParam `m`). */
  m: number
}

function parsePositiveInt(value: unknown, fallback: number, max: number): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(n, max)
}

function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): Filters {
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : ""
  const status = CONVERSATION_STATUSES.includes(sp.status as ConversationStatus)
    ? (sp.status as ConversationStatus)
    : "todas"
  const c = typeof sp.c === "string" ? sp.c : ""
  const p = parsePositiveInt(sp.p, 1, 10_000)
  const m = parsePositiveInt(sp.m, THREAD_MESSAGES_STEP, THREAD_MESSAGES_MAX)
  return { q, status, c, p, m }
}

function buildHref({ q, status, c, p, m }: Filters): string {
  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (status !== "todas") params.set("status", status)
  if (p > 1) params.set("p", String(p))
  if (c) params.set("c", c)
  if (m !== THREAD_MESSAGES_STEP) params.set("m", String(m))
  const qs = params.toString()
  return qs ? `/atendimento?${qs}` : "/atendimento"
}

export default async function AtendimentoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireRole("admin", "atendente")
  const filters = parseFilters(await searchParams)
  const suspenseKey = `${filters.q}|${filters.status}|${filters.c}|${filters.p}|${filters.m}`
  const messagingEnabled = isMessagingConfigured()

  return (
    <div className="flex flex-1 flex-col md:h-[calc(100svh-8rem)] md:min-h-[34rem] md:flex-none">
      <PageHeader
        title="Atendimento"
        description="Conversas dos clientes com a IA: consulte, transfira para a equipe ou encerre."
        className={cn("md:pb-6", filters.c && "max-md:hidden")}
      >
        {(!messagingEnabled || isDemoMode) && (
          <p
            role="status"
            className="flex w-fit max-w-full items-start gap-2.5 rounded-2xl bg-console-2 px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-ink-dim"
          >
            <span
              aria-hidden="true"
              className="mt-[0.4375rem] size-1.5 shrink-0 rounded-full bg-amber"
            />
            <span>
              {!messagingEnabled && (
                <>
                  {MESSAGING_NOT_CONFIGURED} As conversas registradas continuam
                  disponíveis para consulta.
                </>
              )}
              {isDemoMode && " As conversas abaixo são do ambiente de demonstração."}
            </span>
          </p>
        )}
      </PageHeader>

      <Suspense key={suspenseKey} fallback={<AtendimentoSkeleton />}>
        <AtendimentoSection filters={filters} messagingEnabled={messagingEnabled} />
      </Suspense>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seção assíncrona: consulta o data layer e monta lista + thread + painel IA.
// Celular e tablet: mestre-detalhe (lista OU conversa). lg: lista + conversa.
// xl: três painéis (lista, conversa, painel da IA).
// ---------------------------------------------------------------------------

async function AtendimentoSection({
  filters,
  messagingEnabled,
}: {
  filters: Filters
  messagingEnabled: boolean
}) {
  const result = await listConversations({
    status: filters.status !== "todas" ? filters.status : undefined,
    search: filters.q || undefined,
    page: filters.p,
  })

  if (result.error !== null) {
    return <DataError message={result.error} />
  }

  const page = result.data
  const conversations = page.items
  const hasFilters = filters.q !== "" || filters.status !== "todas"

  if (conversations.length === 0 && !filters.c) {
    if (page.total > 0) {
      // Página além do fim (ex.: link antigo): volta para a primeira.
      return <EmptyPage href={buildHref({ ...filters, p: 1 })} />
    }
    return hasFilters ? <EmptyFiltered /> : <EmptyNoConversations />
  }

  // A conversa aberta vem com janela própria de mensagens (não da lista),
  // mesmo quando não está na página atual.
  const selectedId = filters.c || conversations[0]?.id
  const selectedRes = selectedId
    ? await getConversation(selectedId, { messagesLimit: filters.m })
    : null
  if (selectedRes && selectedRes.error !== null) {
    return <DataError message={selectedRes.error} />
  }
  let selected = selectedRes?.data ?? null
  if (!selected && filters.c && conversations[0]) {
    const fallback = await getConversation(conversations[0].id, { messagesLimit: filters.m })
    selected = fallback.data ?? null
  }
  if (!selected) {
    return hasFilters ? <EmptyFiltered /> : <EmptyNoConversations />
  }
  // Celular/tablet: a conversa só cobre a lista quando o usuário escolheu uma.
  const threadOpen = filters.c !== "" && selected.id === filters.c

  // OS citadas pelas mensagens carregadas (metadata) → painel + chips.
  const numeros = [
    ...new Set(
      selected.messages
        .filter(isChamadoAberto)
        .map(messageOsNumero)
        .filter((n): n is number => n !== null),
    ),
  ]
  const refsResult = await getServiceOrderRefsByNumeros(numeros)
  const osRefs = refsResult.data ?? []
  const aiSteps = buildAiSteps(selected, osRefs)
  const olderHref = selected.has_older_messages && filters.m < THREAD_MESSAGES_MAX
    ? buildHref({
        ...filters,
        c: selected.id,
        m: Math.min(THREAD_MESSAGES_MAX, filters.m + THREAD_MESSAGES_STEP),
      })
    : null

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <section
        aria-label="Lista de conversas"
        className={cn(
          "flex w-full min-w-0 flex-col gap-3 md:min-h-0 md:rounded-[1.375rem] md:bg-console md:p-3 md:ring-1 md:ring-line lg:w-80 lg:shrink-0 xl:w-[22.5rem]",
          threadOpen && "max-lg:hidden",
        )}
      >
        <ConversationsSearch q={filters.q} status={filters.status} c={filters.c} />
        <StatusTabs filters={filters} />
        <ConversationList
          conversations={conversations}
          selectedId={selected.id}
          selectionOnMobile={threadOpen}
          hrefFor={(id) => buildHref({ ...filters, c: id, m: THREAD_MESSAGES_STEP })}
        />
        <ListPagination page={page} filters={filters} />
      </section>

      <section
        aria-label="Conversa selecionada"
        className={cn(
          "min-w-0 flex-1 flex-col overflow-hidden md:min-h-0 md:rounded-[1.375rem] md:bg-console md:ring-1 md:ring-line",
          threadOpen
            ? // Celular: conversa em tela cheia entre a barra superior e a barra de abas.
              "flex max-md:fixed max-md:inset-x-0 max-md:top-[calc(3.5rem+env(safe-area-inset-top))] max-md:bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+0.75rem)] max-md:z-20 max-md:bg-void"
            : "hidden lg:flex",
        )}
      >
        <Thread
          conversation={selected}
          osRefs={osRefs}
          aiSteps={aiSteps}
          backHref={buildHref({ ...filters, c: "", m: THREAD_MESSAGES_STEP })}
          olderHref={olderHref}
          sendDisabledReason={messagingEnabled ? null : MESSAGING_NOT_CONFIGURED}
        />
      </section>

      <AiPanel
        conversationId={selected.id}
        status={selected.status}
        steps={aiSteps}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Paginação da lista (links por URL)
// ---------------------------------------------------------------------------

function ListPagination({
  page,
  filters,
}: {
  page: Paginated<ConversationWithMessages>
  filters: Filters
}) {
  if (page.pageCount <= 1) return null
  const first = (page.page - 1) * page.pageSize + 1
  const last = Math.min(page.total, first + page.items.length - 1)
  const linkClass = buttonVariants({ variant: "ghost", size: "sm" })
  return (
    <nav
      aria-label="Paginação das conversas"
      className="flex items-center justify-between gap-2"
    >
      {page.page > 1 ? (
        <Link href={buildHref({ ...filters, p: page.page - 1 })} className={linkClass}>
          <ChevronLeftIcon aria-hidden="true" />
          Anterior
        </Link>
      ) : (
        <span aria-hidden="true" className="w-16" />
      )}
      <span className="text-xs text-ink-faint tabular-nums">
        {first} a {last} de {page.total}
      </span>
      {page.page < page.pageCount ? (
        <Link href={buildHref({ ...filters, p: page.page + 1 })} className={linkClass}>
          Próxima
          <ChevronRightIcon aria-hidden="true" />
        </Link>
      ) : (
        <span aria-hidden="true" className="w-16" />
      )}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Passos do painel "O que a IA fez" — derivados da conversa e das OS citadas
// ---------------------------------------------------------------------------

function buildAiSteps(
  conversation: ConversationWithMessages,
  osRefs: ConversationOsRef[],
): AiStep[] {
  const client = conversation.client
  const ref = osRefs[0] ?? null
  return [
    {
      label: "Identificou o cliente",
      done: client !== null,
      detail: client
        ? client.nome_fantasia ?? client.razao_social
        : "Lead sem cadastro",
      href: client ? `/clientes/${client.id}` : null,
      mono: false,
    },
    {
      label: "Localizou o equipamento",
      done: ref?.equipment_codigo != null,
      detail: ref?.equipment_codigo ?? null,
      href: null,
      mono: true,
    },
    {
      label: "Abriu chamado no sistema",
      done: ref !== null,
      detail: ref ? `#${ref.numero}` : null,
      href: ref ? `/chamados/${ref.id}` : null,
      mono: true,
    },
    {
      label: "Definiu prioridade",
      done: ref !== null,
      detail: ref ? OS_PRIORITY_META[ref.prioridade].label : null,
      href: null,
      mono: false,
    },
  ]
}

// ---------------------------------------------------------------------------
// Filtro por status (links por URL, mesmo padrão das QuickTabs de /chamados).
// Visual do Tabs variant="default": segmentado em pílula com ativo branco.
// ---------------------------------------------------------------------------

const STATUS_TABS: Array<{ label: string; value: ConversationStatusParam }> = [
  { label: "Todas", value: "todas" },
  { label: "IA", value: "ia" },
  { label: "Transferidas", value: "transferido" },
  { label: "Encerradas", value: "encerrado" },
]

function StatusTabs({ filters }: { filters: Filters }) {
  return (
    <nav
      aria-label="Filtrar conversas por status"
      className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      <ul className="flex h-11 w-max min-w-full items-center gap-1 rounded-full bg-console-2 p-1 md:h-10">
        {STATUS_TABS.map((tab) => {
          const active = filters.status === tab.value
          return (
            <li key={tab.value} className="h-full flex-1">
              <Link
                href={buildHref({ ...filters, status: tab.value, p: 1 })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-full w-full items-center justify-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-[color,background-color] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/50 lg:px-2.5 lg:text-[0.8125rem]",
                  active ? "bg-ink text-void" : "text-ink-dim hover:text-ink",
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Estados vazios
// ---------------------------------------------------------------------------

function EmptyFiltered() {
  return (
    <EmptyState
      icon={SearchXIcon}
      title="Nenhuma conversa encontrada"
      description="Nenhum resultado para a busca e o filtro atuais. Ajuste o termo ou limpe os filtros."
    >
      <Link
        href="/atendimento"
        className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
      >
        Limpar filtros
      </Link>
    </EmptyState>
  )
}

function EmptyPage({ href }: { href: string }) {
  return (
    <EmptyState
      icon={SearchXIcon}
      title="Página sem conversas"
      description="Esta página da lista não existe mais. Volte para a primeira página."
    >
      <Link
        href={href}
        className={cn(buttonVariants({ variant: "outline" }), "mt-6")}
      >
        Ir para a primeira página
      </Link>
    </EmptyState>
  )
}

function EmptyNoConversations() {
  return (
    <EmptyState
      icon={BotMessageSquareIcon}
      title="Nenhuma conversa ainda"
      description="Quando o WhatsApp for conectado, as conversas dos clientes aparecem aqui."
    >
      <p className="mt-4 flex items-center gap-2 text-[0.8125rem] text-ink-faint">
        <MessageSquareTextIcon className="size-4" aria-hidden="true" />
        Integração com WhatsApp prevista para a próxima fase.
      </p>
    </EmptyState>
  )
}
