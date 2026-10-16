"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import {
  ArchiveIcon,
  BotIcon,
  CheckIcon,
  LoaderCircleIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  UsersRoundIcon,
} from "lucide-react"
import { toast } from "sonner"

import type { ConversationStatus } from "@/lib/types"
import {
  closeConversation,
  transferConversation,
  type ConversationActionResult,
} from "@/server/actions/conversations"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

/** Passo derivado da conversa (metadata das mensagens + relações da OS). */
export type AiStep = {
  label: string
  /** Valor à direita ("Automático", "#1004", código do equipamento…). */
  detail: string | null
  /** Link interno (CRM, chamado), quando existir. */
  href: string | null
  /** true → detalhe com números tabulares (códigos e números de OS). */
  mono: boolean
  done: boolean
}

type AiPanelProps = {
  conversationId: string
  status: ConversationStatus
  steps: AiStep[]
}

// ---------------------------------------------------------------------------
// Conteúdo compartilhado (painel lateral e folha inferior)
// ---------------------------------------------------------------------------

const PANEL_DESCRIPTION = "Resumo automático do que a IA resolveu nesta conversa."

function StepDetail({ step }: { step: AiStep }) {
  if (!step.detail) return null
  const className = cn(
    "block w-fit max-w-full truncate text-[0.8125rem]",
    step.mono && "tabular-nums",
    step.href
      ? "rounded-sm text-signal outline-none hover:underline focus-visible:ring-3 focus-visible:ring-signal/50"
      : "text-ink-dim",
  )
  if (step.href) {
    return (
      <Link href={step.href} className={className} title={step.detail}>
        {step.detail}
      </Link>
    )
  }
  return (
    <span className={className} title={step.detail}>
      {step.detail}
    </span>
  )
}

function AiSteps({ steps }: { steps: AiStep[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line-soft">
      {steps.map((step) => (
        <li key={step.label} className="flex min-h-12 items-center gap-3 py-2.5">
          {step.done ? (
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-clear-dim text-clear"
            >
              <CheckIcon className="size-3.5" strokeWidth={2.5} />
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="size-6 shrink-0 rounded-full border border-dashed border-ink-faint/60"
            />
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={cn("text-sm", step.done ? "text-ink" : "text-ink-faint")}>
              {step.label}
              <span className="sr-only">
                {step.done ? ", concluído" : ", pendente"}
              </span>
            </span>
            <StepDetail step={step} />
          </span>
        </li>
      ))}
    </ul>
  )
}

function ConversationActionButtons({
  conversationId,
  status,
}: {
  conversationId: string
  status: ConversationStatus
}) {
  const router = useRouter()
  const [pendingAction, setPendingAction] = React.useState<string | null>(null)
  const [, startTransition] = React.useTransition()
  const busy = pendingAction !== null

  function run(action: string, fn: () => Promise<ConversationActionResult>) {
    setPendingAction(action)
    startTransition(async () => {
      try {
        const result = await fn()
        if (result.status === "success") {
          toast.success(result.message)
          router.refresh()
        } else {
          toast.error(result.message)
        }
      } finally {
        setPendingAction(null)
      }
    })
  }

  if (status === "encerrado") {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-console-2 px-4 py-3 text-[0.8125rem] leading-relaxed text-ink-dim">
        <ArchiveIcon className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
        Conversa encerrada. Sem ações disponíveis.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {status === "ia" && (
        <Button
          className="w-full"
          disabled={busy}
          aria-busy={pendingAction === "transferir"}
          onClick={() => run("transferir", () => transferConversation(conversationId))}
        >
          {pendingAction === "transferir" ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          ) : (
            <UsersRoundIcon aria-hidden="true" />
          )}
          Transferir para equipe
        </Button>
      )}
      <Button
        variant={status === "ia" ? "secondary" : "default"}
        className="w-full"
        disabled={busy}
        aria-busy={pendingAction === "encerrar"}
        onClick={() => run("encerrar", () => closeConversation(conversationId))}
      >
        {pendingAction === "encerrar" ? (
          <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
        ) : (
          <ArchiveIcon aria-hidden="true" />
        )}
        Encerrar conversa
      </Button>
    </div>
  )
}

function PanelBadge() {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal-dim"
      aria-hidden="true"
    >
      <BotIcon className="size-[1.125rem] text-signal" />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Painel lateral (desktop a partir de xl, recolhível)
// ---------------------------------------------------------------------------

export function AiPanel({ conversationId, status, steps }: AiPanelProps) {
  const [collapsed, setCollapsed] = React.useState(false)

  if (collapsed) {
    return (
      <aside
        className="hidden shrink-0 flex-col items-center gap-3 rounded-[1.375rem] bg-console p-2.5 ring-1 ring-line xl:flex"
        aria-label="Painel da IA recolhido"
      >
        <Button
          variant="secondary"
          size="icon"
          aria-label="Expandir painel da IA"
          onClick={() => setCollapsed(false)}
        >
          <PanelRightOpenIcon aria-hidden="true" />
        </Button>
        <PanelBadge />
      </aside>
    )
  }

  return (
    <aside
      className="hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto rounded-[1.375rem] bg-console p-5 ring-1 ring-line xl:flex"
      aria-labelledby="ai-panel-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PanelBadge />
          <h2
            id="ai-panel-title"
            className="font-display text-[1.0625rem] leading-snug font-medium tracking-[-0.01em] text-ink"
          >
            O que a IA fez
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Recolher painel da IA"
          onClick={() => setCollapsed(true)}
        >
          <PanelRightCloseIcon aria-hidden="true" />
        </Button>
      </div>
      <p className="text-[0.8125rem] leading-relaxed text-ink-dim">{PANEL_DESCRIPTION}</p>
      <AiSteps steps={steps} />
      <div className="mt-auto pt-2">
        <ConversationActionButtons conversationId={conversationId} status={status} />
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Abaixo de xl: botão no cabeçalho da conversa abre o painel em folha inferior
// ---------------------------------------------------------------------------

export function AiPanelSheet({ conversationId, status, steps }: AiPanelProps) {
  const done = steps.filter((s) => s.done).length
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="secondary"
            size="icon"
            className="relative xl:hidden"
            aria-label={`O que a IA fez: ${done} de ${steps.length} passos concluídos`}
          />
        }
      >
        <BotIcon className="text-signal" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-0 sm:mx-auto sm:max-w-xl">
        <SheetHeader className="flex-row items-center gap-3">
          <PanelBadge />
          <div className="flex min-w-0 flex-col gap-0.5">
            <SheetTitle>O que a IA fez</SheetTitle>
            <SheetDescription>{PANEL_DESCRIPTION}</SheetDescription>
          </div>
        </SheetHeader>
        <div className="scroll-contain flex flex-col gap-5 overflow-y-auto px-5 pb-5">
          <AiSteps steps={steps} />
          <ConversationActionButtons conversationId={conversationId} status={status} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
