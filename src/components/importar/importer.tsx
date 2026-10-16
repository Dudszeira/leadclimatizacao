"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import {
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  LoaderCircleIcon,
  UploadIcon,
} from "lucide-react"
import { toast } from "sonner"

import { importarLote } from "@/server/actions/importar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ENTIDADES,
  LOTE_ENVIO,
  MAX_BYTES,
  MAX_LINHAS,
  modeloCsv,
  parseCsv,
  relatorioErrosCsv,
  validarLinhas,
  type Entidade,
  type ErroLinha,
} from "./csv"

type Preview = {
  arquivo: string
  cabecalhos: string[]
  total: number
  validas: Array<{ linha: number; valores: Record<string, string> }>
  erros: ErroLinha[]
}

type Resultado = {
  inseridos: number
  atualizados: number
  erros: ErroLinha[]
  demo: boolean
  mensagem: string
}

const MAX_ERROS_TELA = 200

function baixar(nome: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Lê o arquivo como UTF-8; se vier do Excel em Windows-1252, decodifica de novo. */
async function lerTexto(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder("utf-8").decode(buffer)
  if (!utf8.includes("�")) return utf8
  return new TextDecoder("windows-1252").decode(buffer)
}

export function Importer() {
  const router = useRouter()
  const [entidade, setEntidade] = React.useState<Entidade>("clientes")
  const [preview, setPreview] = React.useState<Preview | null>(null)
  const [lendo, setLendo] = React.useState(false)
  const [enviando, setEnviando] = React.useState(false)
  const [progresso, setProgresso] = React.useState({ feito: 0, total: 0 })
  const [resultado, setResultado] = React.useState<Resultado | null>(null)
  const [confirmar, setConfirmar] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const def = ENTIDADES[entidade]

  function trocarEntidade(e: Entidade) {
    if (enviando) return
    setEntidade(e)
    setPreview(null)
    setResultado(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function handleFile(file: File | undefined) {
    setPreview(null)
    setResultado(null)
    if (!file) return
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo acima de 2 MB. Divida em partes menores.")
      return
    }
    if (!/\.(csv|txt)$/i.test(file.name)) {
      toast.error("Envie um arquivo .csv (no Excel: Salvar como › CSV).")
      return
    }
    setLendo(true)
    try {
      const texto = await lerTexto(file)
      const { cabecalhos, linhas, erros: errosArquivo } = parseCsv(texto)
      const validacao = validarLinhas(entidade, linhas, { cabecalhos })
      const conhecidas = new Set(def.colunas.map((c) => c.nome))
      const porLinha = new Map(linhas.map((l, i) => [i + 2, l]))
      setPreview({
        arquivo: file.name,
        cabecalhos,
        total: linhas.length,
        validas: validacao.validas.map((v) => {
          const raw = porLinha.get(v.linha) ?? {}
          const valores: Record<string, string> = {}
          for (const [k, val] of Object.entries(raw)) {
            if (conhecidas.has(k) && typeof val === "string") valores[k] = val
          }
          return { linha: v.linha, valores }
        }),
        erros: [
          ...errosArquivo.map((m) => ({ linha: 0, campo: "arquivo", mensagem: m })),
          ...validacao.erros,
        ],
      })
    } catch {
      toast.error("Não foi possível ler o arquivo. Confira se é um CSV válido.")
    } finally {
      setLendo(false)
    }
  }

  async function importar() {
    if (!preview || preview.validas.length === 0) return
    setConfirmar(false)
    setEnviando(true)
    setResultado(null)
    const lotes: Preview["validas"][] = []
    for (let i = 0; i < preview.validas.length; i += LOTE_ENVIO) {
      lotes.push(preview.validas.slice(i, i + LOTE_ENVIO))
    }
    setProgresso({ feito: 0, total: preview.validas.length })
    const acc: Resultado = { inseridos: 0, atualizados: 0, erros: [], demo: false, mensagem: "" }
    try {
      for (const lote of lotes) {
        const r = await importarLote({ entidade, colunas: preview.cabecalhos, linhas: lote })
        acc.inseridos += r.inseridos
        acc.atualizados += r.atualizados
        acc.erros.push(...r.erros)
        acc.demo = acc.demo || Boolean(r.demo)
        acc.mensagem = r.message
        if (!r.ok && r.erros.length === 0) {
          // falha do lote inteiro (permissão, sessão, banco)
          acc.erros.push(...lote.map((l) => ({ linha: l.linha, campo: "lote", mensagem: r.message })))
          toast.error(r.message)
          if (/permiss|Sessão/i.test(r.message)) break
        }
        setProgresso((p) => ({ ...p, feito: p.feito + lote.length }))
      }
    } catch {
      toast.error("Conexão interrompida. Reenvie o arquivo (a importação é idempotente).")
    } finally {
      acc.erros.sort((a, b) => a.linha - b.linha)
      setResultado(acc)
      setEnviando(false)
      if (acc.demo) toast.info("Modo demonstração: validado no servidor, nada foi gravado.")
      else if (acc.inseridos + acc.atualizados > 0) {
        toast.success(`${acc.inseridos} inserido(s), ${acc.atualizados} atualizado(s).`)
        router.refresh()
      }
    }
  }

  const [arrastando, setArrastando] = React.useState(false)
  const errosTela = preview?.erros.slice(0, MAX_ERROS_TELA) ?? []
  const amostra = preview?.validas.slice(0, 10) ?? []
  const colunasAmostra = def.colunas.filter((c) => preview?.cabecalhos.includes(c.nome)).slice(0, 7)
  const linhasComErro = preview ? new Set(preview.erros.map((e) => e.linha)).size : 0
  const etapa = resultado ? 3 : preview ? 2 : 1
  const bloqueado = enviando || lendo

  return (
    <div className="flex min-w-0 flex-col gap-6 md:gap-8">
      <Etapas atual={etapa} />

      {/* 1. Tipo de cadastro + arquivo */}
      <section aria-labelledby="importar-passo-1" className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2
            id="importar-passo-1"
            className="font-heading text-[1.0625rem] font-medium tracking-[-0.01em] text-ink"
          >
            O que você vai importar
          </h2>
          <Button
            variant="outline"
            onClick={() => baixar(`modelo-${entidade}.csv`, modeloCsv(entidade))}
          >
            <DownloadIcon aria-hidden="true" />
            Baixar modelo de {def.label.toLowerCase()}
          </Button>
        </div>

        <div
          role="radiogroup"
          aria-label="O que importar"
          className="flex h-11 w-full gap-1 rounded-full bg-console-2 p-1 md:h-10 md:w-fit"
          onKeyDown={(ev) => {
            // Setas trocam a opção (padrão de radiogroup); Tab sai do grupo.
            const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"]
            if (!keys.includes(ev.key) || enviando) return
            ev.preventDefault()
            const lista = Object.keys(ENTIDADES) as Entidade[]
            const atual = lista.indexOf(entidade)
            const alvo =
              ev.key === "Home"
                ? 0
                : ev.key === "End"
                  ? lista.length - 1
                  : ev.key === "ArrowRight" || ev.key === "ArrowDown"
                    ? (atual + 1) % lista.length
                    : (atual - 1 + lista.length) % lista.length
            trocarEntidade(lista[alvo])
            const botoes = ev.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')
            botoes[alvo]?.focus()
          }}
        >
          {(Object.keys(ENTIDADES) as Entidade[]).map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={entidade === e}
              tabIndex={entidade === e ? 0 : -1}
              disabled={enviando}
              onClick={() => trocarEntidade(e)}
              className={cn(
                "inline-flex flex-1 items-center justify-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-signal/50 disabled:opacity-50 md:flex-none",
                entidade === e ? "bg-ink text-void" : "text-ink-dim hover:text-ink",
              )}
            >
              {ENTIDADES[e].label}
            </button>
          ))}
        </div>

        <p className="max-w-[72ch] text-sm leading-relaxed text-ink-dim">
          Importe nesta ordem: clientes, depois prédios, depois equipamentos. Quem
          já está cadastrado é reconhecido pela chave{" "}
          <span className="font-medium text-ink">{def.chave}</span> e só tem
          atualizadas as colunas presentes no arquivo; o resto é criado. Até{" "}
          {MAX_LINHAS.toLocaleString("pt-BR")} linhas e 2 MB por arquivo, separado por ; ou ,.
        </p>

        <label
          htmlFor="importar-arquivo"
          onDragOver={(ev) => {
            if (bloqueado) return
            ev.preventDefault()
            setArrastando(true)
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(ev) => {
            ev.preventDefault()
            setArrastando(false)
            if (bloqueado) return
            handleFile(ev.dataTransfer.files?.[0])
          }}
          className={cn(
            "group flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-[1.375rem] border border-dashed px-6 py-8 text-center transition-colors duration-150 focus-within:border-signal/70 focus-within:ring-3 focus-within:ring-signal/20 md:min-h-52",
            arrastando
              ? "border-signal/70 bg-signal-dim"
              : "border-line bg-console hover:border-[#3a3a3a] hover:bg-console-2/60",
            bloqueado && "pointer-events-none opacity-60",
          )}
        >
          <span
            className="flex size-12 items-center justify-center rounded-full bg-console-2 transition-colors group-hover:bg-console-3"
            aria-hidden="true"
          >
            {lendo ? (
              <LoaderCircleIcon className="size-5 animate-spin text-ink-dim" />
            ) : (
              <FileSpreadsheetIcon className="size-5 text-ink-dim" />
            )}
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-[0.9375rem] font-medium text-ink">
              {lendo
                ? "Validando linhas…"
                : preview
                  ? preview.arquivo
                  : `Escolher o CSV de ${def.label.toLowerCase()}`}
            </span>
            <span className="text-[0.8125rem] text-ink-faint">
              {preview ? (
                "Toque para trocar de arquivo"
              ) : (
                <>
                  <span className="md:hidden">Toque para escolher o arquivo</span>
                  <span className="max-md:hidden">Clique para escolher, ou arraste o arquivo para cá</span>
                </>
              )}
            </span>
          </span>
          <input
            ref={inputRef}
            id="importar-arquivo"
            type="file"
            accept=".csv,text/csv,.txt"
            disabled={bloqueado}
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="sr-only"
          />
        </label>

        <details className="group/det rounded-[1.375rem] bg-console ring-1 ring-line">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium text-ink md:px-5 [&::-webkit-details-marker]:hidden">
            O que vai em cada coluna
            <span className="text-[0.8125rem] font-normal text-ink-faint group-open/det:hidden">
              Ver colunas
            </span>
            <span className="hidden text-[0.8125rem] font-normal text-ink-faint group-open/det:inline">
              Fechar
            </span>
          </summary>
          <div className="border-t border-line-soft px-4 pt-3 pb-4 md:px-5">
            <p className="text-[0.8125rem] leading-relaxed text-ink-dim">
              A primeira linha do arquivo traz o nome das colunas, escrito exatamente
              como abaixo. As opcionais podem ficar de fora.
            </p>
            <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {def.colunas.map((c) => (
                <div key={c.nome} className="flex min-w-0 flex-col gap-0.5">
                  <dt className="flex flex-wrap items-center gap-2">
                    <span className="font-medium break-all text-ink">{c.nome}</span>
                    <span
                      className={cn(
                        "inline-flex h-5 items-center rounded-full px-2 text-xs",
                        c.obrigatoria ? "bg-amber-dim text-amber" : "bg-console-2 text-ink-faint",
                      )}
                    >
                      {c.obrigatoria ? "Obrigatória" : "Opcional"}
                    </span>
                  </dt>
                  {c.descricao && (
                    <dd className="text-[0.8125rem] leading-snug text-ink-dim">
                      {c.descricao.charAt(0).toUpperCase() + c.descricao.slice(1)}
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          </div>
        </details>
      </section>

      {/* 2. Conferência */}
      {preview && (
        <section aria-labelledby="importar-passo-2" className="flex min-w-0 flex-col gap-4">
          <h2
            id="importar-passo-2"
            className="font-heading text-[1.0625rem] font-medium tracking-[-0.01em] text-ink"
          >
            Confira antes de gravar
          </h2>

          <dl className="grid grid-cols-3 divide-x divide-line-soft rounded-[1.375rem] bg-console py-4 ring-1 ring-line md:py-5">
            <Resumo label="No arquivo" valor={preview.total} />
            <Resumo label="Prontas" valor={preview.validas.length} tom="clear" />
            <Resumo
              label="Com erro"
              valor={linhasComErro}
              tom={preview.erros.length ? "danger" : undefined}
            />
          </dl>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
            {preview.erros.length > 0 && (
              <Button
                variant="outline"
                onClick={() => baixar(`erros-${entidade}.csv`, relatorioErrosCsv(preview.erros))}
              >
                <DownloadIcon aria-hidden="true" />
                Baixar relatório de erros
              </Button>
            )}
            <Button
              size="lg"
              disabled={enviando || preview.validas.length === 0}
              aria-busy={enviando}
              onClick={() => setConfirmar(true)}
            >
              {enviando ? (
                <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
              ) : (
                <UploadIcon aria-hidden="true" />
              )}
              {enviando
                ? `Importando ${progresso.feito} de ${progresso.total}…`
                : preview.validas.length === 1
                  ? "Importar 1 linha"
                  : `Importar ${preview.validas.length.toLocaleString("pt-BR")} linhas`}
            </Button>
          </div>

          {errosTela.length > 0 && (
            <div className="overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line-soft px-4 py-3.5 md:px-5">
                <CircleAlertIcon className="size-4 text-danger" aria-hidden="true" />
                <h3 className="text-sm font-medium text-ink">Linhas com problema</h3>
                {preview.erros.length > MAX_ERROS_TELA && (
                  <span className="text-[0.8125rem] text-ink-faint">
                    Mostrando {MAX_ERROS_TELA} de {preview.erros.length}; baixe o relatório para ver todas.
                  </span>
                )}
              </div>
              <ul aria-label="Erros por linha" className="scroll-contain max-h-96 divide-y divide-line-soft overflow-y-auto">
                {errosTela.map((e, i) => (
                  <li
                    key={`${e.linha}-${e.campo}-${i}`}
                    className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-baseline md:gap-4 md:px-5"
                  >
                    <span className="flex shrink-0 items-center gap-2 text-[0.8125rem] md:w-56">
                      <span className="font-medium text-ink tabular-nums">
                        {e.linha ? `Linha ${e.linha}` : "Arquivo"}
                      </span>
                      <span className="min-w-0 truncate text-ink-faint">{e.campo}</span>
                    </span>
                    <span className="text-sm leading-snug text-ink-dim">{e.mensagem}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {amostra.length > 0 && (
            <div className="min-w-0 overflow-hidden rounded-[1.375rem] bg-console ring-1 ring-line">
              <div className="flex items-baseline justify-between gap-3 border-b border-line-soft px-4 py-3.5 md:px-5">
                <h3 className="text-sm font-medium text-ink">Amostra das linhas prontas</h3>
                <span className="shrink-0 text-[0.8125rem] text-ink-faint md:hidden">Deslize para o lado</span>
              </div>
              <Table aria-label="Amostra das linhas prontas">
                <TableHeader>
                  <TableRow>
                    <TableHead>Linha</TableHead>
                    {colunasAmostra.map((c) => (
                      <TableHead key={c.nome}>{c.nome}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {amostra.map((l) => (
                    <TableRow key={l.linha}>
                      <TableCell className="text-ink-faint tabular-nums">{l.linha}</TableCell>
                      {colunasAmostra.map((c) => (
                        <TableCell key={c.nome} className="max-w-56 truncate text-ink-dim">
                          {l.valores[c.nome] || <span className="text-ink-faint">Vazio</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}

      {/* 3. Resultado */}
      {resultado && (
        <section
          aria-live="polite"
          aria-labelledby="importar-passo-3"
          className="flex flex-col gap-4 rounded-[1.375rem] bg-console p-4 ring-1 ring-line md:p-5"
        >
          <div className="flex items-start gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-clear-dim"
              aria-hidden="true"
            >
              <CircleCheckIcon className="size-5 text-clear" />
            </span>
            <div className="min-w-0 space-y-1">
              <h2
                id="importar-passo-3"
                className="font-heading text-[1.0625rem] font-medium tracking-[-0.01em] text-ink"
              >
                {resultado.demo ? "Validação concluída" : "Importação concluída"}
              </h2>
              <p className="text-sm leading-relaxed text-ink-dim">
                {resultado.demo
                  ? "Modo demonstração: o servidor conferiu as linhas, mas nada foi gravado porque o banco não está conectado."
                  : "Os registros já aparecem nas telas de cadastro."}
              </p>
            </div>
          </div>
          {!resultado.demo && (
            <dl className="grid grid-cols-3 divide-x divide-line-soft rounded-2xl bg-console-2/60 py-3.5">
              <Resumo label="Criados" valor={resultado.inseridos} />
              <Resumo label="Atualizados" valor={resultado.atualizados} />
              <Resumo
                label="Não gravados"
                valor={resultado.erros.length}
                tom={resultado.erros.length ? "danger" : undefined}
              />
            </dl>
          )}
          {resultado.erros.length > 0 && (
            <Button
              variant="outline"
              className="md:w-fit"
              onClick={() => baixar(`erros-importacao-${entidade}.csv`, relatorioErrosCsv(resultado.erros))}
            >
              <DownloadIcon aria-hidden="true" />
              Baixar erros da gravação
            </Button>
          )}
        </section>
      )}

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Importar {def.label.toLowerCase()}?</DialogTitle>
            <DialogDescription>
              {(preview?.validas.length ?? 0).toLocaleString("pt-BR")} linha(s) serão
              gravadas, criadas ou atualizadas pela chave {def.chave}.
              {preview && preview.erros.length > 0 && " As linhas com erro ficam de fora."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(false)}>
              Cancelar
            </Button>
            <Button onClick={importar} disabled={enviando}>
              Importar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const ETAPAS = ["Arquivo", "Conferir", "Importar"] as const

/** Indicador de etapas: concluída (check), atual (branca), próxima (apagada). */
function Etapas({ atual }: { atual: number }) {
  return (
    <ol aria-label="Etapas da importação" className="flex items-center gap-2">
      {ETAPAS.map((nome, i) => {
        const n = i + 1
        const feita = n < atual
        const ativa = n === atual
        return (
          <li
            key={nome}
            aria-current={ativa ? "step" : undefined}
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-[0.8125rem] font-medium tabular-nums",
                ativa && "bg-ink text-void",
                feita && "bg-clear-dim text-clear",
                !ativa && !feita && "bg-console-2 text-ink-faint",
              )}
            >
              {feita ? <CheckIcon className="size-3.5" aria-hidden="true" /> : n}
              {feita ? <span className="sr-only">{n}, concluída</span> : null}
            </span>
            <span
              className={cn(
                "truncate text-[0.8125rem] md:text-sm",
                ativa ? "font-medium text-ink" : "text-ink-dim",
              )}
            >
              {nome}
            </span>
            {n < ETAPAS.length ? (
              <span className="hidden h-px min-w-4 flex-1 bg-line sm:block" aria-hidden="true" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function Resumo({ label, valor, tom }: { label: string; valor: number; tom?: "clear" | "danger" }) {
  return (
    <div className="flex min-w-0 flex-col-reverse gap-2 px-4 md:px-5">
      <dt className="truncate text-[0.8125rem] text-ink-dim">{label}</dt>
      <dd
        className={cn(
          "font-display text-[1.625rem] leading-none font-medium tracking-[-0.03em] text-ink tabular-nums md:text-[2rem]",
          tom === "clear" && "text-clear",
          tom === "danger" && "text-danger",
        )}
      >
        {valor.toLocaleString("pt-BR")}
      </dd>
    </div>
  )
}
