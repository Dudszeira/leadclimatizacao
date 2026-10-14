import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  handleAsaasWebhook,
  MAX_WEBHOOK_BODY_BYTES,
  tokensMatch,
} from "../../src/lib/asaas/webhook";

// ---------------------------------------------------------------------------
// Supabase falso: registra cada chamada encadeada e responde via handler.
// ---------------------------------------------------------------------------

type Op = "insert" | "upsert" | "update" | "select" | "delete";
interface Call {
  table: string;
  op: Op;
  payload?: unknown;
  options?: unknown;
  filters: Array<[string, ...unknown[]]>;
  returning?: string;
}
type Reply = { data?: unknown; error?: unknown; count?: number | null };
type Handler = (call: Call) => Reply | undefined;

function fakeSupabase(handler: Handler) {
  const calls: Call[] = [];
  function builder(table: string) {
    const call: Call = { table, op: "select", filters: [] };
    let opSet = false;
    const b: Record<string, unknown> = {};
    const setOp = (op: Op, payload?: unknown, options?: unknown) => {
      call.op = op;
      call.payload = payload;
      call.options = options;
      opSet = true;
      return b;
    };
    b.insert = (p: unknown, o?: unknown) => setOp("insert", p, o);
    b.upsert = (p: unknown, o?: unknown) => setOp("upsert", p, o);
    b.update = (p: unknown) => setOp("update", p);
    b.delete = () => setOp("delete");
    b.select = (cols?: string) => {
      if (!opSet) {
        call.op = "select";
        opSet = true;
      } else call.returning = cols;
      return b;
    };
    for (const f of ["eq", "neq", "in", "is", "or", "not", "order", "range", "limit"]) {
      b[f] = (...args: unknown[]) => {
        call.filters.push([f, ...args]);
        return b;
      };
    }
    const resolve = () => {
      calls.push(call);
      const r = handler(call) ?? {};
      return { data: r.data ?? null, error: r.error ?? null, count: r.count ?? null };
    };
    b.maybeSingle = () => Promise.resolve(resolve());
    b.single = () => Promise.resolve(resolve());
    b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve(resolve()).then(ok, ko);
    return b;
  }
  return { client: { from: (t: string) => builder(t) }, calls };
}

const TOKEN = "segredo-do-webhook-123";
const INVOICE_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

function req(body: unknown, token: string | null = TOKEN, raw?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== null) headers["asaas-access-token"] = token;
  return new Request("http://localhost/api/webhooks/asaas", {
    method: "POST",
    headers,
    body: raw ?? JSON.stringify(body),
  });
}

const config = { demo: false, expectedToken: TOKEN };

const paymentReceived = {
  id: "evt_05b708f961d739ea7eba7e4db318f621&368604920",
  event: "PAYMENT_RECEIVED",
  dateCreated: "2026-10-14 10:00:00",
  payment: {
    object: "payment",
    id: "pay_080225913252",
    billingType: "PIX",
    status: "RECEIVED",
    value: 8900,
    paymentDate: "2026-10-14",
    externalReference: INVOICE_ID,
  },
};

