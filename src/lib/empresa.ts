/**
 * Dados institucionais da Lead Climatização usados em documentos gerados pelo
 * sistema (PDF de orçamento, rodapés). Módulo puro, sem segredos — pode ser
 * importado no cliente e no servidor.
 *
 * Dados conferidos com o cartão CNPJ (Receita, situação ativa) em 23/10/2026.
 */

export interface Empresa {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoMunicipal: string | null;
  endereco: {
    logradouro: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
  telefone: string;
  whatsapp: string;
  /** null = não imprime e-mail nos documentos. */
  email: string | null;
  site: string;
  /**
   * Logo para documentos (PNG ou JPG), caminho relativo a src/assets
   * (ex.: "logo-lead.png"). null = usa o símbolo provisório do sistema
   * (BrandMark). src/assets já entra no trace da rota do PDF (next.config.ts).
   */
  logo: string | null;
}

export const EMPRESA: Empresa = {
  razaoSocial: "Lead Climatização Ltda.",
  nomeFantasia: "Lead Climatização",
  cnpj: "57.635.198/0001-05",
  inscricaoMunicipal: null,
  endereco: {
    logradouro: "R. Bom Jesus",
    numero: "212",
    complemento: "Sala 1904, 19º andar",
    bairro: "Juvevê",
    cidade: "Curitiba",
    uf: "PR",
    cep: "80035-010",
  },
  telefone: "(41) 99868-5249",
  whatsapp: "(41) 99868-5249",
  email: null,
  site: "www.leadclimatizacao.com.br",
  logo: "logo-lead.png",
};

/** "Rua X, 123, Bairro, Cidade/UF, CEP 00000-000". */
export function enderecoEmpresa(e: Empresa["endereco"] = EMPRESA.endereco): string {
  const rua = [e.logradouro, e.numero].filter(Boolean).join(", ");
  const comp = e.complemento ? `, ${e.complemento}` : "";
  return `${rua}${comp}, ${e.bairro}, ${e.cidade}/${e.uf}, CEP ${e.cep}`;
}

/**
 * Textos padrão de um orçamento novo (o formulário pré-preenche com eles; o
 * usuário pode editar em cada orçamento).
 */
export const ORCAMENTO_PADROES = {
  /** Validade da proposta em dias corridos a partir da emissão. */
  validadeDias: 15,
  condicoesPagamento: "À vista.",
  prazoExecucao:
    "Início em até 5 dias úteis após a aprovação, conforme disponibilidade de agenda e de materiais.",
  garantia:
    "90 dias para os serviços executados (art. 26, II, do Código de Defesa do Consumidor). Equipamentos e peças conforme garantia do fabricante.",
} as const;

/** Condições de pagamento aceitas pela Lead (atalhos no formulário). */
export const CONDICOES_PAGAMENTO_OPCOES = ["À vista", "05 DDL", "10 DDL", "15 DDL", "28 DDL"] as const;
