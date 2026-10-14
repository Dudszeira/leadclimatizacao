import { NextResponse } from "next/server";

import { asaasFetch } from "@/lib/asaas/client";
import type { AsaasPayment } from "@/lib/asaas/types";
import { handleAsaasWebhook, type RemotePayment } from "@/lib/asaas/webhook";
import { env, isDemoMode } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook do Asaas (cobranças + notas fiscais). Toda a regra fica em
 * src/lib/asaas/webhook.ts (testada sem Next/Supabase reais):
 * token `asaas-access-token` em tempo constante, limite de corpo, zod,
 * idempotência via webhook_events e 500 em falha de banco para o Asaas
 * reenviar. Modo demo / token ausente → 503 (falha fechada).
 * Pagamentos são reconferidos na API do Asaas (GET /payments/{id}) antes de
 * marcar a fatura como paga.
 */
async function fetchPayment(paymentId: string): Promise<RemotePayment> {
  return asaasFetch<AsaasPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

export async function POST(request: Request) {
  const result = await handleAsaasWebhook(
    request,
    { demo: isDemoMode, expectedToken: env.ASAAS_WEBHOOK_TOKEN, fetchPayment },
    createAdminClient,
  );
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  });
}