/** Handler padrão: evento novo, 1 fatura afetada em qualquer update. */
function defaultHandler(overrides: Partial<Record<string, Reply>> = {}): Handler {
  return (call) => {
    if (call.table === "webhook_events" && call.op === "upsert") return overrides.upsert ?? {};
    if (call.table === "webhook_events" && call.op === "select")
      return overrides.read ?? { data: { processed_at: null } };
    if (call.table === "webhook_events" && call.op === "update") return overrides.mark ?? {};
    if (call.table === "invoices" && call.op === "update")
      return overrides.invoices ?? { data: [{ id: INVOICE_ID }] };
    return {};
  };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("tokensMatch", () => {
  it("compara em tempo constante e recusa tamanhos diferentes", () => {
    expect(tokensMatch(TOKEN, TOKEN)).toBe(true);
    expect(tokensMatch("x", TOKEN)).toBe(false);
    expect(tokensMatch(TOKEN.slice(0, -1) + "4", TOKEN)).toBe(false);
    expect(tokensMatch(null, TOKEN)).toBe(false);
    expect(tokensMatch("", TOKEN)).toBe(false);
  });
});

describe("webhook Asaas — autenticação e falha fechada", () => {
  it("token inválido → 401 sem tocar no banco", async () => {
    const getDb = vi.fn();
    const res = await handleAsaasWebhook(req(paymentReceived, "errado"), config, getDb);
    expect(res.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("sem header → 401", async () => {
    const res = await handleAsaasWebhook(req(paymentReceived, null), config, vi.fn());
    expect(res.status).toBe(401);
  });

  it("modo demo → 503", async () => {
    const res = await handleAsaasWebhook(req(paymentReceived), { demo: true, expectedToken: TOKEN }, vi.fn());
    expect(res.status).toBe(503);
  });

  it("token não configurado → 503 (falha fechada)", async () => {
    const res = await handleAsaasWebhook(req(paymentReceived), { demo: false, expectedToken: undefined }, vi.fn());
    expect(res.status).toBe(503);
  });

  it("corpo acima do limite → 413", async () => {
    const big = "x".repeat(MAX_WEBHOOK_BODY_BYTES + 10);
    const res = await handleAsaasWebhook(req(null, TOKEN, JSON.stringify({ id: "e", event: "X", big })), config, vi.fn());
    expect(res.status).toBe(413);
  });

  it("JSON inválido → 400; payload fora do schema → 400", async () => {
    const bad = await handleAsaasWebhook(req(null, TOKEN, "{nope"), config, vi.fn());
    expect(bad.status).toBe(400);
    const semId = await handleAsaasWebhook(req({ event: "PAYMENT_RECEIVED" }), config, vi.fn());
    expect(semId.status).toBe(400);
  });
});

describe("webhook Asaas — idempotência e erros de banco", () => {
  it("registra o evento (on conflict do nothing) e marca a fatura como paga", async () => {
    const db = fakeSupabase(defaultHandler());
    const res = await handleAsaasWebhook(req(paymentReceived), config, () => db.client as never);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ received: true, affected: 1 });

    const upsert = db.calls.find((c) => c.table === "webhook_events" && c.op === "upsert");
    expect(upsert?.options).toMatchObject({ onConflict: "id", ignoreDuplicates: true });

    const inv = db.calls.find((c) => c.table === "invoices" && c.op === "update");
    expect(inv?.payload).toMatchObject({ status: "pago", metodo: "pix" });
    expect((inv?.payload as { paid_at: string }).paid_at).toBe("2026-10-14T15:00:00.000Z");
    expect(inv?.filters).toContainEqual(["eq", "asaas_id", "pay_080225913252"]);
    expect(inv?.filters).toContainEqual(["neq", "status", "cancelado"]);

    const done = db.calls.find((c) => c.table === "webhook_events" && c.op === "update");
    expect(done?.payload).toMatchObject({ error: null });
    expect((done?.payload as { processed_at: string }).processed_at).toBeTruthy();
  });

  it("evento repetido (já processado) → 200 sem reprocessar", async () => {
    const db = fakeSupabase(defaultHandler({ read: { data: { processed_at: "2026-10-14T13:00:00Z" } } }));
    const res = await handleAsaasWebhook(req(paymentReceived), config, () => db.client as never);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ duplicate: true });
    expect(db.calls.some((c) => c.table === "invoices")).toBe(false);
  });

  it("falha ao registrar o evento → 500 (Asaas reenvia)", async () => {
    const db = fakeSupabase(defaultHandler({ upsert: { error: { message: "connection refused" } } }));
    const res = await handleAsaasWebhook(req(paymentReceived), config, () => db.client as never);
    expect(res.status).toBe(500);
    expect(db.calls.some((c) => c.table === "invoices")).toBe(false);
  });

  it("falha ao atualizar a fatura → 500 e grava o erro em webhook_events", async () => {
    const db = fakeSupabase(defaultHandler({ invoices: { error: { message: "deadlock detected" } } }));
    const res = await handleAsaasWebhook(req(paymentReceived), config, () => db.client as never);
    expect(res.status).toBe(500);
    const mark = db.calls.find((c) => c.table === "webhook_events" && c.op === "update");
    expect((mark?.payload as { error: string }).error).toContain("deadlock detected");
    expect(mark?.payload).not.toHaveProperty("processed_at");
    // A mensagem do erro cru não vai na resposta.
    expect(JSON.stringify(res.body)).not.toContain("deadlock");
  });

  it("client service role indisponível → 500", async () => {
    const res = await handleAsaasWebhook(req(paymentReceived), config, () => {
      throw new Error("sem service role");
    });
    expect(res.status).toBe(500);
  });
});

