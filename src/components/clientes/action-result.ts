import type { FieldErrors } from "./schemas"

/** Retorno padrão das server actions de cadastro (serializável). */
export interface ActionResult {
  ok: boolean
  message: string
  /** true quando a ação foi validada mas não gravada (modo demonstração). */
  demo?: boolean
  fieldErrors?: FieldErrors
  /** id do registro criado/alterado. */
  id?: string
}

export const DEMO_MESSAGE =
  "Modo demonstração — dados validados, mas nada foi gravado. Conecte o banco para salvar."

export const RLS_BLOCK_MESSAGE =
  "Não foi possível salvar: registro não encontrado ou sem permissão para alterá-lo."
