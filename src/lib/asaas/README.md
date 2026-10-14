# Integração Asaas (cobrança + NFS-e)

A conta da Lead Climatização ainda não existe — tudo aqui roda contra o
**sandbox** (`ASAAS_ENV=sandbox` → `https://api-sandbox.asaas.com/v3`). Sem
`ASAAS_API_KEY`, as funções de `service.ts` resolvem para
`Result` de erro "Asaas ainda não configurado" e a UI mostra o toast — nenhuma
chamada real acontece em modo demo.

## Arquivos

- `client.ts` — `asaasFetch<T>()`: fetch tipado com header `access_token`,
  timeout de 20 s; erros → `AsaasError` com mensagem PRÓPRIA (`errors.ts`).
  A descrição crua do Asaas só vai para o log; a chave nunca é logada.
- `errors.ts` — `mapAsaasError(status, errors)`: código/descrição → texto pt-BR.
- `types.ts` — Customer, Payment (PIX/BOLETO), Invoice (NFS-e) e eventos de webhook.
- `service.ts` — alto nível, contrato `Result<T>`: `ensureCustomer`,
  `createPayment`, `getPaymentStatus`, `scheduleInvoice`,
  `findPaymentByReference`, `findInvoiceByReference`.
- `dates.ts` — datas em BRT (`todayBRT`, `competenciaBRT`, `vencimentoFor`,
  `dueDateForCharge`). Nunca use `new Date().toISOString()` para "hoje".
- `fiscal.ts` — ISS/retenção/código de serviço a partir do cliente (fallback 5%).
- `lock.ts` — lock lógico "pending:<ts>:<nonce>" contra cobrança/NFS-e duplicada.
- `billing.ts` — espelho do job de faturamento mensal (modo demo/testes).
- `kpis.ts` — KPIs do financeiro sobre agregados + `collectPaged` (sem teto silencioso).
- `webhook.ts` — núcleo do webhook (testado em `tests/unit/webhook-asaas.test.ts`).

## Fluxo de cobrança

1. "Gerar cobrança" na tabela de faturas (`src/server/actions/invoices.ts`, só admin).
2. UPDATE condicional grava o lock em `invoices.asaas_id` (`.select("id")`;
   0 linhas = outra requisição já está gerando / RLS bloqueou).
3. Procura cobrança já criada para a fatura (`externalReference` = `invoices.id`);
   se não houver, `ensureCustomer` + `createPayment` (vencimento passado → hoje BRT).
4. Grava `asaas_id`/`asaas_url`/`metodo` só se o lock ainda é nosso; em falha o lock é liberado.
5. "Emitir NFS-e" segue o mesmo padrão em `invoices.asaas_invoice_id`, com
   alíquota/retenção de ISS e código de serviço do cliente. O número
   (`nf_numero`) chega pelo webhook `INVOICE_AUTHORIZED`.

## Webhook (`/api/webhooks/asaas`)

- Header `asaas-access-token` comparado com `ASAAS_WEBHOOK_TOKEN` via
  `crypto.timingSafeEqual` (401 se divergir; 503 se ausente ou em modo demo).
- Corpo limitado a 64 KB (413) e validado com zod (400).
- Idempotência: `webhook_events` (insert on conflict do nothing); evento já
  processado → 200 sem reprocessar. Falha de banco → 500 + `webhook_events.error`
  (o Asaas reenvia; após 15 falhas seguidas pausa a fila — monitore a tabela).
- Cobranças: `PAYMENT_RECEIVED`/`CONFIRMED` → pago · `OVERDUE` → atrasado ·
  `DELETED` → fatura volta a ficar sem cobrança · `RESTORED` → religa ·
  `REFUNDED` → cancelado · `RECEIVED_IN_CASH_UNDONE` → pendente ·
  `CHARGEBACK_REQUESTED`/`CHARGEBACK_DISPUTE`/`AWAITING_CHARGEBACK_REVERSAL` → atrasado.
- Notas: `INVOICE_AUTHORIZED` → grava `nf_numero` + `asaas_invoice_id` ·
  `INVOICE_ERROR` → libera para reemissão · `INVOICE_CANCELED` → limpa número/id.
  O link do PDF fica em `webhook_events.payload` (não há coluna própria ainda).

## Apontando o webhook no painel Asaas

1. Painel Asaas (sandbox) → **Integrações → Webhooks → Novo webhook**.
2. URL: `https://SEU-DOMINIO/api/webhooks/asaas` · versão v3.
3. Token de autenticação: o mesmo valor de `ASAAS_WEBHOOK_TOKEN` do `.env`.
4. Eventos: os de cobrança listados acima e os de nota fiscal
   (`INVOICE_AUTHORIZED`, `INVOICE_ERROR`, `INVOICE_CANCELED`); fila
   síncrona e e-mail de alerta do time.
