"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { isDemoMode } from "@/lib/env"
import { createClient as createSupabase } from "@/lib/supabase/server"
import { authorizeAction } from "@/server/auth"
import { canonicalDocumento, maskCnpj, maskCpf } from "@/components/clientes/validators"
import {
  ENTIDADES,
  MAX_BYTES,
  MAX_LINHAS,
  validarLinhas,
  type ClienteImport,
  type EquipamentoImport,
  type ErroLinha,
  type LinhaValida,
  type PredioImport,
} from "@/components/importar/csv"

/**
 * Importação em lote (carga inicial) — só admin.
 *
 * O navegador já validou o arquivo para a pré-visualização, mas aqui TUDO é
 * revalidado com o mesmo código (components/importar/csv.ts). O cliente envia
 * lotes de até LOTE_ENVIO linhas (o corpo da action tem limite de 1 MB);
 * cada lote é idempotente — reenviar o mesmo arquivo atualiza em vez de
 * duplicar.
 *
 * Upsert por chave natural:
 * - clientes: CPF/CNPJ (só dígitos; casa com registros gravados com ou sem máscara)
 * - prédios: cliente (CPF/CNPJ) + nome do prédio, sem diferenciar maiúsculas
 * - equipamentos: numero_serie
 * Em registros existentes, só as colunas PRESENTES no arquivo são
 * sobrescritas (célula vazia em coluna presente limpa o valor); colunas
 * ausentes ficam como estão.
 */

export interface ImportarResultado {
  ok: boolean
  message: string
  demo?: boolean
  inseridos: number
  atualizados: number
  erros: ErroLinha[]
}

const loteSchema = z.object({
  entidade: z.enum(["clientes", "predios", "equipamentos"]),
  colunas: z.array(z.string().max(60)).max(40),
  linhas: z
    .array(
      z.object({
        linha: z.number().int().min(2).max(MAX_LINHAS + 1),
        valores: z.record(z.string().max(60), z.string().max(2000)),
      }),
    )
    .min(1, "Nenhuma linha para importar.")
    .max(MAX_LINHAS, `Máximo de ${MAX_LINHAS} linhas por importação.`),
})

const CHUNK_LOOKUP = 150
const CHUNK_WRITE = 500

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Todas as formas em que um documento pode estar gravado. */
function variantesDocumento(digits: string): string[] {
  return digits.length === 11 ? [digits, maskCpf(digits)] : [digits, maskCnpj(digits)]
}

function soDigitos(v: string | null): string {
  return (v ?? "").replace(/\D/g, "")
}

/** Mantém só as colunas presentes no arquivo (mais as obrigatórias). */
function pick<T extends Record<string, unknown>>(
  row: T,
  presentes: Set<string>,
  sempre: string[],
): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(row)) {
    if (presentes.has(k) || sempre.includes(k)) (out as Record<string, unknown>)[k] = v
  }
  return out
}

type Supa = Awaited<ReturnType<typeof createSupabase>>

async function clientesPorDocumento(
  supabase: Supa,
  digitsList: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unicos = [...new Set(digitsList)]
  for (const part of chunks(unicos, CHUNK_LOOKUP)) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, cnpj")
      .in("cnpj", part.flatMap(variantesDocumento))
    if (error) throw error
    for (const c of (data ?? []) as Array<{ id: string; cnpj: string | null }>) {
      map.set(soDigitos(c.cnpj), c.id)
    }
  }
  return map
}

async function gravar(
  supabase: Supa,
  tabela: "clients" | "buildings" | "equipment",
  inserir: Array<{ linha: number; row: Record<string, unknown> }>,
  atualizar: Array<{ linha: number; row: Record<string, unknown> }>,
  erros: ErroLinha[],
): Promise<{ inseridos: number; atualizados: number }> {
  let inseridos = 0
  let atualizados = 0
  for (const part of chunks(inserir, CHUNK_WRITE)) {
    const { error } = await supabase.from(tabela).insert(part.map((p) => p.row))
    if (error) {
      console.error(`[actions/importar] insert ${tabela}:`, error)
      for (const p of part) erros.push({ linha: p.linha, campo: "lote", mensagem: "Falha ao gravar este lote — reenvie o arquivo." })
    } else inseridos += part.length
  }
  for (const part of chunks(atualizar, CHUNK_WRITE)) {
    const { data, error } = await supabase
      .from(tabela)
      .upsert(part.map((p) => p.row), { onConflict: "id", defaultToNull: false })
      .select("id")
    if (error) {
      console.error(`[actions/importar] upsert ${tabela}:`, error)
      for (const p of part) erros.push({ linha: p.linha, campo: "lote", mensagem: "Falha ao atualizar este lote — reenvie o arquivo." })
    } else atualizados += data?.length ?? 0
  }
  return { inseridos, atualizados }
}

