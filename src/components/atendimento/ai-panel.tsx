"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import {
  ArchiveIcon,
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleDashedIcon,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

/** Passo derivado da conversa (metadata das mensagens + relações da OS). */
export type AiStep = {
  label: string
  /** Valor à direita ("Automático", "#1004", código do equipamento…). */
  detail: string | null
  /** Link interno (CRM, chamado), quando existir. */
  href: string | null
  /** true → detalhe em fonte mono (códigos e números). */
  mono: boolean
  done: boolean
}

type AiPanelProps = {
  conversationId: string
  status: ConversationStatus
  steps: AiStep[]
}

// ---------------------------------------------------------------------------
// Conteúdo compartilhado (desktop e mobile)
// ---------------------------------------------------------------------------

function StepDetail({ step }: { step: AiStep }) {
  if (!step.detail) return null
  const className = cn(
    "max-w-32 truncate text-right text-xs",
    step.mono ? "font-mono tabular-nums" : "",
    step.href ? "text-signal hover:underline" : "text-ink-dim",
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
    <ul className="flex flex-col gap-2.5">
      {steps.map((step) => (
        <li key={step.label} className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            {step.done ? (
              <CheckIcon className="size-3.5 shrink-0 text-clear" aria-hidden="true" />
            ) : (
              <CircleDashedIcon
                className="size-3.5 shrink-0 text-ink-faint"
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "truncate text-xs",
                step.done ? "text-ink" : "text-ink-faint",
              )}
            >
              {step.label}
            </span>
            <span className="sr-only">
              {step.done ? "· concluído" : "· pendente"}
            </span>
          </span>
          <StepDetail step={step} />
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
      <p className="text-xs leading-relaxed text-ink-faint">
        Conversa encerrada. Sem ações disponíveis.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {status === "ia" && (
        <Button
          variant="outline"
          className="h-9 justify-start max-md:h-11"
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
        variant="outline"
        className="h-9 justify-start text-ink-dim max-md:h-11"
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

// ---------------------------------------------------------------------------
// Painel lateral (desktop ≥ xl, colapsável)
// ---------------------------------------------------------------------------

export function AiPanel({ conversationId, status, steps }: AiPanelProps) {
  const [collapsed, setCollapsed] = React.useState(false)

  if (collapsed) {
    return (
      <aside className="hidden shrink-0 flex-col items-center rounded-xl border border-line bg-console p-2 xl:flex">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Expandir painel da IA"
          onClick={() => setCollapsed(false)}
        >
          <PanelRightOpenIcon className="text-ink-dim" aria-hidden="true" />
        </Button>
        <BotIcon className="mt-2 size-4 text-ink-faint" aria-hidden="true" />
      </aside>
    )
  }

  return (
    <aside
      className="hidden w-72 shrink-0 flex-col gap-5 overflow-y-auto rounded-xl border border-line bg-console p-4 xl:flex"
      aria-label="O que a IA fez nessa conversa"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-signal-dim"
            aria-hidden="true"
          >
            <BotIcon className="size-4 text-signal" />
          </span>
          <h3 className="text-xs font-medium tracking-wider text-ink-faint uppercase">
            O que a IA fez
          </h3>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Recolher painel da IA"
          onClick={() => setCollapsed(true)}
        >
          <PanelRightCloseIcon className="text-ink-faint" aria-hidden="true" />
        </Button>
      </div>
      <AiSteps steps={steps} />
      <div className="mt-auto border-t border-line-soft pt-4">
        <ConversationActionButtons conversationId={conversationId} status={status} />
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Resumo compacto (< xl): colapsável dentro da coluna da thread
// ---------------------------------------------------------------------------

export function AiSummaryMobile({ conversationId, status, steps }: AiPanelProps) {
  return (
    <Collapsible className="border-b border-line-soft xl:hidden">
      <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left">
        <span className="flex items-center gap-2">
          <BotIcon className="size-4 text-signal" aria-hidden="true" />
          <span className="text-xs font-medium tracking-wider text-ink-dim uppercase">
            O que a IA fez
          </span>
        </span>
        <ChevronDownIcon
          className="size-4 text-ink-faint transition-transform group-data-[panel-open]:rotate-180"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 px-4 pb-4">
        <AiSteps steps={steps} />
        <ConversationActionButtons conversationId={conversationId} status={status} />
      </CollapsibleContent>
    </Collapsible>
  )
}