describe("webhook Asaas — regras por evento", () => {
  it("PAYMENT_OVERDUE só move pendente → atrasado", async () => {
    const db = fakeSupabase(defaultHandler());
    await handleAsaasWebhook(
      req({ ...paymentReceived, id: "evt_2", event: "PAYMENT_OVERDUE" }),
      config,
      () => db.client as never,
    );
    const inv = db.calls.find((c) => c.table === "invoices");
    expect(inv?.payload).toEqual({ status: "atrasado" });
    expect(inv?.filters).toContainEqual(["eq", "status", "pendente"]);
  });

  it("PAYMENT_RECEIVED sem asaas_id gravado cai no fallback por externalReference", async () => {
    let n = 0;
    const db = fakeSupabase((call) => {
      if (call.table === "invoices" && call.op === "update") {
        n += 1;
        return { data: n === 1 ? [] : [{ id: INVOICE_ID }] };
      }
      return defaultHandler()(call);
    });
    const res = await handleAsaasWebhook(req(paymentReceived), config, () => db.client as never);
    expect(res.body).toMatchObject({ affected: 1 });
    const fallback = db.calls.filter((c) => c.table === "invoices")[1];
    expect(fallback.filters).toContainEqual(["eq", "id", INVOICE_ID]);
    expect(fallback.payload).toMatchObject({ asaas_id: "pay_080225913252", status: "pago" });
  });

  it("PAYMENT_DELETED libera a fatura em aberto para nova cobrança", async () => {
    const db = fakeSupabase(defaultHandler());
    await handleAsaasWebhook(
      req({ ...paymentReceived, id: "evt_3", event: "PAYMENT_DELETED" }),
      config,
      () => db.client as never,
    );
    const inv = db.calls.find((c) => c.table === "invoices");
    expect(inv?.payload).toEqual({ asaas_id: null, asaas_url: null });
    expect(inv?.filters).toContainEqual(["in", "status", ["pendente", "atrasado"]]);
  });

  it("PAYMENT_CHARGEBACK_REQUESTED tira a fatura de pago", async () => {
    const db = fakeSupabase(defaultHandler());
    await handleAsaasWebhook(
      req({ ...paymentReceived, id: "evt_4", event: "PAYMENT_CHARGEBACK_REQUESTED" }),
      config,
      () => db.client as never,
    );
    const inv = db.calls.find((c) => c.table === "invoices");
    expect(inv?.payload).toEqual({ status: "atrasado", paid_at: null });
  });

  it("INVOICE_AUTHORIZED grava número da NFS-e e id da nota", async () => {
    const db = fakeSupabase(defaultHandler());
    const res = await handleAsaasWebhook(
      req({
        id: "evt_nf_1",
        event: "INVOICE_AUTHORIZED",
        invoice: {
          id: "inv_000000000232",
          status: "AUTHORIZED",
          number: 4321,
          pdfUrl: "https://www.asaas.com/nfse/x.pdf",
          payment: "pay_080225913252",
          externalReference: INVOICE_ID,
        },
      }),
      config,
      () => db.client as never,
    );
    expect(res.status).toBe(200);
    const inv = db.calls.find((c) => c.table === "invoices");
    expect(inv?.payload).toEqual({
      asaas_invoice_id: "inv_000000000232",
      nf_numero: "4321",
      nf_url: "https://www.asaas.com/nfse/x.pdf",
    });
    expect(inv?.filters).toContainEqual(["eq", "asaas_invoice_id", "inv_000000000232"]);
  });

  it("INVOICE_ERROR libera a fatura para reemissão", async () => {
    const db = fakeSupabase(defaultHandler());
    await handleAsaasWebhook(
      req({
        id: "evt_nf_2",
        event: "INVOICE_ERROR",
        invoice: { id: "inv_1", status: "ERROR", statusDescription: "Código de serviço inválido" },
      }),
      config,
      () => db.client as never,
    );
    const inv = db.calls.find((c) => c.table === "invoices");
    expect(inv?.payload).toEqual({ asaas_invoice_id: null });
  });

  it("INVOICE_CANCELED limpa número e id da nota", async () => {
    const db = fakeSupabase(defaultHandler());
    await handleAsaasWebhook(
      req({ id: "evt_nf_3", event: "INVOICE_CANCELED", invoice: { id: "inv_1" } }),
      config,
      () => db.client as never,
    );
    const inv = db.calls.find((c) => c.table === "invoices");
    expect(inv?.payload).toEqual({ asaas_invoice_id: null, nf_numero: null, nf_url: null });
  });

  it("evento desconhecido é registrado e respondido com 200", async () => {
    const db = fakeSupabase(defaultHandler());
    const res = await handleAsaasWebhook(
      req({ id: "evt_x", event: "PAYMENT_BANK_SLIP_VIEWED", payment: { id: "pay_1" } }),
      config,
      () => db.client as never,
    );
    expect(res.status).toBe(200);
    expect(db.calls.some((c) => c.table === "invoices")).toBe(false);
  });
});
