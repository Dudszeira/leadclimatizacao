/**
 * Dados fiscais da NFS-e (Curitiba) a partir do cadastro do cliente
 * (colunas de 0006: codigo_servico_municipal, aliquota_iss, reter_iss).
 * Módulo puro — testado em tests/unit/financeiro-fiscal.test.ts.
 */

/** Alíquota padrão de ISS (%) quando o cliente não tem uma cadastrada. */
export const DEFAULT_ALIQUOTA_ISS = 5;

export interface ClientFiscalInput {
  codigo_servico_municipal?: string | null;
  aliquota_iss?: number | string | null;
  reter_iss?: boolean | null;
}

export interface NfseFiscal {
  /** Alíquota de ISS em % (0-100). */
  iss: number;
  retainIss: boolean;
  /** null = cliente sem código de serviço — emissão bloqueada com mensagem própria. */
  municipalServiceCode: string | null;
}

export function fiscalFromClient(client: ClientFiscalInput | null | undefined): NfseFiscal {
  const raw = client?.aliquota_iss;
  const aliquota = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
  const iss =
    Number.isFinite(aliquota) && aliquota >= 0 && aliquota <= 100
      ? Math.round(aliquota * 100) / 100
      : DEFAULT_ALIQUOTA_ISS;
  const code = client?.codigo_servico_municipal?.trim();
  return {
    iss,
    retainIss: client?.reter_iss === true,
    municipalServiceCode: code ? code : null,
  };
}
