# Control Lead — Console de Operações · Lead Climatização

Sistema de gestão Fase 1: CRM por cliente/prédio, central de chamados/OS com calendário
de PMOC (Lei 13.589/2018), atendimento com IA, dashboard único e financeiro/fiscal.

## Rodar local

```bash
npm install
npm run dev   # http://localhost:3000
```

Sem `.env`, o app roda em **modo demo**: todas as telas funcionam com dados fictícios
equivalentes ao `supabase/seed.sql`. Preencheu as variáveis do Supabase → o modo demo
desliga sozinho (`src/lib/env.ts`).

## Stack

Next.js 16 (App Router) · Tailwind v4 · shadcn/ui (Base UI) · Supabase (Postgres + Auth +
Storage) · Leaflet/OSM · Asaas (cobranças + NFS-e, sandbox) · Vercel.

Contrato visual em `design-system/MASTER.md` — tema console dark único extraído da demo
aprovada pelo cliente.

## Estrutura

- `src/app/(console)/` — as 7 telas (dashboard, clientes, chamados, pmoc, mapa, atendimento, financeiro)
- `src/server/` — data layer (`Result<T>`, ver `src/server/README.md`) e server actions
- `src/lib/format.ts` + `src/lib/status-meta.ts` — formatadores e semântica de status únicos
- `src/lib/asaas/` — integração Asaas (cliente, service, webhook em `/api/webhooks/asaas`)
- `src/lib/messaging/` — adapter de mensageria (WhatsApp pluga aqui)
- `supabase/migrations/` + `seed.sql` — schema completo com RLS por papel (admin/atendente/tecnico)

## Checklist de ativação (quando as contas existirem)

1. **Supabase** (conta do cliente): criar projeto → `supabase link` → `supabase db push` →
   rodar `seed.sql` (opcional em staging) → criar buckets `os-fotos` e `os-assinaturas`
   (policies comentadas em `migrations/0002_rls.sql`) → preencher `.env`.
2. **Auth**: criar usuários da equipe com roles em `profiles` (admin/atendente/tecnico).
3. **Vercel** (conta do cliente): importar repo → env vars → deploy.
4. **Asaas**: chave sandbox em `ASAAS_API_KEY` → testar cobrança → webhook no painel
   apontando pra `/api/webhooks/asaas` com `ASAAS_WEBHOOK_TOKEN`.
5. **Cron do PMOC**: agendar `select generate_pmoc_service_orders(7);` (pg_cron ou
   Vercel Cron chamando RPC) — gera as OS de preventiva automaticamente.
