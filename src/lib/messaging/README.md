# Mensageria do Atendimento IA

A integração com WhatsApp foi adiada — este pacote deixa a arquitetura pronta
para plugar o provedor sem tocar em tela nenhuma.

- `adapter.ts` — contrato `MessagingAdapter` (`sendMessage`, `markRead`,
  `onIncoming`) que todo provedor implementa.
- `null-adapter.ts` — implementação atual: loga e resolve (demo/pré-integração).
- `index.ts` — factory `getMessagingAdapter()` escolhida pela env
  `MESSAGING_PROVIDER`.

## Como plugar um provedor (ex.: Evolution API)

1. Crie `evolution-adapter.ts` exportando `createEvolutionAdapter(): MessagingAdapter`:
   - `sendMessage` → chamada HTTP de envio de texto do provedor; devolva o id
     externo em `{ externalId }`.
   - `markRead` → endpoint de leitura do provedor.
   - `onIncoming` → conecte ao webhook (crie a route handler, ex.
     `src/app/api/webhooks/whatsapp/route.ts`, que traduz o payload para
     `IncomingMessage` e chama os handlers registrados; persista na tabela
     `messages` com `autor: "cliente"`).
2. Registre o case `"evolution"` na factory de `index.ts`.
3. Defina `MESSAGING_PROVIDER=evolution` (e as envs de credencial do provedor,
   validadas em `src/lib/env.ts`).

Nada mais muda: a server action `sendConversationMessage`
(`src/server/actions/conversations.ts`) já envia pelo adapter e persiste a
mensagem como autor humano.
