import { describe, expect, it } from "vitest"

import {
  buildingSchema,
  clientSchema,
  equipmentSchema,
  leadSchema,
  pmocPlanSchema,
} from "../../src/components/clientes/schemas"
import {
  canonicalDocumento,
  isValidCep,
  isValidCnpj,
  isValidCpf,
  isValidDocumento,
  maskCep,
  maskCpf,
  maskDocumento,
  parseDateBR,
  parseDecimalBR,
  parseIntBR,
} from "../../src/components/clientes/validators"
import {
  addDias,
  diffDias,
  hojeBrt,
  situacaoPlano,
  situacaoPorDias,
} from "../../src/components/pmoc/situacao"

describe("validadores de documento", () => {
  it("CNPJ válido com e sem máscara", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true)
    expect(isValidCnpj("11222333000181")).toBe(true)
  })
  it("CNPJ inválido: dígito errado, repetido, tamanho", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false)
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false)
    expect(isValidCnpj("1122233300018")).toBe(false)
  })
  it("CPF válido e inválido", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true)
    expect(isValidCpf("52998224725")).toBe(true)
    expect(isValidCpf("529.982.247-26")).toBe(false)
    expect(isValidCpf("111.111.111-11")).toBe(false)
    expect(isValidCpf("123")).toBe(false)
  })
  it("documento aceita CPF ou CNPJ e canoniza com máscara", () => {
    expect(isValidDocumento("529.982.247-25")).toBe(true)
    expect(isValidDocumento("11222333000181")).toBe(true)
    expect(isValidDocumento("5299822472")).toBe(false)
    expect(canonicalDocumento("52998224725")).toBe("529.982.247-25")
    expect(canonicalDocumento("11222333000181")).toBe("11.222.333/0001-81")
  })
  it("máscaras progressivas", () => {
    expect(maskCpf("5299822")).toBe("529.982.2")
    expect(maskDocumento("529982247251")).toBe("52.998.224/7251")
    expect(maskCep("80020310")).toBe("80020-310")
    expect(maskCep("800")).toBe("800")
  })
})

describe("CEP", () => {
  it("aceita 8 dígitos com ou sem hífen", () => {
    expect(isValidCep("80020-310")).toBe(true)
    expect(isValidCep("80020310")).toBe(true)
  })
  it("rejeita tamanho errado ou letras", () => {
    expect(isValidCep("8002-310")).toBe(false)
    expect(isValidCep("80020-31a")).toBe(false)
    expect(isValidCep("")).toBe(false)
  })
})

describe("números e datas BR", () => {
  it("decimal BR e internacional", () => {
    expect(parseDecimalBR("1.234,5")).toBe(1234.5)
    expect(parseDecimalBR("-25.4284")).toBe(-25.4284)
    expect(parseDecimalBR("5")).toBe(5)
    expect(parseDecimalBR("abc")).toBeNull()
    expect(parseDecimalBR("")).toBeNull()
  })
  it("inteiro com milhar", () => {
    expect(parseIntBR("24.000")).toBe(24000)
    expect(parseIntBR("12,5")).toBeNull()
  })
  it("datas dd/mm/aaaa e ISO, rejeitando datas impossíveis", () => {
    expect(parseDateBR("15/03/2024")).toBe("2024-03-15")
    expect(parseDateBR("2024-03-15")).toBe("2024-03-15")
    expect(parseDateBR("31/02/2024")).toBeNull()
    expect(parseDateBR("2024/03/15")).toBeNull()
  })
})

