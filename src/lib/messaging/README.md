# Mensageria do Atendimento

Atendimento IA e integração com WhatsApp ficaram FORA do go-live da Fase 1.
Este pacote mantém a arquitetura pronta para plugar o provedor sem tocar em
tela nenhuma, e enquanto isso BLOQUEIA o envio.

- `adapter.ts`: contrato `MessagingAdapter` (`sendMessage`, `markRead`,
  `onIncoming`) que todo provedor implementa.
- `null-adapter.ts`: implementação atual. `sendMessage` rejeita com
  `MessagingNotConfiguredError`; nada é gravado como enviado.
- `send.ts`: `deliverAndPersist(adapter, mensagem, persist)`, fluxo único de
  envio (provedor primeiro, banco depois). Sem provedor, `persist` nunca roda.
- `index.ts`: `getMessagingAdapter()`, `isMessagingConfigured()` e
  `resolveMessagingProvider()`, lidos da env `MESSAGING_PROVIDER`.

## Estado atual

Sem provedor implementado, `isMessagingConfigured()` é false:

- a action `sendConversationMessage` devolve "Envio pelo WhatsApp ainda não
  configurado." sem consultar nem gravar nada;
- a tela /atendimento desabilita o campo de resposta com o mesmo aviso.

Consultar conversas, transferir para a equipe e encerrar continuam ativos.

## Como plugar um provedor (ex.: Evolution API)

1. Crie `evolution-adapter.ts` exportando `createEvolutionAdapter(): MessagingAdapter`:
   - `sendMessage`: chamada HTTP de envio de texto; devolva `{ externalId }`.
   - `markRead`: endpoint de leitura do provedor.
   - `onIncoming`: ligue ao webhook (route handler, ex.
     `src/app/api/webhooks/whatsapp/route.ts`, que traduz o payload para
     `IncomingMessage` e persiste em `messages` com `autor: "cliente"`).
2. Registre `evolution: createEvolutionAdapter` em `PROVIDERS` no `index.ts`.
3. Defina `MESSAGING_PROVIDER=evolution` e as envs de credencial do provedor
   (validadas em `src/lib/env.ts`).

Nada mais muda: a action já envia pelo adapter e só então persiste a mensagem
como autor humano.
