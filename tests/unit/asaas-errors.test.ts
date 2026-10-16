import { describe, expect, it } from "vitest";

import { mapAsaasError } from "../../src/lib/asaas/errors";

describe("mapAsaasError — mensagens próprias, nunca o texto cru do Asaas", () => {
  it("mapeia por código/descrição", () => {
    expect(mapAsaasError(400, [{ code: "invalid_cpfCnpj", description: "O CPF/CNPJ informado é inválido." }]))
      .toMatch(/CNPJ do cliente inválido/);
    expect(mapAsaasError(400, [{ code: "invalid_dueDate", description: "Due date must be future" }]))
      .toMatch(/vencimento/i);
    expect(mapAsaasError(400, [{ code: "invalid_value", description: "Valor mínimo" }]))
      .toMatch(/Valor da cobrança/);
    expect(
      mapAsaasError(400, [{ code: "invalid_action", description: "Código de serviço municipal não encontrado" }]),
    ).toMatch(/Código de serviço municipal/);
    expect(mapAsaasError(400, [{ code: "invalid_email", description: "x" }])).toMatch(/E-mail do cliente/);
  });

  it("não vaza a descrição original", () => {
    const raw = "Conta 123 sem permissão para emitir: contate gerente@asaas";
    const msg = mapAsaasError(400, [{ code: "weird", description: raw }]);
    expect(msg).not.toContain("123");
    expect(msg).not.toContain("gerente");
  });

  it("status sem corpo", () => {
    expect(mapAsaasError(401)).toMatch(/autenticação/);
    expect(mapAsaasError(403)).toMatch(/autenticação/);
    expect(mapAsaasError(429)).toMatch(/limitou/);
    expect(mapAsaasError(503)).toMatch(/instável/);
    expect(mapAsaasError(0)).toMatch(/conexão/);
    expect(mapAsaasError(404)).toMatch(/não encontrado/);
    expect(mapAsaasError(400, [])).toMatch(/não aceitou/);
  });
});
