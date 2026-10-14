/**
 * Tradução das falhas do Asaas para mensagens próprias do Control Lead.
 * A descrição crua do Asaas NUNCA vai para a UI (pode conter detalhes de
 * conta/cadastro em inglês ou jargão fiscal); ela só aparece no log do
 * servidor, em client.ts.
 *
 * Módulo puro — testado em tests/unit/asaas-errors.test.ts.
 */

export interface AsaasErrorItem {
  code?: string | null;
  description?: string | null;
}

interface Rule {
  /** Casa contra `code` e `description` (minúsculas, sem acento). */
  match: RegExp;
  message: string;
}

const RULES: Rule[] = [
  {
    match: /cpfcnpj|cpf_cnpj|cpf|cnpj/,
    message: "CNPJ do cliente inválido ou ausente — corrija o cadastro do cliente e tente novamente.",
  },
  {
    match: /municipalservice|servico municipal|codigo de servico|service code|municipal_service/,
    message:
      "Código de serviço municipal não aceito pela prefeitura — revise o código fiscal no cadastro do cliente.",
  },
  {
    match: /nota fiscal|invoice|nfs|fiscal|prefeitura|municipal/,
    message:
      "A prefeitura/Asaas recusou a NFS-e — confira os dados fiscais do cliente e a configuração fiscal da conta Asaas.",
  },
  {
    match: /duedate|vencimento/,
    message: "Data de vencimento inválida para o Asaas — revise o vencimento da fatura.",
  },
  {
    match: /value|valor/,
    message: "Valor da cobrança não aceito pelo Asaas — confira o valor da fatura (mínimo R$ 5,00 para boleto/Pix).",
  },
  {
    match: /billingtype|forma de pagamento|pix/,
    message: "Forma de pagamento indisponível na conta Asaas — verifique se Pix/boleto estão habilitados.",
  },
  {
    match: /email/,
    message: "E-mail do cliente inválido — corrija o contato do cliente e tente novamente.",
  },
  {
    match: /phone|telefone|celular/,
    message: "Telefone do cliente inválido — corrija o contato do cliente e tente novamente.",
  },
  {
    match: /customer|cliente/,
    message: "O cliente não pôde ser sincronizado com o Asaas — revise o cadastro (razão social, CNPJ e contato).",
  },
  {
    match: /deleted|removid|excluid/,
    message: "O registro foi removido no Asaas — atualize a página e gere novamente.",
  },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Mensagem pt-BR própria para uma resposta de erro do Asaas. */
export function mapAsaasError(
  status: number,
  errors?: AsaasErrorItem[] | null,
): string {
  if (status === 401 || status === 403) {
    return "O Asaas recusou a autenticação — confira a chave de API configurada no ambiente.";
  }
  if (status === 429) {
    return "O Asaas limitou as requisições no momento. Aguarde alguns segundos e tente novamente.";
  }
  if (status >= 500) {
    return "O Asaas está instável no momento. Tente novamente em instantes.";
  }
  if (status === 0) {
    return "Não foi possível falar com o Asaas — verifique a conexão e tente novamente.";
  }

  for (const item of errors ?? []) {
    const haystack = normalize(`${item.code ?? ""} ${item.description ?? ""}`);
    if (!haystack.trim()) continue;
    const rule = RULES.find((r) => r.match.test(haystack));
    if (rule) return rule.message;
  }

  if (status === 404) return "Registro não encontrado no Asaas — atualize a página e tente novamente.";
  return "O Asaas não aceitou a requisição. Revise os dados da fatura e do cliente e tente novamente.";
}
