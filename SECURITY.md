# Segurança do Control Lead

Nível alvo: L2 (sistema com usuários, dados pessoais de clientes e pagamentos). Última revisão: 14/10/2026.

## Modelo de acesso

- Papéis: `admin`, `atendente`, `tecnico`. Cliente final não tem login na Fase 1.
- Usuário novo nasce `tecnico` e `ativo=false`, sem acesso a nada. Só um admin ativa e define o papel (tela /equipe, RPC `admin_set_user_access`). O papel enviado no cadastro é ignorado.
- O cadastro público precisa ficar DESLIGADO no Supabase (Authentication, "Allow new users to sign up"). Entrada só por convite.
- Desativar um usuário: `get_my_role()` passa a devolver null (perde acesso a todas as tabelas) e a conta Auth recebe ban, o que derruba a renovação da sessão.
- Autorização em três camadas: `src/proxy.ts` (sessão), `requireRole` em cada página e `authorizeAction`/`authorizeServiceOrder` em cada server action (`src/server/auth.ts`), e a RLS no banco como última barreira.

## Regras críticas no banco

- Técnico só lê e edita as OS em que é o técnico designado, e só as colunas da lista permitida (checklist, laudo, observações, check-in, início do atendimento).
- Conclusão de OS só pela RPC `concluir_os`, que exige checklist obrigatório respondido, foto "depois" no Storage e assinatura no prefixo da própria OS. `concluded_at` é gravado pelo banco. Isso protege o PMOC (Lei 13.589/2018) contra conclusão sem evidência.
- Fotos e assinaturas em buckets privados (`os-fotos`, `os-assinaturas`), caminho `<os_id>/<arquivo>`, tipo e tamanho limitados no bucket, URLs assinadas de 10 minutos. Técnico não apaga nem sobrescreve evidência.
- Funções de job (`_*_job`) não têm grant para ninguém; rodam só pelo pg_cron.
- Testes: `npm test` roda a suíte, incluindo `tests/db/rls.test.ts` (PGlite com stubs do Supabase).

## Segredos

| Variável | Onde mora | Observação |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (env de servidor) | Usada só no webhook, na listagem da equipe e no convite, sempre após checar admin. Nunca com prefixo `NEXT_PUBLIC_`. |
| `ASAAS_API_KEY` | Vercel | Sandbox até a conta da Lead ser aprovada. |
| `ASAAS_WEBHOOK_TOKEN` | Vercel e painel Asaas | Obrigatório. Sem ele o webhook responde 503. |
| `NEXT_PUBLIC_SITE_URL` | Vercel | Obrigatória em produção. Base dos links de convite e de nova senha. |
| `DEMO_MODE` | Só local | Recusado em produção (`VERCEL_ENV=production` ou com service role presente). |

`.env*` está no `.gitignore`. Nunca rodar `supabase/seed.sql` no projeto de produção (contém senha conhecida).

## Webhook Asaas

- Token comparado em tempo constante, corpo limitado a 64 KB, payload validado com zod.
- Idempotente por id do evento (`webhook_events`). Falha de banco responde 500 para o Asaas reenviar.
- Antes de marcar como pago, o pagamento é confirmado no Asaas (`GET /payments/{id}`) com conferência de status, valor e referência.

## LGPD

- `webhook_events` guarda só o mínimo (ids, status, valores, datas), sem nome, CPF ou e-mail do pagador, e é limpo após 90 dias.
- Logs de erro registram só código e mensagem, com valores de chave mascarados.

## Headers

CSP com nonce por requisição e `strict-dynamic`, HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, nosniff, Referrer-Policy e Permissions-Policy (câmera e geolocalização só no próprio app).

## A verificar no Supabase hospedado (não coberto pelos testes locais)

- Cadastro público desligado, Site URL e Redirect URLs restritos ao domínio do app.
- Templates de e-mail de convite e recuperação apontando para `/auth/callback?token_hash=...&next=/auth/nova-senha`.
- `pg_cron` e `pg_net` habilitados e jobs listados em `cron.job`.
- As RPCs `concluir_os` e `registrar_assinatura` conseguem ler `storage.objects` como owner.
- Rate limit do Auth (padrão do Supabase) adequado para o login.

## Backup

Plano Free do Supabase não tem backup automático. Recomendação: plano Pro (backup diário) antes do go-live, ou dump agendado com `pg_dump` para armazenamento do cliente.

## Resposta a incidente

1. Suspeita de credencial vazada: girar a chave no painel (Supabase service role, Asaas, token do webhook), atualizar na Vercel e redeployar.
2. Conta de funcionário comprometida: desativar em /equipe (ban imediato) e revisar as OS e faturas alteradas por ela.
3. Evento de pagamento suspeito: conferir `webhook_events.error` e o pagamento no painel Asaas antes de qualquer correção manual.
