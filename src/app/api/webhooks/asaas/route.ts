import { NextResponse } from "next/server";

import type { AsaasWebhookEvent } from "@/lib/asaas/types";
import { env, isDemoMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentMethod } from "@/lib/types";

/**
 * Webhook de cobranças do Asaas.
 *
 * - Autentica pelo header `asaas-access-token` (mesmo valor configurado no
 *   painel Asaas e em ASAAS_WEBHOOK_TOKEN).
 * - PAYMENT_RECEIVED / PAYMENT_CONFIRMED → fatura "pago" (+ paid_at, método).
 * - PAYMENT_OVERDUE → fatura pendente vira "atrasado".
 * - Sempre responde rápido com 200 (o Asaas pausa a fila de eventos quando
 *   recebe erro); eventos desconhecidos são ignorados com 200.
 * - Em modo demo (Supabase ausente) responde 503 com mensagem clara.
 */
export async function POST(request: Request) {
  if (isDemoMode) {
    return NextResponse.json(
      {
        error:
          "Modo demonstração — o webhook do Asaas será habilitado quando o banco do cliente (Supabase) for conectado.",
      },
      { status: 503 },
    );
  }

  const expectedToken = env.ASAAS_WEBHOOK_TOKEN;
  if (expectedToken) {
    const receivedToken = request.headers.get("asaas-access-token");
    if (receivedToken !== expectedToken) {
      return NextResponse.json(
        { error: "Token do webhook inválido." },
        { status: 401 },
      );
    }
  } else {
    // Sem token configurado o webhook não pode ser verificado — rejeita.
    console.error(
      "[webhooks/asaas] ASAAS_WEBHOOK_TOKEN ausente — evento recusado por segurança.",
    );
    return NextResponse.json(
      { error: "Webhook não configurado (ASAAS_WEBHOOK_TOKEN ausente)." },
      { status: 503 },
    );
  }

  let event: AsaasWebhookEvent;
  try {
    event = (await request.json()) as AsaasWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const payment = event.payment;
  if (!payment?.id) {
    // Evento sem cobrança (ex.: eventos de transferência) — nada a fazer.
    return NextResponse.json({ received: true });
  }

  try {
    const supabase = createAdminClient();

    if (event.event === "PAYMENT_RECEIVED" || event.event === "PAYMENT_CONFIRMED") {
      const metodo: PaymentMethod | null =
        payment.billingType === "PIX"
          ? "pix"
          : payment.billingType === "BOLETO"
            ? "boleto"
            : null;
      const paidAt = payment.paymentDate
        ? new Date(`${payment.paymentDate}T12:00:00-03:00`).toISOString()
        : new Date().toISOString();

      const { error } = await supabase
        .from("invoices")
        .update({
          status: "pago",
          paid_at: paidAt,
          ...(metodo ? { metodo } : {}),
        })
        .eq("asaas_id", payment.id)
        .neq("status", "cancelado");
      if (error) {
        console.error("[webhooks/asaas] PAYMENT_RECEIVED update:", error);
      }
    } else if (event.event === "PAYMENT_OVERDUE") {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "atrasado" })
        .eq("asaas_id", payment.id)
        .eq("status", "pendente");
      if (error) {
        console.error("[webhooks/asaas] PAYMENT_OVERDUE update:", error);
      }
    }
  } catch (error) {
    // Loga e ainda responde 200: o Asaas reenvia/pausa a fila em erro, e o
    // estado pode ser reconciliado depois via getPaymentStatus.
    console.error("[webhooks/asaas] falha ao processar evento:", error);
  }

  return NextResponse.json({ received: true });
}
