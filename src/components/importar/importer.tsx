"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import {
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

const HEAD = "text-xs font-medium tracking-wider text-ink-faint uppercase"
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

  const errosTela = preview?.erros.slice(0, MAX_ERROS_TELA) ?? []
  const amostra = preview?.validas.slice(0, 10) ?? []
  const colunasAmostra = def.colunas.filter((c) => preview?.cabecalhos.includes(c.nome)).slice(0, 7)

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-line bg-console p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="radiogroup"
            aria-label="O que importar"
            className="flex flex-wrap gap-1 rounded-lg bg-console-2 p-1"
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
            {(Object.keys(ENTIDADES) as Entidade[]).map((e, i) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={entidade === e}
                tabIndex={entidade === e ? 0 : -1}
                disabled={enviando}
                onClick={() => trocarEntidade(e)}
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none max-md:min-h-11",
                  entidade === e ? "bg-signal-dim text-signal" : "text-ink-dim hover:text-ink",
                )}
              >
                <span className="font-mono text-xs text-ink-faint" aria-hidden="true">{i + 1}</span>
                {ENTIDADES[e].label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            className="h-9 px-3 max-md:h-11"
            onClick={() => baixar(`modelo-${entidade}.csv`, modeloCsv(entidade))}
          >
            <DownloadIcon aria-hidden="true" />
            Baixar modelo CSV
          </Button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-dim">
          Importe na ordem <strong className="text-ink">clientes → prédios → equipamentos</strong>.
          Chave de atualização: <span className="font-mono text-signal">{def.chave}</span>. Se já
          existir, o registro é atualizado (só as colunas presentes no arquivo); senão, é criado.
          Limite: {MAX_LINHAS.toLocaleString("pt-BR")} linhas e 2 MB por arquivo; separador ; ou ,.
        </p>
        <details className="mt-3 text-xs">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-ink-dim hover:text-ink md:min-h-0">
            O que vai em cada coluna
          </summary>
          <p className="mt-2 text-ink-dim">
            A primeira linha do arquivo traz o nome das colunas, escrito exatamente como abaixo.
            Colunas opcionais podem ficar de fora.
          </p>
          <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {def.colunas.map((c) => (
              <div key={c.nome} className="flex flex-col gap-0.5">
                <dt className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-ink">{c.nome}</span>
                  <span className={c.obrigatoria ? "text-amber" : "text-ink-faint"}>
                    {c.obrigatoria ? "obrigatória" : "opcional"}
                  </span>
                </dt>
                {c.descricao && <dd className="text-ink-dim">{c.descricao}</dd>}
              </div>
            ))}
          </dl>
        </details>
      </section>

      <section className="rounded-xl border border-dashed border-line bg-console/50 p-6 text-center">
        <FileSpreadsheetIcon className="mx-auto size-8 text-ink-faint" aria-hidden="true" />
        <label htmlFor="importar-arquivo" className="mt-3 block text-sm text-ink">
          Selecione o CSV de {def.label.toLowerCase()}
        </label>
        <input
          ref={inputRef}
          id="importar-arquivo"
          type="file"
          accept=".csv,text/csv,.txt"
          disabled={enviando || lendo}
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="mx-auto mt-3 block w-full max-w-sm text-sm text-ink-dim file:mr-3 file:rounded-md file:border-0 file:bg-console-2 file:px-3 file:py-2 file:text-ink hover:file:bg-console-3"
        />
        {lendo && (
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-ink-dim">
            <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
            Validando linhas…
          </p>
        )}
      </section>

      {preview && (
        <section aria-label="Pré-visualização" className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <Resumo label="Linhas no arquivo" valor={preview.total} />
            <Resumo label="Válidas" valor={preview.validas.length} tom="clear" />
            <Resumo label="Com erro" valor={new Set(preview.erros.map((e) => e.linha)).size} tom={preview.erros.length ? "danger" : undefined} />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {preview.erros.length > 0 && (
              <Button
                variant="outline"
                className="h-9 px-3 max-md:h-11"
                onClick={() => baixar(`erros-${entidade}.csv`, relatorioErrosCsv(preview.erros))}
              >
                <DownloadIcon aria-hidden="true" />
                Relatório de erros
              </Button>
            )}
            <Button
              className="h-9 px-4 max-md:h-11"
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
                ? `Importando ${progresso.feito}/${progresso.total}…`
                : `Importar ${preview.validas.length} linha(s) válida(s)`}
            </Button>
          </div>

          {errosTela.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-line bg-console">
              <h3 className="flex items-center gap-2 border-b border-line-soft px-4 py-3 text-sm font-medium text-ink">
                <CircleAlertIcon className="size-4 text-danger" aria-hidden="true" />
                Erros encontrados
                {preview.erros.length > MAX_ERROS_TELA && (
                  <span className="text-xs text-ink-faint">
                    (mostrando {MAX_ERROS_TELA} de {preview.erros.length}, baixe o relatório)
                  </span>
                )}
              </h3>
              <div className="max-h-80 overflow-y-auto">
                <Table aria-label="Erros por linha">
                  <TableHeader>
                    <TableRow className="border-line-soft hover:bg-transparent">
                      <TableHead className={cn(HEAD, "w-20 px-4")}>Linha</TableHead>
                      <TableHead className={cn(HEAD, "w-40")}>Campo</TableHead>
                      <TableHead className={HEAD}>Problema</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errosTela.map((e, i) => (
                      <TableRow key={`${e.linha}-${e.campo}-${i}`} className="border-line-soft">
                        <TableCell className="px-4 py-2 font-mono text-ink">{e.linha || "—"}</TableCell>
                        <TableCell className="py-2 font-mono text-xs text-ink-dim">{e.campo}</TableCell>
                        <TableCell className="py-2 text-sm whitespace-normal text-ink-dim">{e.mensagem}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {amostra.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-line bg-console">
              <h3 className="border-b border-line-soft px-4 py-3 text-sm font-medium text-ink">
                Amostra das linhas válidas
              </h3>
              <div className="overflow-x-auto">
                <Table aria-label="Amostra das linhas válidas">
                  <TableHeader>
                    <TableRow className="border-line-soft hover:bg-transparent">
                      <TableHead className={cn(HEAD, "px-4")}>Linha</TableHead>
                      {colunasAmostra.map((c) => (
                        <TableHead key={c.nome} className={HEAD}>
                          {c.nome}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {amostra.map((l) => (
                      <TableRow key={l.linha} className="border-line-soft">
                        <TableCell className="px-4 py-2 font-mono text-ink-faint">{l.linha}</TableCell>
                        {colunasAmostra.map((c) => (
                          <TableCell key={c.nome} className="max-w-48 truncate py-2 text-ink-dim">
                            {l.valores[c.nome] || "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </section>
      )}

      {resultado && (
        <section
          aria-live="polite"
          className="flex flex-col gap-2 rounded-xl border border-line bg-console p-4"
        >
          <h3 className="flex items-center gap-2 text-sm font-medium text-ink">
            <CircleCheckIcon className="size-4 text-clear" aria-hidden="true" />
            {resultado.demo ? "Validação concluída (modo demonstração)" : "Importação concluída"}
          </h3>
          <p className="text-sm text-ink-dim">
            {resultado.demo
              ? "O servidor revalidou as linhas; nada foi gravado porque o banco não está conectado."
              : `${resultado.inseridos} inserido(s), ${resultado.atualizados} atualizado(s), ${resultado.erros.length} erro(s) na gravação.`}
          </p>
          {resultado.erros.length > 0 && (
            <Button
              variant="outline"
              className="h-9 w-fit px-3 max-md:h-11"
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
            <DialogTitle>Confirmar importação</DialogTitle>
            <DialogDescription>
              {preview?.validas.length ?? 0} linha(s) de {def.label.toLowerCase()} serão gravadas
              (criadas ou atualizadas pela chave {def.chave}).
              {preview && preview.erros.length > 0 && " Linhas com erro serão ignoradas."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(false)} className="max-md:h-11">
              Cancelar
            </Button>
            <Button onClick={importar} disabled={enviando} className="max-md:h-11">
              Importar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Resumo({ label, valor, tom }: { label: string; valor: number; tom?: "clear" | "danger" }) {
  return (
    <div className="rounded-xl border border-line bg-console px-4 py-3">
      <p className="text-xs font-medium tracking-wider text-ink-faint uppercase">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-2xl text-ink tabular-nums",
          tom === "clear" && "text-clear",
          tom === "danger" && "text-danger",
        )}
      >
        {valor.toLocaleString("pt-BR")}
      </p>
    </div>
  )
}
