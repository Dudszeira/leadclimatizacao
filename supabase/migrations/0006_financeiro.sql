-- ============================================================================
-- Control Lead — Migration 0006: financeiro (Asaas, NFS-e, faturamento mensal)
-- Idempotente: pode ser reaplicada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. invoices: id da NFS-e no Asaas + unicidades
--    asaas_id (cobrança) já existe desde 0001.
-- ----------------------------------------------------------------------------
alter table public.invoices add column if not exists asaas_invoice_id text;

create unique index if not exists uq_invoices_asaas_invoice_id
  on public.invoices (asaas_invoice_id) where asaas_invoice_id is not null;

create unique index if not exists uq_invoices_asaas_id
  on public.invoices (asaas_id) where asaas_id is not null;

-- unique (contract_id, competencia) já existe em 0001; garante caso tenha sido removido
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.invoices'::regclass
      and c.contype = 'u'
      and (select array_agg(a.attname::text order by a.attname)
             from unnest(c.conkey) k
             join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k)
          = array['competencia', 'contract_id']
  ) then
    alter table public.invoices
      add constraint invoices_contract_id_competencia_key unique (contract_id, competencia);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. clients: dados fiscais para emissão de NFS-e
-- ----------------------------------------------------------------------------
alter table public.clients add column if not exists codigo_servico_municipal text;
alter table public.clients add column if not exists aliquota_iss numeric(5,2) not null default 5;
alter table public.clients add column if not exists reter_iss boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'clients_aliquota_iss_check'
                   and conrelid = 'public.clients'::regclass) then
    alter table public.clients
      add constraint clients_aliquota_iss_check check (aliquota_iss >= 0 and aliquota_iss <= 100);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3. webhook_events: log/idempotência dos webhooks do Asaas.
--    id = id do evento Asaas. RLS ligada SEM policy: só service_role acessa.
-- ----------------------------------------------------------------------------
create table if not exists public.webhook_events (
  id            text primary key,
  event         text not null,
  payload       jsonb not null default '{}'::jsonb,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text
);

create index if not exists idx_webhook_events_pendentes
  on public.webhook_events (received_at) where processed_at is null;

alter table public.webhook_events enable row level security;
revoke all on table public.webhook_events from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Faturamento mensal
--    Para cada contrato ATIVO (exceto corretiva_avulsa, que é cobrada por
--    atendimento) vigente na competência, cria a fatura se ainda não existir.
--    vencimento = competência + (dia_vencimento - 1)  (mesma regra do seed)
--    Retorna a quantidade criada.
-- ----------------------------------------------------------------------------
create or replace function public._generate_monthly_invoices_job(p_competencia date default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comp    date := date_trunc('month', coalesce(p_competencia, public.hoje_brt()))::date;
  v_fim_mes date := (date_trunc('month', coalesce(p_competencia, public.hoje_brt())) + interval '1 month - 1 day')::date;
  v_criadas integer;
begin
  insert into public.invoices (contract_id, competencia, valor, status, vencimento)
  select c.id, v_comp, c.valor_mensal, 'pendente', v_comp + (c.dia_vencimento - 1)
  from public.contracts c
  where c.status = 'ativo'
    and c.tipo <> 'corretiva_avulsa'
    and c.inicio <= v_fim_mes
    and (c.fim is null or c.fim >= v_comp)
  on conflict (contract_id, competencia) do nothing;

  get diagnostics v_criadas = row_count;
  return v_criadas;
end;
$$;

revoke all on function public._generate_monthly_invoices_job(date) from public, anon, authenticated, service_role;

create or replace function public.generate_monthly_invoices(
  p_competencia date default (date_trunc('month', (now() at time zone 'America/Sao_Paulo')))::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and public.get_my_role() is distinct from 'admin' then
    raise exception 'Apenas admin pode gerar faturas' using errcode = '42501';
  end if;
  return public._generate_monthly_invoices_job(p_competencia);
end;
$$;

revoke all on function public.generate_monthly_invoices(date) from public, anon;
grant execute on function public.generate_monthly_invoices(date) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Inadimplência: pendente com vencimento < hoje (BRT) -> atrasado
-- ----------------------------------------------------------------------------
create or replace function public._mark_overdue_invoices_job()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd integer;
begin
  update public.invoices
     set status = 'atrasado'
   where status = 'pendente'
     and vencimento is not null
     and vencimento < public.hoje_brt();
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

revoke all on function public._mark_overdue_invoices_job() from public, anon, authenticated, service_role;

create or replace function public.mark_overdue_invoices()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and public.get_my_role() is distinct from 'admin' then
    raise exception 'Apenas admin pode atualizar inadimplência' using errcode = '42501';
  end if;
  return public._mark_overdue_invoices_job();
end;
$$;

revoke all on function public.mark_overdue_invoices() from public, anon;
grant execute on function public.mark_overdue_invoices() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. pg_cron (Supabase). Ignorado onde a extensão não existe.
--    Faturas: dia 1 às 06:00 BRT (09:00 UTC) · Atrasos: diário 06:05 BRT
-- ----------------------------------------------------------------------------
-- @cron-begin
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job
      where jobname in ('control-lead-faturas-mensais', 'control-lead-faturas-atrasadas');
    perform cron.schedule(
      'control-lead-faturas-mensais',
      '0 9 1 * *',
      'select public._generate_monthly_invoices_job()'
    );
    perform cron.schedule(
      'control-lead-faturas-atrasadas',
      '5 9 * * *',
      'select public._mark_overdue_invoices_job()'
    );
  end if;
end
$cron$;
-- @cron-end
