import { beforeAll, describe, expect, it } from "vitest";

import {
  formatAgendaCurtaBR,
  formatDateTimeBR,
  formatDateTimeFullBR,
  formatHourBR,
  formatListTime,
  formatMessageTime,
} from "../../src/lib/format";

beforeAll(() => {
  process.env.TZ = "UTC";
});

const brt = (local: string) => new Date(`${local}-03:00`);

describe("exibição de horários no fuso de Curitiba (servidor em UTC)", () => {
  it("hora e data saem em BRT", () => {
    const iso = brt("2026-10-14T22:05:00").toISOString();
    expect(formatHourBR(iso)).toBe("22h05");
    expect(formatDateTimeBR(iso)).toBe("14/10/2026");
    expect(formatDateTimeFullBR(iso)).toBe("14/10/2026 às 22h05");
  });

  it("agenda curta usa dia da semana e hora de Curitiba", () => {
    // 14/10/2026 é quarta-feira.
    expect(formatAgendaCurtaBR(brt("2026-10-14T23:10:00").toISOString())).toBe("qua 14/10 · 23h");
  });

  it("lista de conversas: hoje, ontem e data, considerando a virada às 21h", () => {
    const agora = brt("2026-10-14T23:30:00");
    expect(formatListTime(brt("2026-10-14T21:10:00").toISOString(), agora)).toBe("21h10");
    expect(formatListTime(brt("2026-10-13T22:00:00").toISOString(), agora)).toBe("Ontem");
    expect(formatListTime(brt("2026-10-10T08:00:00").toISOString(), agora)).toBe("10/10");
  });

  it("bolha: só hora quando é hoje em Curitiba", () => {
    const agora = brt("2026-10-14T22:00:00");
    expect(formatMessageTime(brt("2026-10-14T21:45:00").toISOString(), agora)).toBe("21h45");
    expect(formatMessageTime(brt("2026-10-13T09:07:00").toISOString(), agora)).toBe("13/10 · 09h07");
  });

  it("valores inválidos não quebram", () => {
    expect(formatHourBR(null)).toBe("—");
    expect(formatListTime("x")).toBe("");
    expect(formatAgendaCurtaBR("nada")).toBe("—");
  });
});
