/**
 * Núcleo puro da importação CSV (cliente e servidor usam o mesmo código):
 * parse (papaparse), normalização de cabeçalhos, validação linha a linha,
 * modelos para download e escape contra CSV injection.
 *
 * Chaves naturais do upsert (documentadas na tela /importar):
 * - clientes:     cnpj (CPF ou CNPJ, comparado só pelos dígitos)
 * - prédios:      cliente_cnpj + nome do prédio (sem diferenciar maiúsculas)
 * - equipamentos: numero_serie
 */

import Papa from "papaparse"
import { z } from "zod"

import {
  buildingFields,
  clientSchema,
  equipmentFields,
  refineLatLng,
} from "../clientes/schemas"
import { isValidDocumento, onlyDigits } from "../clientes/validators"

export const MAX_LINHAS = 2000
export const MAX_BYTES = 2 * 1024 * 1024
/** Linhas por chamada da server action (abaixo do limite de 1 MB do corpo). */
export const LOTE_ENVIO = 400

export type Entidade = "clientes" | "predios" | "equipamentos"

export const ENTIDADES: Record<
  Entidade,
  { label: string; chave: string; colunas: ColunaDef[]; exemplo: string[][] }
> = {
  clientes: {
    label: "Clientes",
    chave: "cnpj (CPF ou CNPJ)",
    colunas: [
      { nome: "cnpj", obrigatoria: true, descricao: "CNPJ da empresa ou CPF da pessoa, com ou sem pontos e traços" },
      { nome: "razao_social", obrigatoria: true, descricao: "nome da empresa como está no CNPJ (ou nome completo, se for CPF)" },
      { nome: "nome_fantasia", obrigatoria: false, descricao: "nome pelo qual o cliente é conhecido, ex.: Shopping Estação" },
      { nome: "segmento", obrigatoria: false, descricao: "tipo de negócio, ex.: shopping, hospital, indústria" },
      { nome: "contato_nome", obrigatoria: false, descricao: "pessoa com quem a equipe fala no cliente" },
      { nome: "contato_email", obrigatoria: false, descricao: "e-mail dessa pessoa" },
      { nome: "contato_telefone", obrigatoria: false, descricao: "telefone com DDD, ex.: (41) 99999-9999" },
      { nome: "observacoes", obrigatoria: false, descricao: "qualquer anotação livre" },
    ],
    exemplo: [
      ["11.222.333/0001-81", "Condomínio Edifício Exemplo", "Ed. Exemplo", "condominio", "Maria Síndica", "sindico@exemplo.com.br", "(41) 3222-0000", ""],
    ],
  },
  predios: {
    label: "Prédios",
    chave: "cliente_cnpj + nome",
    colunas: [
      { nome: "cliente_cnpj", obrigatoria: true, descricao: "CNPJ ou CPF do cliente dono do prédio (o cliente precisa já estar cadastrado)" },
      { nome: "nome", obrigatoria: true, descricao: "nome do prédio ou unidade, ex.: Torre A" },
      { nome: "logradouro", obrigatoria: false, descricao: "rua ou avenida" },
      { nome: "numero", obrigatoria: false, descricao: "número do endereço" },
      { nome: "bairro", obrigatoria: false, descricao: "bairro" },
      { nome: "cidade", obrigatoria: false, descricao: "cidade; se ficar vazio, usamos Curitiba" },
      { nome: "uf", obrigatoria: false, descricao: "sigla do estado; se ficar vazio, usamos PR" },
      { nome: "cep", obrigatoria: false, descricao: "CEP no formato 00000-000" },
      { nome: "regiao", obrigatoria: false, descricao: "região da cidade para organizar rotas, ex.: centro, sul, cic" },
      { nome: "lat", obrigatoria: false, descricao: "latitude para o mapa, ex.: -25.4284 (pode deixar vazio)" },
      { nome: "lng", obrigatoria: false, descricao: "longitude para o mapa, ex.: -49.2733 (pode deixar vazio)" },
    ],
    exemplo: [
      ["11.222.333/0001-81", "Torre A", "Rua XV de Novembro", "1000", "Centro", "Curitiba", "PR", "80020-310", "centro", "-25.4284", "-49.2733"],
    ],
  },
  equipamentos: {
    label: "Equipamentos",
    chave: "numero_serie",
    colunas: [
      { nome: "numero_serie", obrigatoria: true, descricao: "número de série que vem na etiqueta do fabricante" },
      { nome: "cliente_cnpj", obrigatoria: true, descricao: "CNPJ ou CPF do cliente dono do equipamento" },
      { nome: "predio_nome", obrigatoria: true, descricao: "nome do prédio exatamente como foi cadastrado" },
      { nome: "tipo", obrigatoria: true, descricao: "um destes: split, vrf, chiller, self, janela" },
      { nome: "codigo_interno", obrigatoria: false, descricao: "código da etiqueta interna, ex.: 04-B7; se ficar vazio, usamos o número de série" },
      { nome: "marca", obrigatoria: false, descricao: "fabricante, ex.: Daikin" },
      { nome: "modelo", obrigatoria: false, descricao: "modelo do aparelho" },
      { nome: "capacidade_btu", obrigatoria: false, descricao: "capacidade em BTU, só números, ex.: 24000" },
      { nome: "ambiente", obrigatoria: false, descricao: "onde fica, ex.: sala de reunião 3" },
      { nome: "data_instalacao", obrigatoria: false, descricao: "data no formato dd/mm/aaaa" },
      { nome: "observacoes", obrigatoria: false, descricao: "qualquer anotação livre" },
    ],
    exemplo: [
      ["SN-2024-000123", "11.222.333/0001-81", "Torre A", "split", "04-B7", "Daikin", "Advance 18k", "18000", "Recepção", "15/03/2024", ""],
    ],
  },
}

