/**
 * Regras puras da execução de OS — usadas no cliente (UX) E no servidor
 * (validação de verdade nas server actions). Sem dependências de runtime
 * (só `import type`), para rodar igual no browser, no Node e no vitest.
 *
 * Contrato do banco (0004/0005): técnico só faz aberto|agendado -> em_campo e
 * em_campo -> concluido, só na OS dele; concluded_at é carimbado pelo banco.
 */
import type {
  ChecklistItem,
  ChecklistRespostas,
  OsStatus,
  UserRole,
} from "@/lib/types"

// ---------------------------------------------------------------------------
// Máquina de estados
// ---------------------------------------------------------------------------

const ALL: readonly UserRole[] = ["admin", "atendente", "tecnico"]
const OFFICE: readonly UserRole[] = ["admin", "atendente"]

/** Transições permitidas: origem -> destino -> papéis. */
export const OS_TRANSITIONS: Record<OsStatus, Partial<Record<OsStatus, readonly UserRole[]>>> = {
  aberto: { agendado: OFFICE, em_campo: ALL, cancelado: OFFICE },
  // agendado -> agendado = reagendamento
  agendado: { agendado: OFFICE, em_campo: ALL, cancelado: OFFICE },
  em_campo: { concluido: ALL, cancelado: OFFICE },
  concluido: {},
  cancelado: {},
}

export function canTransition(from: OsStatus, to: OsStatus, role: UserRole): boolean {
  return OS_TRANSITIONS[from][to]?.includes(role) ?? false
}

/** Status de origem a partir dos quais o papel pode levar a OS para `to` (filtro .in()). */
export function sourceStatusesFor(to: OsStatus, role: UserRole): OsStatus[] {
  return (Object.keys(OS_TRANSITIONS) as OsStatus[]).filter((from) =>
    canTransition(from, to, role),
  )
}

