import { describe, expect, it } from "vitest"

import {
  MAX_LINHAS,
  escapeCsvCell,
  modeloCsv,
  normalizarCabecalho,
  parseCsv,
  relatorioErrosCsv,
  validarLinhas,
} from "../../src/components/importar/csv"

describe("parser CSV", () => {
  it("detecta ; e normaliza cabeçalhos com acento/alias", () => {
    const csv = "﻿CNPJ;Razão Social;E-mail\n11.222.333/0001-81;Empresa X;a@b.com\n"
    const p = parseCsv(csv)
    expect(p.cabecalhos).toEqual(["cnpj", "razao_social", "contato_email"])
    expect(p.linhas[0].razao_social).toBe("Empresa X")
  })
  it("aceita vírgula e ignora linhas vazias", () => {
    const p = parseCsv("numero_serie,tipo\nSN1,split\n\n,\n")
    expect(p.linhas).toHaveLength(1)
  })
  it("aliases", () => {
    expect(normalizarCabecalho("Número de Série")).toBe("numero_serie")
    expect(normalizarCabecalho("BTUs")).toBe("capacidade_btu")
    expect(normalizarCabecalho("Latitude")).toBe("lat")
  })
})

describe("validação de clientes", () => {
  it("aponta linha e campo de cada erro e deduplica por documento", () => {
    const { cabecalhos, linhas } = parseCsv(
      [
        "cnpj;razao_social;contato_email",
        "11.222.333/0001-81;Empresa Boa;ok@empresa.com",
        "11.222.333/0001-82;Empresa CNPJ Ruim;",
        "529.982.247-25;;",
        "11222333000181;Duplicada;",
        "52998224725;Pessoa Física;email-ruim",
      ].join("\n"),
    )
    const r = validarLinhas("clientes", linhas, { cabecalhos })
    expect(r.validas.map((v) => v.linha)).toEqual([2])
    expect(r.validas[0].dados.cnpj).toBe("11222333000181")
    expect(r.erros).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ linha: 3, campo: "cnpj" }),
        expect.objectContaining({ linha: 4, campo: "razao_social" }),
        expect.objectContaining({ linha: 5, campo: "cnpj", mensagem: expect.stringContaining("linha 2") }),
        expect.objectContaining({ linha: 6, campo: "contato_email" }),
      ]),
    )
  })
  it("coluna obrigatória ausente bloqueia o arquivo", () => {
    const { cabecalhos, linhas } = parseCsv("razao_social\nEmpresa\n")
    const r = validarLinhas("clientes", linhas, { cabecalhos })
    expect(r.colunasFaltando).toEqual(["cnpj"])
    expect(r.validas).toHaveLength(0)
    expect(r.erros[0].linha).toBe(0)
  })
  it("respeita o limite de linhas", () => {
    const linhas = Array.from({ length: MAX_LINHAS + 1 }, () => ({ cnpj: "11222333000181", razao_social: "X Ltda" }))
    const r = validarLinhas("clientes", linhas)
    expect(r.validas).toHaveLength(0)
    expect(r.erros[0].mensagem).toContain(String(MAX_LINHAS))
  })
})

describe("validação de prédios e equipamentos", () => {
  it("prédio: CEP inválido, padrão Curitiba/PR", () => {
    const r = validarLinhas("predios", [
      { cliente_cnpj: "11222333000181", nome: "Torre A", cep: "80020-310" },
      { cliente_cnpj: "11222333000181", nome: "Torre B", cep: "800" },
      { cliente_cnpj: "11222333000181", nome: "torre a" },
    ])
    expect(r.validas).toHaveLength(1)
    expect(r.validas[0].dados).toMatchObject({ cidade: "Curitiba", uf: "PR", cep: "80020-310" })
    expect(r.erros.map((e) => [e.linha, e.campo])).toEqual([
      [3, "cep"],
      [4, "nome"],
    ])
  })
  it("equipamento: tipo por alias, código padrão = série, série obrigatória", () => {
    const r = validarLinhas("equipamentos", [
      { numero_serie: "SN-1", cliente_cnpj: "11222333000181", predio_nome: "Torre A", tipo: "Self Contained", capacidade_btu: "120.000" },
      { numero_serie: "", cliente_cnpj: "11222333000181", predio_nome: "Torre A", tipo: "split" },
      { numero_serie: "SN-2", cliente_cnpj: "11222333000181", predio_nome: "Torre A", tipo: "geladeira" },
    ])
    expect(r.validas).toHaveLength(1)
    expect(r.validas[0].dados).toMatchObject({ tipo: "self", codigo_interno: "SN-1", capacidade_btu: 120000 })
    expect(r.erros.map((e) => [e.linha, e.campo])).toEqual([
      [3, "numero_serie"],
      [4, "tipo"],
    ])
  })
})

describe("CSV injection e modelos", () => {
  it("prefixa fórmulas, preserva números negativos e aplica aspas", () => {
    expect(escapeCsvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`)
    expect(escapeCsvCell("+5511")).toBe("'+5511")
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)")
    expect(escapeCsvCell("-cmd")).toBe("'-cmd")
    expect(escapeCsvCell("-25.4284")).toBe("-25.4284")
    expect(escapeCsvCell("a;b")).toBe('"a;b"')
  })
  it("modelo gerado na hora é reimportável sem erros", () => {
    for (const ent of ["clientes", "predios", "equipamentos"] as const) {
      const { cabecalhos, linhas } = parseCsv(modeloCsv(ent))
      const r = validarLinhas(ent, linhas, { cabecalhos })
      expect(r.erros, ent).toEqual([])
      expect(r.validas).toHaveLength(1)
    }
  })
  it("relatório de erros escapa mensagens", () => {
    const csv = relatorioErrosCsv([{ linha: 2, campo: "x", mensagem: "=1+1" }])
    expect(csv).toContain("'=1+1")
  })
})
