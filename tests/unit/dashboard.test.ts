import { describe, expect, it } from "vitest";

import { avgFirstResponseMinutes } from "../../src/server/dashboard-metrics";

const at = (min: number) => new Date(Date.UTC(2026, 9, 14, 12, min)).toISOString();

describe("avgFirstResponseMinutes (KPI de 1ª resposta)", () => {
  it("média entre a 1ª mensagem do cliente e a 1ª resposta, em qualquer ordem", () => {
    const valor = avgFirstResponseMinutes([
      // ordem decrescente, como vem da consulta (mais recentes primeiro)
      { conversation_id: "a", direcao: "out", created_at: at(10) },
      { conversation_id: "a", direcao: "out", created_at: at(4) },
      { conversation_id: "a", direcao: "in", created_at: at(0) },
      { conversation_id: "b", direcao: "out", created_at: at(8) },
      { conversation_id: "b", direcao: "in", created_at: at(2) },
    ]);
    expect(valor).toBe(5);
  });

  it("ignora conversas sem resposta e devolve null sem dados", () => {
    expect(
      avgFirstResponseMinutes([{ conversation_id: "a", direcao: "in", created_at: at(0) }]),
    ).toBeNull();
    expect(avgFirstResponseMinutes([])).toBeNull();
  });

  it("resposta anterior à mensagem do cliente não conta", () => {
    const valor = avgFirstResponseMinutes([
      { conversation_id: "a", direcao: "out", created_at: at(0) },
      { conversation_id: "a", direcao: "in", created_at: at(1) },
      { conversation_id: "a", direcao: "out", created_at: at(3) },
    ]);
    expect(valor).toBe(2);
  });
});