async function importarClientes(
  supabase: Supa,
  validas: LinhaValida<ClienteImport>[],
  presentes: Set<string>,
  erros: ErroLinha[],
) {
  const existentes = await clientesPorDocumento(supabase, validas.map((v) => v.dados.cnpj))
  const inserir: Array<{ linha: number; row: Record<string, unknown> }> = []
  const atualizar: Array<{ linha: number; row: Record<string, unknown> }> = []
  for (const { linha, dados } of validas) {
    const row = { ...dados, cnpj: canonicalDocumento(dados.cnpj) }
    const id = existentes.get(dados.cnpj)
    if (id) atualizar.push({ linha, row: { id, ...pick(row, presentes, ["cnpj", "razao_social"]) } })
    else inserir.push({ linha, row })
  }
  return gravar(supabase, "clients", inserir, atualizar, erros)
}

async function importarPredios(
  supabase: Supa,
  validas: LinhaValida<PredioImport>[],
  presentes: Set<string>,
  erros: ErroLinha[],
) {
  const clientes = await clientesPorDocumento(supabase, validas.map((v) => v.dados.cliente_cnpj))
  const clientIds = [...new Set(clientes.values())]
  const predios = new Map<string, string>()
  for (const part of chunks(clientIds, CHUNK_LOOKUP)) {
    const { data, error } = await supabase.from("buildings").select("id, client_id, nome").in("client_id", part)
    if (error) throw error
    for (const b of (data ?? []) as Array<{ id: string; client_id: string; nome: string }>) {
      predios.set(`${b.client_id}|${b.nome.trim().toLowerCase()}`, b.id)
    }
  }

  const inserir: Array<{ linha: number; row: Record<string, unknown> }> = []
  const atualizar: Array<{ linha: number; row: Record<string, unknown> }> = []
  for (const { linha, dados } of validas) {
    const clientId = clientes.get(dados.cliente_cnpj)
    if (!clientId) {
      erros.push({ linha, campo: "cliente_cnpj", mensagem: "Cliente não encontrado — importe os clientes antes." })
      continue
    }
    const { cliente_cnpj: _doc, ...resto } = dados
    void _doc
    const row = { ...resto, client_id: clientId }
    const id = predios.get(`${clientId}|${dados.nome.toLowerCase()}`)
    if (id) atualizar.push({ linha, row: { id, ...pick(row, presentes, ["client_id", "nome"]) } })
    else inserir.push({ linha, row })
  }
  return gravar(supabase, "buildings", inserir, atualizar, erros)
}

async function importarEquipamentos(
  supabase: Supa,
  validas: LinhaValida<EquipamentoImport>[],
  presentes: Set<string>,
  erros: ErroLinha[],
) {
  const clientes = await clientesPorDocumento(supabase, validas.map((v) => v.dados.cliente_cnpj))
  const clientIds = [...new Set(clientes.values())]

  const predios = new Map<string, string>()
  for (const part of chunks(clientIds, CHUNK_LOOKUP)) {
    const { data, error } = await supabase.from("buildings").select("id, client_id, nome").in("client_id", part)
    if (error) throw error
    for (const b of (data ?? []) as Array<{ id: string; client_id: string; nome: string }>) {
      predios.set(`${b.client_id}|${b.nome.trim().toLowerCase()}`, b.id)
    }
  }

  // equipamentos já cadastrados nos prédios-alvo e/ou com as séries do lote
  type EqRow = { id: string; building_id: string; codigo_interno: string; numero_serie: string | null }
  const porSerie = new Map<string, EqRow>()
  const porCodigo = new Map<string, EqRow>()
  const guardar = (rows: EqRow[]) => {
    for (const e of rows) {
      if (e.numero_serie) porSerie.set(e.numero_serie.toLowerCase(), e)
      porCodigo.set(`${e.building_id}|${e.codigo_interno.toLowerCase()}`, e)
    }
  }
  for (const part of chunks([...new Set(predios.values())], CHUNK_LOOKUP)) {
    const { data, error } = await supabase
      .from("equipment")
      .select("id, building_id, codigo_interno, numero_serie")
      .in("building_id", part)
    if (error) throw error
    guardar((data ?? []) as EqRow[])
  }
  for (const part of chunks([...new Set(validas.map((v) => v.dados.numero_serie))], CHUNK_LOOKUP)) {
    const { data, error } = await supabase
      .from("equipment")
      .select("id, building_id, codigo_interno, numero_serie")
      .in("numero_serie", part)
    if (error) throw error
    guardar((data ?? []) as EqRow[])
  }

  const inserir: Array<{ linha: number; row: Record<string, unknown> }> = []
  const atualizar: Array<{ linha: number; row: Record<string, unknown> }> = []
  const codigosDoLote = new Map<string, number>()
  for (const { linha, dados } of validas) {
    const clientId = clientes.get(dados.cliente_cnpj)
    if (!clientId) {
      erros.push({ linha, campo: "cliente_cnpj", mensagem: "Cliente não encontrado — importe os clientes antes." })
      continue
    }
    const buildingId = predios.get(`${clientId}|${dados.predio_nome.toLowerCase()}`)
    if (!buildingId) {
      erros.push({ linha, campo: "predio_nome", mensagem: "Prédio não encontrado para este cliente — importe os prédios antes." })
      continue
    }
    const existente = porSerie.get(dados.numero_serie.toLowerCase())
    const codigo = presentes.has("codigo_interno") || !existente ? dados.codigo_interno : existente.codigo_interno
    const chaveCodigo = `${buildingId}|${codigo.toLowerCase()}`
    const dono = porCodigo.get(chaveCodigo)
    if ((dono && dono.id !== existente?.id) || codigosDoLote.has(chaveCodigo)) {
      erros.push({
        linha,
        campo: "codigo_interno",
        mensagem: `Código interno "${codigo}" já usado neste prédio${codigosDoLote.has(chaveCodigo) ? ` (linha ${codigosDoLote.get(chaveCodigo)})` : ""}.`,
      })
      continue
    }
    codigosDoLote.set(chaveCodigo, linha)

    const { cliente_cnpj: _c, predio_nome: _p, ...resto } = dados
    void _c
    void _p
    const row = { ...resto, codigo_interno: codigo, building_id: buildingId }
    if (existente) {
      atualizar.push({
        linha,
        row: { id: existente.id, ...pick(row, presentes, ["numero_serie", "building_id", "tipo", "codigo_interno"]) },
      })
    } else {
      inserir.push({ linha, row: { ...row, status: "operacional" } })
    }
  }
  return gravar(supabase, "equipment", inserir, atualizar, erros)
}