export interface ColunaDef {
  nome: string
  obrigatoria: boolean
  descricao?: string
}

/** Aliases aceitos nos cabeçalhos → nome canônico. */
const ALIASES: Record<string, string> = {
  documento: "cnpj",
  cpf_cnpj: "cnpj",
  cnpj_cpf: "cnpj",
  cpf: "cnpj",
  razao: "razao_social",
  fantasia: "nome_fantasia",
  email: "contato_email",
  e_mail: "contato_email",
  telefone: "contato_telefone",
  contato: "contato_nome",
  cnpj_cliente: "cliente_cnpj",
  cliente: "cliente_cnpj",
  cliente_documento: "cliente_cnpj",
  predio: "predio_nome",
  nome_predio: "predio_nome",
  latitude: "lat",
  longitude: "lng",
  lon: "lng",
  serie: "numero_serie",
  n_serie: "numero_serie",
  num_serie: "numero_serie",
  numero_de_serie: "numero_serie",
  btu: "capacidade_btu",
  btus: "capacidade_btu",
  capacidade: "capacidade_btu",
  codigo: "codigo_interno",
  instalacao: "data_instalacao",
}

/** "Número de Série" → "numero_de_serie" → alias "numero_serie". */
export function normalizarCabecalho(header: string): string {
  const base = header
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return ALIASES[base] ?? base
}

export interface CsvParseado {
  cabecalhos: string[]
  linhas: Record<string, string>[]
  /** Erros estruturais do arquivo (aspas abertas, colunas a mais…). */
  erros: string[]
}

export function parseCsv(texto: string): CsvParseado {
  const result = Papa.parse<Record<string, string>>(texto.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizarCabecalho,
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  })
  const erros = result.errors
    .filter((e) => e.code !== "UndetectableDelimiter")
    .slice(0, 20)
    .map((e) => (e.row != null ? `Linha ${e.row + 2}: ${e.message}` : e.message))
  return {
    cabecalhos: (result.meta.fields ?? []).filter(Boolean),
    linhas: result.data,
    erros,
  }
}

// ---------------------------------------------------------------------------
// Schemas por entidade (reaproveitam os schemas dos formulários)
// ---------------------------------------------------------------------------

