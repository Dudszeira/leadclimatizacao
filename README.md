# Control Lead: Console de Operações da Lead Climatização

Sistema de gestão Fase 1: CRM por cliente/prédio, central de chamados/OS com calendário
de PMOC (Lei 13.589/2018), mapa de equipamentos, dashboard único e financeiro/fiscal.

Fora do go-live da Fase 1: Atendimento IA e integração com WhatsApp. A tela
/atendimento continua disponível para consultar, transferir e encerrar conversas já
registradas, mas o envio de mensagens fica bloqueado ("Envio pelo WhatsApp ainda não
configurado.") até um provedor ser plugado em `src/lib/messaging/`.

## Rodar local

```bash
npm install
npm run dev   # http://localhost:3000
npm test      # vitest (unitários + RLS em PGlite)
```

Sem `.env`, o app roda em **modo demo**: todas as telas funcionam com dados fictícios
equivalentes ao `supabase/seed.sql`. Com as variáveis do Supabase preenchidas o modo demo
desliga sozinho (`src/lib/env.ts`).

## Stack

Next.js 16 (App Router), Tailwind v4, shadcn/ui (Base UI), Supabase (Postgres, Auth,
Storage, pg_cron), Leaflet/OSM, Asaas (cobranças e NFS-e), Vercel.

Contrato visual em `design-system/MASTER.md`: tema console dark único extraído da demo
aprovada pelo cliente.

## Estrutura

- `src/app/(console)/`: telas (dashboard, clientes, chamados, pmoc, mapa, atendimento, financeiro, equipe)
- `src/server/`: data layer (`Result<T>`, ver `src/server/README.md`) e server actions
- `src/lib/format.ts` e `src/lib/status-meta.ts`: formatadores e semântica de status únicos
- Datas: toda conta de calendário usa o fuso `America/Sao_Paulo` (`todayBRT`,
  `monthStartBRT`, `daysFromTodayBRT` em `src/lib/format.ts`, reexportados por
  `src/server/_shared.ts`); no banco, `public.hoje_brt()`
- `src/lib/asaas/`: integração Asaas (cliente, service, webhook em `/api/webhooks/asaas`)
- `src/lib/messaging/`: adapter de mensageria (WhatsApp pluga aqui; hoje bloqueia o envio)
- `supabase/migrations/` e `seed.sql`: schema completo com RLS por papel (admin/atendente/tecnico)

## Runbook de ativação

Ordem recomendada. Cada passo diz onde fazer e como conferir.

### 1. Banco (Supabase, conta do cliente)

1. Criar o projeto na região São Paulo.
2. Database > Extensions: habilitar **pg_cron** e **pg_net**. As migrations agendam os
   jobs só se o pg_cron estiver disponível; sem ele nada é agendado.
3. Aplicar as migrations 0001 a 0009 (nunca o seed):
   ```bash
   supabase link --project-ref <ref>
   supabase db push --include-seed=false
   ```
   - 0001 schema, 0002 RLS, 0003 funções e views do dashboard
   - 0004 segurança: `hoje_brt()`, cadastro nasce técnico inativo, guardas de papel,
     buckets privados `os-fotos` e `os-assinaturas` com policies (não há passo manual
     de Storage)
   - 0005 operação: status do equipamento pela OS, reagendamento PMOC, views em BRT,
     job `control-lead-pmoc-diario` (06:00 BRT)
   - 0006 financeiro: faturas mensais (dia 1, 06:00 BRT), faturas atrasadas (diário,
     06:05 BRT), idempotência do webhook
   - 0007 cadastros: número de série do equipamento, RT do plano PMOC, índices da
     importação CSV
   - 0008 NFS-e: número e link do PDF da nota na fatura
   - 0009 hardening: técnico só altera colunas permitidas da OS, evidências e
     conclusão só por RPC, job de retenção dos eventos do webhook
4. Conferir: `select jobname, schedule from cron.job;` deve listar os quatro jobs
   `control-lead-*`; Storage deve mostrar os dois buckets privados.
5. **`seed.sql` NUNCA em produção.** Ele cria usuários com senha fixa em `auth.users`.
   Use só em ambiente local ou staging descartável.

### 2. Autenticação (Supabase > Authentication)

1. Sign In / Providers > Email: **desligar "Allow new users to sign up"** (cadastro só
   por convite do admin).
2. URL Configuration:
   - Site URL: a URL pública do app (ex.: `https://controllead.com.br`), igual a
     `NEXT_PUBLIC_SITE_URL`.
   - Redirect URLs: `https://<dominio>/auth/callback` (e a URL de preview da Vercel, se
     for testar lá).
3. Email Templates:
   - **Invite user**: link
     `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/auth/nova-senha`
   - **Reset password (recovery)**: link
     `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/nova-senha`
4. Primeiro admin:
   1. Authentication > Users > Invite user com o e-mail do responsável.
   2. Ele abre o convite e define a senha em `/auth/nova-senha`. O perfil nasce
      `tecnico` e inativo.
   3. No SQL Editor, com o id do usuário:
      ```sql
      update public.profiles set role = 'admin', ativo = true where id = '<uuid>';
      ```
   4. Os demais usuários são convidados e ativados pela tela Equipe, já logado como admin.

### 3. Hospedagem (Vercel, conta do cliente)

Variáveis de ambiente (Production e Preview):

| Variável | Obrigatória | Observação |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | sim | sem ela a produção falha ao subir (de propósito) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | só servidor: convites da equipe e webhook |
| `NEXT_PUBLIC_SITE_URL` | sim | URL pública sem barra final; usada nos links de convite e recuperação |
| `ASAAS_API_KEY` | sim | chave sandbox até a conta real ser aprovada |
| `ASAAS_ENV` | sim | `sandbox` ou `production` |
| `ASAAS_WEBHOOK_TOKEN` | **sim** | sem ele o webhook rejeita todos os eventos |
| `DEMO_MODE` | não | deixe vazio em produção; `true` serve dados fictícios e dispensa login |
| `MESSAGING_PROVIDER` | não | deixe vazio: WhatsApp fora do go-live, envio bloqueado |

Depois do deploy, conferir que `/login` abre e que um usuário inativo é barrado.

### 4. Asaas

1. Painel Asaas > Integrações > Webhooks: URL `https://<dominio>/api/webhooks/asaas`,
   token de autenticação igual a `ASAAS_WEBHOOK_TOKEN`.
2. Gerar uma cobrança de teste no sandbox e conferir a baixa no Financeiro.

### 5. Verificação antes de liberar

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Checklist final:

- [ ] Migrations 0001 a 0009 aplicadas, pg_cron e pg_net habilitados, jobs em `cron.job`
- [ ] Buckets `os-fotos` e `os-assinaturas` criados pela 0004 (privados)
- [ ] Signup público desligado; templates de convite e recovery apontando para
      `/auth/callback` com `next=/auth/nova-senha`
- [ ] Site URL e Redirect URLs configurados; `NEXT_PUBLIC_SITE_URL` igual à Site URL
- [ ] Primeiro admin ativo; equipe convidada pela tela Equipe
- [ ] `DEMO_MODE` vazio em produção; `seed.sql` não aplicado em produção
- [ ] `ASAAS_WEBHOOK_TOKEN` definido e igual ao do painel Asaas
- [ ] `npm test` e `npm run build` verdes