export async function importarLote(input: z.input<typeof loteSchema>): Promise<ImportarResultado> {
  const vazio = { inseridos: 0, atualizados: 0, erros: [] as ErroLinha[] }
  const auth = await authorizeAction("admin")
  if (auth.error !== null) return { ok: false, message: auth.error, ...vazio }

  // tamanho bruto do lote (defesa extra além do limite de corpo do Next)
  if (JSON.stringify(input ?? null).length > MAX_BYTES) {
    return { ok: false, message: "Lote acima de 2 MB — divida o arquivo.", ...vazio }
  }
  const parsed = loteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Lote inválido.", ...vazio }
  }

  const { entidade, linhas } = parsed.data
  const conhecidas = new Set(ENTIDADES[entidade].colunas.map((c) => c.nome))
  const presentes = new Set(parsed.data.colunas.filter((c) => conhecidas.has(c)))

  const validacao = validarLinhas(
    entidade,
    linhas.map((l) => l.valores),
    { numerosDeLinha: linhas.map((l) => l.linha) },
  )
  const erros = [...validacao.erros]

  if (isDemoMode) {
    return {
      ok: true,
      demo: true,
      message: `Modo demonstração — ${validacao.validas.length} linha(s) válidas, nada foi gravado.`,
      inseridos: 0,
      atualizados: 0,
      erros,
    }
  }
  if (validacao.validas.length === 0) {
    return { ok: false, message: "Nenhuma linha válida neste lote.", inseridos: 0, atualizados: 0, erros }
  }

  try {
    const supabase = await createSupabase()
    let res: { inseridos: number; atualizados: number }
    if (entidade === "clientes") {
      res = await importarClientes(supabase, validacao.validas as LinhaValida<ClienteImport>[], presentes, erros)
    } else if (entidade === "predios") {
      res = await importarPredios(supabase, validacao.validas as LinhaValida<PredioImport>[], presentes, erros)
    } else {
      res = await importarEquipamentos(supabase, validacao.validas as LinhaValida<EquipamentoImport>[], presentes, erros)
    }
    revalidatePath("/clientes")
    if (entidade !== "clientes") revalidatePath("/mapa")
    erros.sort((a, b) => a.linha - b.linha)
    return {
      ok: true,
      message: `${res.inseridos} inserido(s), ${res.atualizados} atualizado(s).`,
      ...res,
      erros,
    }
  } catch (error) {
    console.error("[actions/importar] importarLote:", error)
    return {
      ok: false,
      message: "Não foi possível concluir a importação. Nada além do já informado foi gravado — tente novamente.",
      inseridos: 0,
      atualizados: 0,
      erros,
    }
  }
}
