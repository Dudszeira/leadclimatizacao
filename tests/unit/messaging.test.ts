import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MESSAGING_NOT_CONFIGURED,
  MessagingNotConfiguredError,
  deliverAndPersist,
  getMessagingAdapter,
  isMessagingConfigured,
  resolveMessagingProvider,
  type MessagingAdapter,
} from "../../src/lib/messaging";
import { createNullAdapter } from "../../src/lib/messaging/null-adapter";

const message = {
  conversationId: "ca000000-0000-4000-8000-000000000001",
  telefone: "+554133303030",
  texto: "Olá",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("provedor de mensageria (WhatsApp fora do go-live)", () => {
  it("sem MESSAGING_PROVIDER o envio não está configurado", () => {
    vi.stubEnv("MESSAGING_PROVIDER", "");
    expect(resolveMessagingProvider()).toBeNull();
    expect(isMessagingConfigured()).toBe(false);
  });

  it("'null' e provedores sem implementação também bloqueiam", () => {
    expect(resolveMessagingProvider("null")).toBeNull();
    expect(resolveMessagingProvider("evolution")).toBeNull();
    expect(resolveMessagingProvider("cloud-api")).toBeNull();
  });

  it("o adapter padrão é o nulo e rejeita o envio", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const adapter = getMessagingAdapter();
    expect(adapter.provider).toBe("null");
    await expect(adapter.sendMessage(message)).rejects.toBeInstanceOf(MessagingNotConfiguredError);
  });
});

describe("deliverAndPersist: nada é gravado sem envio real", () => {
  it("sem adapter (não configurado) bloqueia e não persiste", async () => {
    const persist = vi.fn(async () => true);
    const outcome = await deliverAndPersist(null, message, persist);
    expect(outcome).toEqual({ ok: false, reason: "not_configured" });
    expect(persist).not.toHaveBeenCalled();
  });

  it("com o NullAdapter bloqueia e não persiste", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const persist = vi.fn(async () => true);
    const outcome = await deliverAndPersist(createNullAdapter(), message, persist);
    expect(outcome).toEqual({ ok: false, reason: "not_configured" });
    expect(persist).not.toHaveBeenCalled();
  });

  it("falha do provedor real não grava a mensagem", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const adapter: MessagingAdapter = {
      provider: "fake",
      sendMessage: vi.fn(async () => {
        throw new Error("timeout");
      }),
      markRead: vi.fn(async () => {}),
      onIncoming: () => () => {},
    };
    const persist = vi.fn(async () => true);
    const outcome = await deliverAndPersist(adapter, message, persist);
    expect(outcome).toEqual({ ok: false, reason: "provider_error" });
    expect(persist).not.toHaveBeenCalled();
  });

  it("provedor real aceita: persiste com o recibo", async () => {
    const adapter: MessagingAdapter = {
      provider: "fake",
      sendMessage: vi.fn(async () => ({ externalId: "wa_1" })),
      markRead: vi.fn(async () => {}),
      onIncoming: () => () => {},
    };
    const persist = vi.fn(async () => true);
    const outcome = await deliverAndPersist(adapter, message, persist);
    expect(outcome).toEqual({ ok: true, receipt: { externalId: "wa_1" } });
    expect(persist).toHaveBeenCalledWith({ externalId: "wa_1" });
  });

  it("mensagem de bloqueio exibida na UI", () => {
    expect(MESSAGING_NOT_CONFIGURED).toBe("Envio pelo WhatsApp ainda não configurado.");
  });
});
