# Integração Asaas (cobrança + NFS-e)

A conta da Lead Climatização ainda não existe — tudo aqui roda contra o
**sandbox** (`ASAAS_ENV=sandbox` → `https://api-sandbox.asaas.com/v3`). Sem
`ASAAS_API_KEY`, as funções de `service.ts` resolvem para
`Result` de erro "Asaas ainda não configurado" e a UI mostra o toast — nenhuma
chamada real acontece em modo demo.

## Arquivos

- `client.ts` — `asaasFetch<T>()`: fetch tipado com header `access_token`,
  erros → `AsaasError` com mensagem pt-BR. A chave nunca é logada.
- `types.ts` — Customer, Payment (PIX/BOLETO) e Invoice (NFS-e).
- `service.ts` — alto nível, contrato `Result<T>`: `ensureCustomer`,
  `createPayment`, `getPaymentStatus`, `scheduleInvoice`.

## Fluxo de cobrança

1. Ação "Gerar cobrança" na tabela de faturas (`src/server/actions/invoices.ts`).
2. `ensureCustomer(cliente)` — busca por `externalReference` (= `clients.id`)
   ou CNPJ; cria se não existir.
3. `createPayment(fatura, customerId, "pix" | "boleto")` — cria a cobrança com
   `externalReference` = `invoices.id`.
4. O retorno (`id`, `invoiceUrl`) é gravado em `invoices.asaas_id` /
   `invoices.asaas_url`; o link de pagamento fica disponível na tabela.
5. "Emitir NFS-e" → `scheduleInvoice(fatura)` vincula a nota à cobrança; o
   número (`invoices.nf_numero`) chega quando a prefeitura autoriza.

## Webhook (`/api/webhooks/asaas`)

Handler em `src/app/api/webhooks/asaas/route.ts`:

- Valida o header `asaas-access-token` contra `ASAAS_WEBHOOK_TOKEN` (401 se divergir).
- `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` → fatura vira `pago` (+ `paid_at`, método).
- `PAYMENT_OVERDUE` → fatura pendente vira `atrasado`.
- Atualiza `invoices` pelo `asaas_id` usando o client service role
  (`src/lib/supabase/admin.ts`) e responde 200 rápido; eventos não tratados
  também recebem 200 (o Asaas pausa a fila em caso de erro).
- Em modo demo (Supabase ausente) responde **503** com mensagem clara.

## Apontando o webhook no painel Asaas

1. Painel Asaas (sandbox) → **Integrações → Webhooks → Novo webhook**.
2. URL: `https://SEU-DOMINIO/api/webhooks/asaas` · versão v3 · tipo "Cobranças".
3. Token de autenticação: o mesmo valor de `ASAAS_WEBHOOK_TOKEN` do `.env`.
4. Habilite ao menos os eventos `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED` e
   `PAYMENT_OVERDUE`; fila síncrona e e-mail de alerta do time.