const documentoObrigatorio = (campo: string) =>
  z
    .string()
    .trim()
    .min(1, `Informe ${campo}.`)
    .refine(isValidDocumento, { message: "CPF/CNPJ inválido. Confira os dígitos." })
    .transform(onlyDigits)

const clienteImport = clientSchema
  .omit({ id: true, documento: true })
  .extend({ cnpj: documentoObrigatorio("o CNPJ/CPF") })

const predioImport = buildingFields
  .omit({ id: true, client_id: true })
  .extend({ cliente_cnpj: documentoObrigatorio("o CNPJ/CPF do cliente") })
  .superRefine(refineLatLng)

const TIPO_ALIASES: Record<string, string> = {
  split: "split",
  hi_wall: "split",
  piso_teto: "split",
  cassete: "split",
  k7: "split",
  vrf: "vrf",
  vrv: "vrf",
  chiller: "chiller",
  self: "self",
  self_contained: "self",
  selfcontained: "self",
  janela: "janela",
  acj: "janela",
}

const equipamentoImport = equipmentFields
  .omit({ id: true, building_id: true, numero_serie: true, codigo_interno: true, tipo: true })
  .extend({
    numero_serie: z.string().trim().min(1, "Informe o número de série.").max(60, "Número de série muito longo."),
    cliente_cnpj: documentoObrigatorio("o CNPJ/CPF do cliente"),
    predio_nome: z.string().trim().min(1, "Informe o nome do prédio.").max(120, "Nome do prédio muito longo."),
    tipo: z
      .string()
      .transform((v) => TIPO_ALIASES[normalizarCabecalho(v)] ?? v.trim().toLowerCase())
      .pipe(z.enum(["split", "vrf", "chiller", "self", "janela"], "Tipo inválido (split, vrf, chiller, self, janela).")),
    codigo_interno: z.string().trim().max(30, "Código interno muito longo."),
  })
  .transform((e) => ({ ...e, codigo_interno: e.codigo_interno || e.numero_serie.slice(0, 30) }))

export type ClienteImport = z.output<typeof clienteImport>
export type PredioImport = z.output<typeof predioImport>
export type EquipamentoImport = z.output<typeof equipamentoImport>

export interface DadosPor {
  clientes: ClienteImport
  predios: PredioImport
  equipamentos: EquipamentoImport
}

const SCHEMAS = {
  clientes: clienteImport,
  predios: predioImport,
  equipamentos: equipamentoImport,
} as const

export interface ErroLinha {
  /** Linha no arquivo (1 = cabeçalho). 0 = erro do arquivo inteiro. */
  linha: number
  campo: string
  mensagem: string
}

export interface LinhaValida<T> {
  linha: number
  dados: T
}

export interface ResultadoValidacao<T> {
  validas: LinhaValida<T>[]
  erros: ErroLinha[]
  colunasFaltando: string[]
  total: number
}

/** Chave natural de deduplicação dentro do arquivo. */
function chaveNatural(entidade: Entidade, dados: Record<string, unknown>): string {
  if (entidade === "clientes") return String(dados.cnpj)
  if (entidade === "predios") return `${dados.cliente_cnpj}|${String(dados.nome).toLowerCase()}`
  return String(dados.numero_serie).toLowerCase()
}

/** Linha com os campos esperados (string vazia para ausentes). */
function linhaCompleta(entidade: Entidade, raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const col of ENTIDADES[entidade].colunas) {
    const v = raw[col.nome]
    out[col.nome] = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim()
  }
  if (entidade === "predios") {
    if (!out.cidade) out.cidade = "Curitiba"
    if (!out.uf) out.uf = "PR"
  }
  return out
}

/**
 * Valida linha a linha. `primeiraLinha` é o número da 1ª linha de dados no
 * arquivo (2 quando há cabeçalho) — usado quando o servidor revalida um lote.
 */
