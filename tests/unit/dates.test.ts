import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  addDaysToDateKey,
  dateKeyBRT,
  daysFromTodayBRT,
  monthStartBRT,
  startOfDayBRTISO,
  todayBRT,
} from "../../src/lib/format";
import { daysFromToday, monthStartDate } from "../../src/server/_shared";
import { atHour, dayOffset, monthStart, parseDateOnly } from "../../src/lib/fixtures/dates";

// Simula o servidor da Vercel (UTC): os helpers não podem depender do TZ local.
beforeAll(() => {
  process.env.TZ = "UTC";
});

afterEach(() => {
  vi.useRealTimers();
});

/** Instante a partir de um horário de Curitiba (UTC-3). */
const brt = (local: string) => new Date(`${local}-03:00`);

describe("todayBRT: virada de dia entre 21h e 23h59 de Curitiba", () => {
  it.each([
    ["2026-10-14T21:00:00", "2026-10-14"],
    ["2026-10-14T22:30:00", "2026-10-14"],
    ["2026-10-14T23:59:59", "2026-10-14"],
    ["2026-10-15T00:00:00", "2026-10-15"],
  ])("%s BRT é %s (mesmo com UTC já no dia seguinte)", (local, esperado) => {
    const agora = brt(local);
    expect(todayBRT(agora)).toBe(esperado);
    expect(dateKeyBRT(agora)).toBe(esperado);
  });

  it("difere do slice de toISOString às 22h BRT", () => {
    const agora = brt("2026-10-14T22:00:00");
    expect(agora.toISOString().slice(0, 10)).toBe("2026-10-15");
    expect(todayBRT(agora)).toBe("2026-10-14");
  });
});

describe("monthStartBRT / monthStartDate", () => {
  it("último dia do mês às 22h BRT continua no mês corrente", () => {
    const agora = brt("2026-10-31T22:00:00");
    expect(monthStartBRT(0, agora)).toBe("2026-10-01");
    expect(monthStartDate(0, agora)).toBe("2026-10-01");
  });

  it("volta meses atravessando o ano", () => {
    const agora = brt("2026-01-31T23:30:00");
    expect(monthStartBRT(1, agora)).toBe("2025-12-01");
    expect(monthStartBRT(12, agora)).toBe("2025-01-01");
  });
});

describe("daysFromToday em BRT", () => {
  it("às 23h BRT, amanhã ainda é +1 e hoje é 0", () => {
    const agora = brt("2026-10-14T23:00:00");
    expect(daysFromTodayBRT("2026-10-14", agora)).toBe(0);
    expect(daysFromTodayBRT("2026-10-15", agora)).toBe(1);
    expect(daysFromToday("2026-10-13", agora)).toBe(-1);
  });

  it("conta dias através da virada do mês", () => {
    const agora = brt("2026-10-30T21:15:00");
    expect(daysFromToday("2026-11-02", agora)).toBe(3);
  });
});

describe("aritmética de datas civis", () => {
  it("addDaysToDateKey cruza mês e ano", () => {
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("startOfDayBRTISO é 03:00 UTC", () => {
    expect(startOfDayBRTISO("2026-10-14")).toBe("2026-10-14T03:00:00.000Z");
  });
});

describe("fixtures (src/lib/fixtures/dates.ts) seguem o dia de Curitiba", () => {
  it("às 22h BRT dayOffset(0) e monthStart ficam no dia/mês de Curitiba", () => {
    vi.useFakeTimers();
    vi.setSystemTime(brt("2026-10-31T22:00:00"));
    expect(dayOffset(0)).toBe("2026-10-31");
    expect(dayOffset(1)).toBe("2026-11-01");
    expect(monthStart(0)).toBe("2026-10-01");
  });

  it("atHour usa a hora de Curitiba", () => {
    vi.useFakeTimers();
    vi.setSystemTime(brt("2026-10-14T21:30:00"));
    expect(atHour(0, 9)).toBe("2026-10-14T12:00:00.000Z");
    expect(atHour(1, 8, 30)).toBe("2026-10-15T11:30:00.000Z");
    expect(parseDateOnly("2026-10-14").toISOString()).toBe("2026-10-14T03:00:00.000Z");
  });
});
