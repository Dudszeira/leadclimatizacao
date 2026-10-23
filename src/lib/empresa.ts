/**
 * Dados institucionais da Lead Climatização usados em documentos gerados pelo
 * sistema (PDF de orçamento, rodapés). Módulo puro, sem segredos — pode ser
 * importado no cliente e no servidor.
 *
 * Os dados reais ainda não chegaram: tudo marcado com // PREENCHER é
 * placeholder e precisa ser trocado antes de enviar orçamento a cliente.
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
  email: string;
  site: string;
  /**
   * Logo para documentos (PNG ou JPG), caminho relativo a src/assets
   * (ex.: "logo-lead.png"). null = usa o símbolo provisório do sistema
   * (BrandMark). src/assets já entra no trace da rota do PDF (next.config.ts).
   */
  logo: string | null;
}

export const EMPRESA: Empresa = {
  razaoSocial: "Lead Climatização Ltda.", // PREENCHER
  nomeFantasia: "Lead Climatização",
  cnpj: "00.000.000/0001-00", // PREENCHER
  inscricaoMunicipal: null, // PREENCHER (opcional)
  endereco: {
    logradouro: "Rua Exemplo", // PREENCHER
    numero: "000", // PREENCHER
    complemento: null, // PREENCHER (opcional)
    bairro: "Centro", // PREENCHER
    cidade: "Curitiba", // PREENCHER
    uf: "PR", // PREENCHER
    cep: "80000-000", // PREENCHER
  },
  telefone: "(41) 0000-0000", // PREENCHER
  whatsapp: "(41) 90000-0000", // PREENCHER
  email: "contato@leadclimatizacao.com.br", // PREENCHER (confirmar)
  site: "leadclimatizacao.com.br",
  logo: null, // PREENCHER quando o cliente enviar o logotipo
};

/** "Rua X, 123, Bairro, Cidade/UF, CEP 00000-000". */
export function enderecoEmpresa(e: Empresa["endereco"] = EMPRESA.endereco): string {
  const rua = [e.logradouro, e.numero].filter(Boolean).join(", ");
  const comp = e.complemento ? ` ${e.complemento}` : "";
  return `${rua}${comp}, ${e.bairro}, ${e.cidade}/${e.uf}, CEP ${e.cep}`;
}

/**
 * Textos padrão de um orçamento novo (o formulário pré-preenche com eles; o
 * usuário pode editar em cada orçamento).
 */
export const ORCAMENTO_PADROES = {
  /** Validade da proposta em dias corridos a partir da emissão. */
  validadeDias: 15,
  condicoesPagamento:
    "50% na aprovação e 50% na conclusão do serviço, via Pix ou boleto bancário.",
  prazoExecucao:
    "Início em até 5 dias úteis após a aprovação, conforme disponibilidade de agenda e de materiais.",
  garantia:
    "90 dias para os serviços executados (art. 26, II, do Código de Defesa do Consumidor). Equipamentos e peças conforme garantia do fabricante.",
} as const;
