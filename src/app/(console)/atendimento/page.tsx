import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { cn } from "cn"
import {
  BotMessageSquareIcon,
  InfoIcon,
  MessageSquareTextIcon,
  SearchXIcon,
} from "lucide-react"

import { isDemoMode } from "@/lib/env"
import type { ConversationStatus, ConversationWithMessages } from "@/lib/types"
import {
  getServiceOrderRefsByNumeros,
  listConversations,
  type ConversationOsRef,
} from "@/server/conversations"
import { buttonVariants } from "@/components/ui/button"
import { OS_PRIORITY_META } from "@/components/chamados/format"
import { DataError } from "@/components/clientes/data-error"
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
  title: "Atendimento IA",
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
}

function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): Filters {
  const q = typeof sp.q === "string" ? sp.q : ""
  const status = CONVERSATION_STATUSES.includes(sp.status as ConversationStatus)
    ? (sp.status as ConversationStatus)
    : "todas"
  const c = typeof sp.c === "string" ? sp.c : ""
  return { q, status, c }
}

function buildHref({ q, status, c }: Filters): string {
  const params = new URLSearchParams()
  if (q) params.set("q", q)
  if (status !== "todas") params.set("status", status)
  if (c) params.set("c", c)
  const qs = params.toString()
  return qs ? `/atendimento?${qs}` : "/atendimento"
}

export default async function AtendimentoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = parseFilters(await searchParams)
  const suspenseKey = `${filters.q}|${filters.status}|${filters.c}`

  return (
    <div className="flex h-[calc(100svh-5.5rem)] min-h-0 flex-1 flex-col gap-4 md:h-[calc(100svh-6.5rem)]">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-ink">
          Atendimento IA
        </h2>
        <p className="mt-1 text-sm text-ink-dim">
          Conversas do WhatsApp triadas pela IA — chamados abertos sozinhos, e a
          equipe assume quando precisa.
        </p>
      </header>

      {isDemoMode && (
        <p
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-amber/20 bg-amber-dim px-3 py-2.5 text-sm leading-relaxed text-amber"
        >
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Integração com WhatsApp será conectada na ativação — as conversas
          abaixo são do ambiente de demonstração.
        </p>
      )}

      <Suspense key={suspenseKey} fallback={<AtendimentoSkeleton />}>
        <AtendimentoSection filters={filters} />
      </Suspense>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seção assíncrona: consulta o data layer e monta lista + thread + painel IA
// ---------------------------------------------------------------------------

async function AtendimentoSection({ filters }: { filters: Filters }) {
  const result = await listConversations({
    status: filters.status !== "todas" ? filters.status : undefined,
    search: filters.q || undefined,
  })

  if (result.error !== null) {
    return <DataError message={result.error} />
  }

  const conversations = result.data
  const hasFilters = filters.q !== "" || filters.status !== "todas"

  if (conversations.length === 0) {
    return hasFilters ? (
      <EmptyFiltered />
    ) : (
      <EmptyNoConversations />
    )
  }

  const selected =
    conversations.find((c) => c.id === filters.c) ?? conversations[0]
  // Mobile: a thread só cobre a lista quando o usuário escolheu uma conversa.
  const threadOpen = filters.c !== "" && selected.id === filters.c

  // OS abertas pela IA nesta conversa (metadata das mensagens) → painel + chips.
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
          hrefFor={(id) => buildHref({ ...filters, c: id })}
        />
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
          backHref={buildHref({ ...filters, c: "" })}
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
                href={buildHref({ ...filters, status: tab.value })}
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
    <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-console/50 px-6 py-16 text-center">
      <div
        className="flex size-14 items-center justify-center rounded-2xl border border-line-soft bg-console-2"
        aria-hidden="true"
      >
        <SearchXIcon className="size-7 text-ink-faint" />
      </div>
      <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-ink">
        Nenhuma conversa encontrada
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        Nenhum resultado para a busca e o filtro atuais. Ajuste o termo ou
        limpe os filtros.
      </p>
      <Link
        href="/atendimento"
        className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 px-5")}
      >
        Limpar filtros
      </Link>
    </section>
  )
}

function EmptyNoConversations() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-console/50 px-6 py-16 text-center">
      <div
        className="flex size-14 items-center justify-center rounded-2xl border border-line-soft bg-console-2"
        aria-hidden="true"
      >
        <BotMessageSquareIcon className="size-7 text-ink-faint" />
      </div>
      <h3 className="mt-5 font-display text-lg font-bold tracking-tight text-ink">
        Nenhuma conversa ainda
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        Quando o WhatsApp for conectado, as conversas dos clientes com a IA
        aparecem aqui em tempo real — com chamados abertos automaticamente.
      </p>
      <p className="mt-4 flex items-center gap-2 text-xs text-ink-faint">
        <MessageSquareTextIcon className="size-4" aria-hidden="true" />
        Arquitetura pronta: basta plugar o provedor (src/lib/messaging).
      </p>
    </section>
  )
}