/** OS em execução aceita checklist, fotos, laudo e assinatura. */
export function isExecutionOpen(status: OsStatus): boolean {
  return status === "em_campo"
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

/** Item de template com marca opcional de obrigatoriedade (JSONB livre). */
type ChecklistItemLike = ChecklistItem & { obrigatorio?: boolean }

export const CHECKLIST_TEXT_MAX = 2000
const NUMBER_ABS_MAX = 1_000_000

/**
 * Obrigatório por padrão: checkbox (conforme/não conforme) e número.
 * Texto livre é opcional, salvo `obrigatorio: true` no template.
 */
export function isChecklistItemRequired(item: ChecklistItemLike): boolean {
  if (typeof item.obrigatorio === "boolean") return item.obrigatorio
  return item.tipo !== "texto"
}

/** Respondido: checkbox com true/false (conforme ou não), número finito, texto não vazio. */
export function isChecklistItemAnswered(item: ChecklistItem, value: unknown): boolean {
  switch (item.tipo) {
    case "checkbox":
      return typeof value === "boolean"
    case "numero":
      return typeof value === "number" && Number.isFinite(value)
    case "texto":
      return typeof value === "string" && value.trim().length > 0
  }
}

export function pendingRequiredItems(
  itens: readonly ChecklistItem[],
  respostas: ChecklistRespostas | null | undefined,
): ChecklistItem[] {
  const r = respostas ?? {}
  return itens.filter(
    (item) => isChecklistItemRequired(item) && !isChecklistItemAnswered(item, r[item.id]),
  )
}

/**
 * Sanitiza respostas vindas do cliente contra o template: descarta chaves
 * desconhecidas, valida tipos e limita tamanhos. Devolve erros legíveis.
 */
export function normalizeChecklistAnswers(
  itens: readonly ChecklistItem[],
  raw: unknown,
): { respostas: ChecklistRespostas; errors: string[] } {
  const respostas: ChecklistRespostas = {}
  const errors: string[] = []
  const input =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  for (const item of itens) {
    const value = input[item.id]
    if (value === undefined || value === null || value === "") {
      respostas[item.id] = null
      continue
    }
    if (item.tipo === "checkbox") {
      if (typeof value !== "boolean") errors.push(`"${item.label}": resposta inválida.`)
      else respostas[item.id] = value
    } else if (item.tipo === "numero") {
      const n = typeof value === "number" ? value : Number(String(value).replace(",", "."))
      if (!Number.isFinite(n) || Math.abs(n) > NUMBER_ABS_MAX) {
        errors.push(`"${item.label}": informe um número válido.`)
      } else {
        respostas[item.id] = n
      }
    } else {
      if (typeof value !== "string") {
        errors.push(`"${item.label}": resposta inválida.`)
      } else if (value.length > CHECKLIST_TEXT_MAX) {
        errors.push(`"${item.label}": máximo de ${CHECKLIST_TEXT_MAX} caracteres.`)
      } else {
        const t = value.trim()
        respostas[item.id] = t ? t : null
      }
    }
  }
  return { respostas, errors }
}

// ---------------------------------------------------------------------------
// Prontidão para concluir
// ---------------------------------------------------------------------------

export interface ConclusionInput {
  status: OsStatus
  itens: readonly ChecklistItem[] | null
  respostas: ChecklistRespostas | null | undefined
  fotosDepois: number
  assinaturaPath: string | null | undefined
  assinadoPorNome: string | null | undefined
}

export interface ConclusionReadiness {
  ready: boolean
  /** Pendências em pt-BR, na ordem em que aparecem na tela. */
  pendencias: string[]
}

export function evaluateConclusion(input: ConclusionInput): ConclusionReadiness {
  const pendencias: string[] = []
  if (input.status !== "em_campo") {
    pendencias.push("Faça o check-in (OS em campo) antes de concluir.")
  }
  const faltando = pendingRequiredItems(input.itens ?? [], input.respostas)
  if (faltando.length === 1) {
    pendencias.push(`Responda o item obrigatório do checklist: ${faltando[0].label}.`)
  } else if (faltando.length > 1) {
    pendencias.push(`Responda os ${faltando.length} itens obrigatórios do checklist.`)
  }
  if (input.fotosDepois < 1) {
    pendencias.push('Envie pelo menos 1 foto "depois" do serviço.')
  }
  if (!input.assinaturaPath || !input.assinadoPorNome?.trim()) {
    pendencias.push("Colete a assinatura e o nome do responsável no local.")
  }
  return { ready: pendencias.length === 0, pendencias }
}

// ---------------------------------------------------------------------------
// Arquivos (fotos e assinatura)
// ---------------------------------------------------------------------------

export type FotoEtapa = "antes" | "depois"

export const PHOTO_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
/** Limite do bucket os-fotos (0004). */
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024
/** Original aceito antes da compressão (fotos de celular moderno). */
export const PHOTO_INPUT_MAX_BYTES = 25 * 1024 * 1024
export const PHOTO_MAX_DIMENSION = 1600
export const PHOTO_JPEG_QUALITY = 0.8

export const SIGNATURE_TYPE = "image/png"
/** Limite do bucket os-assinaturas (0004). */
export const SIGNATURE_MAX_BYTES = 1024 * 1024

export const LEGENDA_MAX = 140

function mb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`
}

/** Valida o arquivo escolhido pelo usuário (antes da compressão). null = ok. */
export function validatePhotoInput(file: { type: string; size: number }): string | null {
  if (!(PHOTO_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return "Formato não suportado. Use foto JPEG, PNG ou WebP."
  }
  if (file.size <= 0) return "Arquivo vazio. Tire a foto novamente."
  if (file.size > PHOTO_INPUT_MAX_BYTES) {
    return `Foto muito grande (máx. ${mb(PHOTO_INPUT_MAX_BYTES)}).`
  }
  return null
}

/** Valida o arquivo que vai para o bucket (após compressão) — mesma regra do servidor. */
export function validatePhotoUpload(file: { type: string; size: number }): string | null {
  if (!(PHOTO_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return "Formato não suportado. Use foto JPEG, PNG ou WebP."
  }
  if (file.size <= 0) return "Arquivo vazio. Tire a foto novamente."
  if (file.size > PHOTO_MAX_BYTES) return `Foto acima de ${mb(PHOTO_MAX_BYTES)} após compressão.`
  return null
}

export function validateSignatureUpload(file: { type: string; size: number }): string | null {
  if (file.type !== SIGNATURE_TYPE) return "Assinatura inválida, deve ser PNG."
  if (file.size <= 0) return "Assinatura vazia. Assine no quadro."
  if (file.size > SIGNATURE_MAX_BYTES) return "Assinatura acima de 1 MB. Limpe e assine de novo."
  return null
}

/** Dimensões de saída preservando proporção, lado maior <= max. */
export function fitWithin(
  width: number,
  height: number,
  max: number = PHOTO_MAX_DIMENSION,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 }
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}$/

/**
 * Caminho no Storage SEMPRE "<service_order_id>/<arquivo>" (um nível, nome
 * seguro, extensão esperada). Bloqueia path traversal e OS trocada.
 */
export function isValidOsStoragePath(
  osId: string,
  path: string,
  extensions: readonly string[],
): boolean {
  if (!UUID_RE.test(osId)) return false
  const parts = path.split("/")
  if (parts.length !== 2) return false
  const [dir, file] = parts
  if (dir.toLowerCase() !== osId.toLowerCase()) return false
  if (!FILE_RE.test(file) || file.includes("..")) return false
  const lower = file.toLowerCase()
  return extensions.some((ext) => lower.endsWith(`.${ext}`))
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8).padEnd(6, "0")
}

export function buildPhotoPath(osId: string, etapa: FotoEtapa, now = new Date()): string {
  return `${osId}/${etapa}-${stamp(now)}-${randomSuffix()}.jpg`
}

export function buildSignaturePath(osId: string, now = new Date()): string {
  return `${osId}/assinatura-${stamp(now)}-${randomSuffix()}.png`
}

// ---------------------------------------------------------------------------
// App de campo: agrupamento e endereço
// ---------------------------------------------------------------------------

const TZ = "America/Sao_Paulo"
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** "YYYY-MM-DD" do instante no fuso de Curitiba. */
export function dayKeyBRT(date: Date): string {
  return dayFormatter.format(date)
}

export interface FieldGroupable {
  status: OsStatus
  scheduled_at: string | null
  checkin_at?: string | null
}

export interface FieldGroups<T> {
  emAndamento: T[]
  hoje: T[]
  proximas: T[]
}

function byTime(a: string | null | undefined, b: string | null | undefined): number {
  if (a && b) return a.localeCompare(b)
  if (a) return -1
  if (b) return 1
  return 0
}

/**
 * Em andamento = em_campo. Hoje = agendadas para hoje (BRT) ou atrasadas.
 * Próximas = futuras e sem data. Concluídas/canceladas ficam de fora.
 */
export function groupFieldOrders<T extends FieldGroupable>(
  items: readonly T[],
  now: Date = new Date(),
): FieldGroups<T> {
  const today = dayKeyBRT(now)
  const groups: FieldGroups<T> = { emAndamento: [], hoje: [], proximas: [] }
  for (const os of items) {
    if (os.status === "em_campo") groups.emAndamento.push(os)
    else if (os.status !== "aberto" && os.status !== "agendado") continue
    else if (os.scheduled_at && dayKeyBRT(new Date(os.scheduled_at)) <= today) groups.hoje.push(os)
    else groups.proximas.push(os)
  }
  groups.emAndamento.sort((a, b) => byTime(a.checkin_at, b.checkin_at))
  groups.hoje.sort((a, b) => byTime(a.scheduled_at, b.scheduled_at))
  groups.proximas.sort((a, b) => byTime(a.scheduled_at, b.scheduled_at))
  return groups
}

export function isOverdue(scheduledAt: string | null, now: Date = new Date()): boolean {
  if (!scheduledAt) return false
  return dayKeyBRT(new Date(scheduledAt)) < dayKeyBRT(now)
}

export interface AddressLike {
  nome?: string | null
  logradouro: string | null
  numero: string | null
  bairro: string | null
  cidade: string
  uf: string
  lat: number | null
  lng: number | null
}

export function formatEndereco(b: AddressLike): string {
  const rua = [b.logradouro, b.numero].filter(Boolean).join(", ")
  const local = [b.bairro, `${b.cidade}/${b.uf}`].filter(Boolean).join(" · ")
  return [rua, local].filter(Boolean).join(" · ")
}

/** Link universal do Google Maps (abre o app no celular). */
export function mapsHref(b: AddressLike): string | null {
  if (b.lat !== null && b.lng !== null && Number.isFinite(b.lat) && Number.isFinite(b.lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lng}`
  }
  const q = [b.logradouro, b.numero, b.bairro, b.cidade, b.uf].filter(Boolean).join(", ")
  if (!b.logradouro) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}