describe("schemas de cadastro", () => {
  const base = {
    razao_social: "Cliente Teste Ltda.",
    nome_fantasia: "",
    documento: "11222333000181",
    segmento: "Condominio",
    contato_nome: "",
    contato_email: "",
    contato_telefone: "",
    observacoes: "",
  }
  it("cliente: normaliza documento e vazios", () => {
    const r = clientSchema.parse(base)
    expect(r.documento).toBe("11.222.333/0001-81")
    expect(r.nome_fantasia).toBeNull()
    expect(r.segmento).toBe("condominio")
  })
  it("cliente: documento inválido gera erro no campo", () => {
    const r = clientSchema.safeParse({ ...base, documento: "123" })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path[0]).toBe("documento")
  })
  it("prédio: lat sem lng é erro; CEP normalizado", () => {
    const predio = {
      client_id: "c0000000-0000-4000-8000-000000000001",
      nome: "Torre A",
      logradouro: "",
      numero: "",
      bairro: "",
      cidade: "Curitiba",
      uf: "pr",
      cep: "80020310",
      regiao: "",
      lat: "-25,43",
      lng: "",
    }
    const r = buildingSchema.safeParse(predio)
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path[0]).toBe("lng")
    const ok = buildingSchema.parse({ ...predio, lng: "-49.27" })
    expect(ok.cep).toBe("80020-310")
    expect(ok.uf).toBe("PR")
    expect(ok.lat).toBe(-25.43)
  })
  it("equipamento: BTU positivo e data válida", () => {
    const eq = {
      building_id: "b0000000-0000-4000-8000-000000000001",
      tipo: "split",
      marca: "",
      modelo: "",
      capacidade_btu: "18.000",
      numero_serie: "",
      codigo_interno: "01-B1",
      ambiente: "",
      data_instalacao: "01/02/2024",
      observacoes: "",
    }
    const r = equipmentSchema.parse(eq)
    expect(r.capacidade_btu).toBe(18000)
    expect(r.data_instalacao).toBe("2024-02-01")
    expect(equipmentSchema.safeParse({ ...eq, capacidade_btu: "0" }).success).toBe(false)
  })
  it("lead perdido exige motivo", () => {
    const lead = {
      nome_contato: "Fulano",
      empresa: "",
      telefone: "",
      email: "",
      origem: "site",
      estagio: "perdido",
      valor_estimado: "R$ 1.500,00",
      motivo_perda: "",
      observacoes: "",
    }
    expect(leadSchema.safeParse(lead).success).toBe(false)
    const ok = leadSchema.parse({ ...lead, motivo_perda: "Preço" })
    expect(ok.valor_estimado).toBe(1500)
  })
  it("plano PMOC: periodicidade e RT obrigatórios", () => {
    const plano = {
      equipment_id: "e0000000-0000-4000-8000-000000000001",
      periodicidade_dias: "30",
      proxima_data: "2026-11-01",
      responsavel_tecnico: "Eng. Fulano — CREA-PR 12345",
      checklist_template_id: "",
      observacoes: "",
    }
    expect(pmocPlanSchema.parse(plano).periodicidade_dias).toBe(30)
    expect(pmocPlanSchema.safeParse({ ...plano, periodicidade_dias: "0" }).success).toBe(false)
    expect(pmocPlanSchema.safeParse({ ...plano, responsavel_tecnico: "" }).success).toBe(false)
  })
})

describe("situação do plano PMOC", () => {
  const hoje = "2026-10-14"
  it("faixas por proxima_data (mesma regra da view)", () => {
    expect(situacaoPorDias(-1)).toBe("atrasado")
    expect(situacaoPorDias(0)).toBe("vencendo")
    expect(situacaoPorDias(7)).toBe("vencendo")
    expect(situacaoPorDias(8)).toBe("em_dia")
  })
  it("atrasado sem OS em aberto pede gerar OS", () => {
    const s = situacaoPlano({ proxima_data: "2026-10-05", hoje, osStatus: ["concluido"] })
    expect(s.situacao).toBe("atrasado")
    expect(s.dias_para_vencer).toBe(-9)
    expect(s.acao).toBe("gerar_os")
  })
  it("OS em aberto não zera o atraso, mas muda a ação", () => {
    const s = situacaoPlano({ proxima_data: "2026-10-05", hoje, osStatus: ["agendado"] })
    expect(s.situacao).toBe("atrasado")
    expect(s.os_em_aberto).toBe(true)
    expect(s.acao).toBe("acompanhar_os")
  })
  it("vencendo e em dia", () => {
    expect(situacaoPlano({ proxima_data: "2026-10-19", hoje }).situacao).toBe("vencendo")
    const emDia = situacaoPlano({ proxima_data: "2026-11-30", hoje, osStatus: ["cancelado"] })
    expect(emDia.situacao).toBe("em_dia")
    expect(emDia.acao).toBeNull()
  })
  it("plano encerrado não tem situação operacional", () => {
    expect(situacaoPlano({ proxima_data: "2026-01-01", hoje, ativo: false }).situacao).toBe("encerrado")
  })
  it("helpers de data", () => {
    expect(diffDias("2026-12-31", "2027-01-01")).toBe(1)
    expect(addDias("2026-02-27", 2)).toBe("2026-03-01")
    expect(hojeBrt(new Date("2026-10-15T02:00:00Z"))).toBe("2026-10-14")
  })
})
