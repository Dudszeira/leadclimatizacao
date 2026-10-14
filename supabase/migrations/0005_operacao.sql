-- ============================================================================
-- Control Lead — Migration 0005: operação (OS -> equipamento, PMOC, cron, fuso)
-- Idempotente: pode ser reaplicada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Status do equipamento derivado das OS em andamento
--    em_campo (qualquer tipo)            -> tecnico_em_campo
--    corretiva aberto/agendado           -> chamado_aberto
--    nada em andamento                   -> operacional
--    Equipamento 'inativo' nunca é tocado.
-- ----------------------------------------------------------------------------
create or replace function public.recalc_equipment_status(p_equipment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_novo public.equipment_status;
begin
  if p_equipment_id is null then
    return;
  end if;

  select case
           when bool_or(so.status = 'em_campo') then 'tecnico_em_campo'
           when bool_or(so.tipo = 'corretiva' and so.status in ('aberto', 'agendado')) then 'chamado_aberto'
           else 'operacional'
         end::public.equipment_status
    into v_novo
    from public.service_orders so
   where so.equipment_id = p_equipment_id
     and so.status in ('aberto', 'agendado', 'em_campo');

  update public.equipment
     set status = coalesce(v_novo, 'operacional')
   where id = p_equipment_id
     and status <> 'inativo'
     and status is distinct from coalesce(v_novo, 'operacional');
end;
$$;

revoke all on function public.recalc_equipment_status(uuid) from public, anon, authenticated;

create or replace function public.sync_equipment_status_from_os()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- OS já nascida concluída/cancelada (histórico/importação) não mexe no equipamento
    if new.status in ('aberto', 'agendado', 'em_campo') then
      perform public.recalc_equipment_status(new.equipment_id);
    end if;
    return new;
  end if;

  if new.status is distinct from old.status
     or new.equipment_id is distinct from old.equipment_id
     or new.tipo is distinct from old.tipo then
    perform public.recalc_equipment_status(new.equipment_id);
    if old.equipment_id is distinct from new.equipment_id then
      perform public.recalc_equipment_status(old.equipment_id);
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_equipment_status_from_os() from public, anon, authenticated;

drop trigger if exists sync_equipment_status_from_os on public.service_orders;
create trigger sync_equipment_status_from_os
  after insert or update on public.service_orders
  for each row execute function public.sync_equipment_status_from_os();

-- ----------------------------------------------------------------------------
-- 2. PMOC: proxima_data avança na CONCLUSÃO da OS (não mais na geração).
--    proxima_data = data de conclusão (BRT) + periodicidade_dias.
-- ----------------------------------------------------------------------------
create or replace function public.reschedule_pmoc_on_os_conclusion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pmoc_plan_id is not null
     and new.status = 'concluido'
     and old.status is distinct from 'concluido' then
    update public.pmoc_plans p
       set proxima_data = (coalesce(new.concluded_at, now()) at time zone 'America/Sao_Paulo')::date
                          + p.periodicidade_dias
     where p.id = new.pmoc_plan_id;
  end if;
  return new;
end;
$$;

revoke all on function public.reschedule_pmoc_on_os_conclusion() from public, anon, authenticated;

drop trigger if exists reschedule_pmoc_on_os_conclusion on public.service_orders;
create trigger reschedule_pmoc_on_os_conclusion
  after update on public.service_orders
  for each row execute function public.reschedule_pmoc_on_os_conclusion();

-- ----------------------------------------------------------------------------
-- 3. Geração de OS de PMOC
--    _generate_pmoc_service_orders_job: núcleo sem checagem (só pg_cron/owner)
--    generate_pmoc_service_orders: mesma assinatura de 0003, exige admin
--    quando chamada por usuário logado.
--    Idempotência: não cria se já existir OS aberta/agendada/em_campo do plano.
--    Horário: proxima_data às 09:00 de Curitiba.
-- ----------------------------------------------------------------------------
create or replace function public._generate_pmoc_service_orders_job(p_janela_dias integer default 0)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan    record;
  v_hoje    date := public.hoje_brt();
  v_criadas integer := 0;
begin
  for v_plan in
    select p.id, p.equipment_id, p.periodicidade_dias, p.proxima_data,
           p.checklist_template_id, e.building_id, e.codigo_interno
    from public.pmoc_plans p
    join public.equipment e on e.id = p.equipment_id
    where p.ativo
      and e.status <> 'inativo'
      and p.proxima_data <= v_hoje + greatest(coalesce(p_janela_dias, 0), 0)
    order by p.proxima_data
    for update of p
  loop
    if exists (
      select 1 from public.service_orders so
      where so.pmoc_plan_id = v_plan.id
        and so.status in ('aberto', 'agendado', 'em_campo')
    ) then
      continue;
    end if;

    insert into public.service_orders
      (tipo, prioridade, status, origem, building_id, equipment_id,
       pmoc_plan_id, checklist_template_id, descricao, scheduled_at)
    values
      ('preventiva_pmoc',
       case when v_plan.proxima_data < v_hoje then 'alta' else 'media' end::public.os_priority,
       'aberto', 'pmoc_auto', v_plan.building_id, v_plan.equipment_id,
       v_plan.id, v_plan.checklist_template_id,
       format('Manutenção preventiva PMOC — equipamento %s (vencimento %s)',
              v_plan.codigo_interno, to_char(v_plan.proxima_data, 'DD/MM/YYYY')),
       (v_plan.proxima_data + time '09:00') at time zone 'America/Sao_Paulo');

    -- proxima_data NÃO avança aqui: reschedule_pmoc_on_os_conclusion faz isso
    v_criadas := v_criadas + 1;
  end loop;

  return v_criadas;
end;
$$;

revoke all on function public._generate_pmoc_service_orders_job(integer) from public, anon, authenticated, service_role;

create or replace function public.generate_pmoc_service_orders(p_janela_dias integer default 0)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() null = service_role/cron; usuário logado precisa ser admin ativo
  if auth.uid() is not null and public.get_my_role() is distinct from 'admin' then
    raise exception 'Apenas admin pode gerar OS de PMOC manualmente' using errcode = '42501';
  end if;
  return public._generate_pmoc_service_orders_job(p_janela_dias);
end;
$$;

revoke all on function public.generate_pmoc_service_orders(integer) from public, anon;
grant execute on function public.generate_pmoc_service_orders(integer) to service_role, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Fuso: dashboard e views passam a usar a data de Curitiba (hoje_brt)
-- ----------------------------------------------------------------------------
create or replace view public.vw_dashboard_chamados_por_mes
with (security_invoker = on) as
select
  date_trunc('month', so.created_at)::date            as mes,
  so.tipo,
  so.status,
  count(*)                                            as total
from public.service_orders so
where so.created_at >= date_trunc('month', public.hoje_brt()) - interval '11 months'
group by 1, 2, 3
order by 1, 2, 3;

create or replace view public.vw_dashboard_funil_mes
with (security_invoker = on) as
select
  l.estagio,
  count(*)                                            as total,
  coalesce(sum(l.valor_estimado), 0)::numeric(14,2)   as valor_estimado_total
from public.leads l
where l.created_at >= date_trunc('month', public.hoje_brt())
group by 1
order by 1;

create or replace view public.vw_dashboard_pmoc_situacao
with (security_invoker = on) as
select
  p.id                                   as pmoc_plan_id,
  c.razao_social                         as cliente,
  b.nome                                 as predio,
  e.codigo_interno,
  e.tipo                                 as equipamento_tipo,
  p.periodicidade_dias,
  p.proxima_data,
  (p.proxima_data - public.hoje_brt())   as dias_para_vencer,
  case
    when p.proxima_data < public.hoje_brt()      then 'atrasado'
    when p.proxima_data <= public.hoje_brt() + 7 then 'vencendo'
    else 'em_dia'
  end                                    as situacao
from public.pmoc_plans p
join public.equipment e on e.id = p.equipment_id
join public.buildings b on b.id = e.building_id
join public.clients   c on c.id = b.client_id
where p.ativo
order by p.proxima_data;

create or replace view public.vw_dashboard_faturamento
with (security_invoker = on) as
select
  i.competencia                                                       as mes,
  sum(i.valor) filter (where i.status <> 'cancelado')                 as previsto,
  coalesce(sum(i.valor) filter (where i.status = 'pago'), 0)          as recebido,
  coalesce(sum(i.valor) filter (where i.status = 'pendente'), 0)      as pendente,
  coalesce(sum(i.valor) filter (where i.status = 'atrasado'), 0)      as atrasado
from public.invoices i
where i.competencia >= date_trunc('month', public.hoje_brt())::date - interval '6 months'
group by 1
order by 1;

create or replace function public.dashboard_resumo()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'os_abertas',        (select count(*) from public.service_orders where status = 'aberto'),
    'os_agendadas',      (select count(*) from public.service_orders where status = 'agendado'),
    'os_em_campo',       (select count(*) from public.service_orders where status = 'em_campo'),
    'os_concluidas_mes', (select count(*) from public.service_orders
                          where status = 'concluido'
                            and concluded_at >= (date_trunc('month', public.hoje_brt())::timestamp
                                                 at time zone 'America/Sao_Paulo')),
    'equip_com_chamado', (select count(*) from public.equipment
                          where status in ('chamado_aberto', 'tecnico_em_campo')),
    'pmoc_atrasados',    (select count(*) from public.pmoc_plans
                          where ativo and proxima_data < public.hoje_brt()),
    'pmoc_vencendo_7d',  (select count(*) from public.pmoc_plans
                          where ativo and proxima_data between public.hoje_brt()
                            and public.hoje_brt() + 7),
    'leads_mes',         (select count(*) from public.leads
                          where created_at >= (date_trunc('month', public.hoje_brt())::timestamp
                                               at time zone 'America/Sao_Paulo')),
    'faturamento_previsto_mes',
                         (select coalesce(sum(valor), 0) from public.invoices
                          where competencia = date_trunc('month', public.hoje_brt())::date
                            and status <> 'cancelado'),
    'faturamento_recebido_mes',
                         (select coalesce(sum(valor), 0) from public.invoices
                          where competencia = date_trunc('month', public.hoje_brt())::date
                            and status = 'pago')
  );
$$;

revoke all on function public.dashboard_resumo() from public, anon;
grant execute on function public.dashboard_resumo() to authenticated;

-- ----------------------------------------------------------------------------
-- 5. pg_cron: PMOC diário às 06:00 BRT (09:00 UTC)
-- Só roda onde pg_cron está disponível (Supabase). Em ambientes sem a
-- extensão (PGlite/testes) o bloco é ignorado.
-- ----------------------------------------------------------------------------
-- @cron-begin
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'control-lead-pmoc-diario';
    perform cron.schedule(
      'control-lead-pmoc-diario',
      '0 9 * * *',
      'select public._generate_pmoc_service_orders_job(7)'
    );
  end if;
end
$cron$;
-- @cron-end