export function validarLinhas<E extends Entidade>(
  entidade: E,
  linhas: Array<Record<string, unknown>>,
  opts: { cabecalhos?: string[]; numerosDeLinha?: number[] } = {},
): ResultadoValidacao<DadosPor[E]> {
  const def = ENTIDADES[entidade]
  const erros: ErroLinha[] = []
  const validas: LinhaValida<DadosPor[E]>[] = []

  const colunasFaltando = opts.cabecalhos
    ? def.colunas
        .filter((c) => c.obrigatoria && !opts.cabecalhos!.includes(c.nome))
        .map((c) => c.nome)
    : []
  if (colunasFaltando.length > 0) {
    erros.push({
      linha: 0,
      campo: colunasFaltando.join(", "),
      mensagem: `Colunas obrigatórias ausentes: ${colunasFaltando.join(", ")}.`,
    })
    return { validas, erros, colunasFaltando, total: linhas.length }
  }

  if (linhas.length > MAX_LINHAS) {
    erros.push({
      linha: 0,
      campo: "arquivo",
      mensagem: `O arquivo tem ${linhas.length} linhas; o limite é ${MAX_LINHAS} por importação.`,
    })
    return { validas, erros, colunasFaltando, total: linhas.length }
  }

  const vistas = new Map<string, number>()
  const schema = SCHEMAS[entidade]
  linhas.forEach((raw, i) => {
    const linha = opts.numerosDeLinha?.[i] ?? i + 2
    const parsed = schema.safeParse(linhaCompleta(entidade, raw))
    if (!parsed.success) {
      const porCampo = new Set<string>()
      for (const issue of parsed.error.issues) {
        const campo = String(issue.path[0] ?? "linha")
        if (porCampo.has(campo)) continue
        porCampo.add(campo)
        erros.push({ linha, campo, mensagem: issue.message })
      }
      return
    }
    const dados = parsed.data as Record<string, unknown>
    const chave = chaveNatural(entidade, dados)
    const anterior = vistas.get(chave)
    if (anterior !== undefined) {
      erros.push({
        linha,
        campo: entidade === "equipamentos" ? "numero_serie" : entidade === "clientes" ? "cnpj" : "nome",
        mensagem: `Duplicado no arquivo (mesma chave da linha ${anterior}).`,
      })
      return
    }
    vistas.set(chave, linha)
    validas.push({ linha, dados: parsed.data as DadosPor[E] })
  })

  return { validas, erros, colunasFaltando, total: linhas.length }
}

// ---------------------------------------------------------------------------
// Exportação segura (modelos e relatório de erros)
// ---------------------------------------------------------------------------

const NUMERO = /^-?\d+([.,]\d+)?$/

/**
 * Neutraliza CSV/formula injection: célula iniciada por = + - @ (ou tab/CR)
 * ganha um apóstrofo na frente — exceto números (ex.: latitude negativa).
 * Depois aplica as aspas do RFC 4180 quando necessário.
 */
export function escapeCsvCell(value: unknown, separador = ";"): string {
  let s = value == null ? "" : String(value)
  if (/^[=+\-@\t\r]/.test(s) && !NUMERO.test(s)) s = `'${s}`
  if (s.includes('"') || s.includes(separador) || s.includes("\n") || s.includes("\r")) {
    s = `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCsv(cabecalhos: string[], linhas: unknown[][], separador = ";"): string {
  const out = [cabecalhos, ...linhas].map((row) =>
    row.map((c) => escapeCsvCell(c, separador)).join(separador),
  )
  // BOM para o Excel pt-BR abrir acentos corretamente
  return `﻿${out.join("\r\n")}\r\n`
}

/** Modelo para download, gerado na hora (cabeçalho + 1 linha de exemplo). */
export function modeloCsv(entidade: Entidade): string {
  const def = ENTIDADES[entidade]
  return toCsv(
    def.colunas.map((c) => c.nome),
    def.exemplo,
  )
}

export function relatorioErrosCsv(erros: ErroLinha[]): string {
  return toCsv(
    ["linha", "campo", "erro"],
    erros.map((e) => [e.linha || "arquivo", e.campo, e.mensagem]),
  )
}
