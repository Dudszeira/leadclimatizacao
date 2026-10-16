"use client"

import * as React from "react"
import { cn } from "cn"
import { CircleAlertIcon, CircleCheckIcon, LoaderCircleIcon, RotateCwIcon } from "lucide-react"

/**
 * Autosave da execução da OS: o técnico em campo não pode perder o que
 * digitou por causa de rede ruim, aba recarregada ou tela bloqueada.
 *
 * - debounce (~1,5s) chamando a action existente da seção;
 * - rascunho em localStorage por OS (limpo quando o servidor confirma);
 * - flush() para salvar na hora (antes de concluir a OS).
 */

export type AutosaveStatus = "salvo" | "salvando" | "nao_salvo"

export type SaveOutcome = { ok: true } | { ok: false; message: string }

/** Erro (pt-BR) se a seção não conseguiu salvar; null quando está tudo gravado. */
export type FlushFn = () => Promise<string | null>

export type SectionSync = {
  /** Algo ainda não confirmado pelo servidor (aciona o aviso ao sair da página). */
  onDirtyChange?: (key: string, dirty: boolean) => void
  /** Registra o "salvar agora" da seção (null ao desmontar). */
  registerFlush?: (key: string, flush: FlushFn | null) => void
}

const STORAGE_PREFIX = "control-lead:os-rascunho:"

export function draftStorageKey(osId: string, section: string): string {
  return `${STORAGE_PREFIX}${osId}:${section}`
}

export function readStoredDraft<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeStoredDraft(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // aba anônima / armazenamento cheio: segue só com o autosave no servidor
  }
}

function clearStoredDraft(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // idem
  }
}

type UseAutosaveOptions = {
  enabled: boolean
  storageKey: string
  /** Serialização estável do valor atual (o que seria salvo). */
  valueKey: string
  /** Serialização do que o servidor já tem. */
  savedKey: string
  /** O que guardar no localStorage (pode ser o rascunho bruto do formulário). */
  persist: () => unknown
  /** Erro que impede salvar (ex.: medição inválida). */
  validate?: () => string | null
  save: () => Promise<SaveOutcome>
  delay?: number
}

export function useAutosave({
  enabled,
  storageKey,
  valueKey,
  savedKey,
  persist,
  validate,
  save,
  delay = 1500,
}: UseAutosaveOptions) {
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const latest = React.useRef({ valueKey, savedKey, persist, validate, save })
  React.useEffect(() => {
    latest.current = { valueKey, savedKey, persist, validate, save }
  })
  // Último valor confirmado por este hook (o pai pode ainda não ter re-renderizado).
  const confirmedRef = React.useRef<string | null>(null)
  const chainRef = React.useRef<Promise<unknown>>(Promise.resolve())

  const flush = React.useCallback((): Promise<string | null> => {
    const run = async (): Promise<string | null> => {
      const { valueKey: v, savedKey: s, validate: check, save: doSave } = latest.current
      if (v === s || v === confirmedRef.current) return null
      const invalid = check?.() ?? null
      if (invalid) {
        setError(invalid)
        return invalid
      }
      setSaving(true)
      try {
        const outcome = await doSave()
        if (outcome.ok) {
          confirmedRef.current = v
          setError(null)
          if (latest.current.valueKey === v) clearStoredDraft(storageKey)
          return null
        }
        setError(outcome.message)
        return outcome.message
      } catch {
        const msg = "Sem conexão. O rascunho fica guardado neste aparelho."
        setError(msg)
        return msg
      } finally {
        setSaving(false)
      }
    }
    const next = chainRef.current.then(run, run)
    chainRef.current = next
    return next
  }, [storageKey])

  const dirty = enabled && valueKey !== savedKey

  React.useEffect(() => {
    if (!enabled) return
    if (valueKey === savedKey || valueKey === confirmedRef.current) {
      clearStoredDraft(storageKey)
      return
    }
    writeStoredDraft(storageKey, latest.current.persist())
    const t = window.setTimeout(() => void flush(), delay)
    return () => window.clearTimeout(t)
  }, [enabled, valueKey, savedKey, storageKey, delay, flush])

  // Voltou a conexão: tenta de novo o que ficou pendente.
  React.useEffect(() => {
    if (!dirty) return
    const onOnline = () => void flush()
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [dirty, flush])

  const status: AutosaveStatus = saving ? "salvando" : dirty ? "nao_salvo" : "salvo"
  return { status, error: dirty ? error : null, dirty: dirty || saving, flush }
}

/** Liga a seção ao workspace: estado sujo e flush registrados pelo `key`. */
export function useSectionSync(
  key: string,
  dirty: boolean,
  flush: FlushFn,
  { onDirtyChange, registerFlush }: SectionSync,
) {
  React.useEffect(() => {
    onDirtyChange?.(key, dirty)
  }, [key, dirty, onDirtyChange])
  React.useEffect(() => {
    if (!onDirtyChange) return
    return () => onDirtyChange(key, false)
  }, [key, onDirtyChange])
  React.useEffect(() => {
    registerFlush?.(key, flush)
    return () => registerFlush?.(key, null)
  }, [key, flush, registerFlush])
}

/** "Salvo / Salvando / Não salvo" com motivo e botão de tentar de novo. */
export function SaveIndicator({
  status,
  error,
  onRetry,
  className,
}: {
  status: AutosaveStatus
  error: string | null
  onRetry: () => void
  className?: string
}) {
  return (
    <div
      className={cn("flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]", className)}
    >
      <p
        className={cn(
          "flex items-center gap-1.5",
          status === "salvo" && "text-clear",
          status === "salvando" && "text-ink-dim",
          status === "nao_salvo" && (error ? "text-danger" : "text-amber"),
        )}
        role="status"
        aria-live="polite"
      >
        {status === "salvando" ? (
          <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
        ) : status === "salvo" ? (
          <CircleCheckIcon className="size-3.5" aria-hidden="true" />
        ) : (
          <CircleAlertIcon className="size-3.5" aria-hidden="true" />
        )}
        {status === "salvo" ? "Salvo" : status === "salvando" ? "Salvando…" : "Não salvo"}
        {status === "nao_salvo" && error ? <span>. {error}</span> : null}
      </p>
      {status === "nao_salvo" && error && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-medium text-signal underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-signal/50 focus-visible:outline-none"
        >
          <RotateCwIcon className="size-3.5" aria-hidden="true" />
          Tentar de novo
        </button>
      )}
    </div>
  )
}
