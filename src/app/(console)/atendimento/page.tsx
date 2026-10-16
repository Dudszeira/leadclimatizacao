import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { cn } from "cn"
import {
  BotMessageSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoIcon,
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
    <div className="flex h-[calc(100svh-5.5rem)] min-h-0 flex-1 flex-col gap-4 md:h-[calc(100svh-6.5rem)]">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-ink">
          Atendimento
        </h2>
        <p className="mt-1 text-sm text-ink-dim">
          Histórico das conversas com clientes: consulte, transfira para a
          equipe ou encerre.
        </p>
      </header>

      {(!messagingEnabled || isDemoMode) && (
        <p
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-amber/20 bg-amber-dim px-3 py-2.5 text-sm leading-relaxed text-amber"
        >
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
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

      <Suspense key={suspenseKey} fallback={<AtendimentoSkeleton />}>
        <AtendimentoSection filters={filters} messagingEnabled={messagingEnabled} />
      </Suspense>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seção assíncrona: consulta o data layer e monta lista + thread + painel IA
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
  // Mobile: a thread só cobre a lista quando o usuário escolheu uma conversa.
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
          "flex w-full min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-console md:w-80 md:shrink-0",
          threadOpen && "max-md:hidden",
        )}
      >
        <div className="flex flex-col gap-2 border-b border-line-soft p-3">
          <ConversationsSearch q={filters.q} status={filters.status} c={filters.c} />
          <StatusTabs filters={filters} />
        </div>
        <ConversationList
          conversations={conversations}
          selectedId={selected.id}
          hrefFor={(id) => buildHref({ ...filters, c: id, m: THREAD_MESSAGES_STEP })}
        />
        <ListPagination page={page} filters={filters} />
      </section>

      <section
        aria-label="Conversa selecionada"
        className={cn(
          "min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-console",
          threadOpen ? "flex" : "hidden md:flex",
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
  const linkClass = cn(
    buttonVariants({ variant: "ghost", size: "sm" }),
    "h-8 gap-1 px-2 text-xs max-md:h-11",
  )
  return (
    <nav
      aria-label="Paginação das conversas"
      className="flex items-center justify-between gap-2 border-t border-line-soft px-2 py-1.5"
    >
      {page.page > 1 ? (
        <Link href={buildHref({ ...filters, p: page.page - 1 })} className={linkClass}>
          <ChevronLeftIcon aria-hidden="true" />
          Anterior
        </Link>
      ) : (
        <span aria-hidden="true" className="w-16" />
      )}
      <span className="font-mono text-[11px] text-ink-faint tabular-nums">
        {first}–{last} de {page.total}
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
      detail: ref?.equipment_codigo ?? "—",
      href: null,
      mono: true,
    },
    {
      label: "Abriu chamado no sistema",
      done: ref !== null,
      detail: ref ? `#${ref.numero}` : "—",
      href: ref ? `/chamados/${ref.id}` : null,
      mono: true,
    },
    {
      label: "Definiu prioridade",
      done: ref !== null,
      detail: ref ? OS_PRIORITY_META[ref.prioridade].label : "—",
      href: null,
      mono: false,
    },
  ]
}

// ---------------------------------------------------------------------------
// Filtro por status (links por URL, mesmo padrão das QuickTabs de /chamados)
// ---------------------------------------------------------------------------

const STATUS_TABS: Array<{ label: string; value: ConversationStatusParam }> = [
  { label: "Todas", value: "todas" },
  { label: "IA", value: "ia" },
  { label: "Transferidas", value: "transferido" },
  { label: "Encerradas", value: "encerrado" },
]

function StatusTabs({ filters }: { filters: Filters }) {
  return (
    <nav aria-label="Filtrar conversas por status">
      <ul className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-line bg-console-2/40 p-1">
        {STATUS_TABS.map((tab) => {
          const active = filters.status === tab.value
          return (
            <li key={tab.value}>
              <Link
                href={buildHref({ ...filters, status: tab.value, p: 1 })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-8 items-center rounded-md px-2.5 text-xs font-medium whitespace-nowrap transition-colors max-md:min-h-10",
                  active
                    ? "bg-signal-dim text-signal"
                    : "text-ink-dim hover:bg-console-2 hover:text-ink",
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
        className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 px-5")}
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
        className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 px-5")}
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
      <p className="mt-4 flex items-center gap-2 text-xs text-ink-faint">
        <MessageSquareTextIcon className="size-4" aria-hidden="true" />
        Integração com WhatsApp prevista para a próxima fase.
      </p>
    </EmptyState>
  )
}
