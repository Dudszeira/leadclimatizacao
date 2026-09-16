-- ============================================================================
-- Control Lead — Migration 0003: funções e views de apoio
-- (geração automática de OS de PMOC + agregados do dashboard)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Geração automática de OS preventivas a partir dos planos de PMOC.
-- Chamável por pg_cron ou Edge Function agendada, ex.:
--   select cron.schedule('pmoc-diario', '0 6 * * *',
--     $$select public.generate_pmoc_service_orders(0)$$);
--
-- p_janela_dias: antecedência. 0 = gera só planos vencidos/no dia;
--                7 = gera OS já para os planos que vencem na próxima semana.
-- Retorna a quantidade de OS criadas. Idempotente: não duplica enquanto
-- existir OS aberta/agendada/em_campo ligada ao plano.
-- ----------------------------------------------------------------------------
create or replace function public.generate_pmoc_service_orders(p_janela_dias integer default 0)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan   record;
  v_criadas integer := 0;
begin
  -- security definer: quando chamada por um usuário logado, exige admin
  -- (auth.uid() null = cron/edge function com service_role)
  if auth.uid() is not null and public.get_my_role() is distinct from 'admin' then
    raise exception 'Apenas admin pode gerar OS de PMOC manualmente';
  end if;

  for v_plan in
    select p.id, p.equipment_id, p.periodicidade_dias, p.proxima_data,
           p.checklist_template_id, e.building_id, e.codigo_interno
    from public.pmoc_plans p
    join public.equipment e on e.id = p.equipment_id
    where p.ativo
      and e.status <> 'inativo'
      and p.proxima_data <= current_date + p_janela_dias
    order by p.proxima_data
  loop
    -- pula se já existe OS em andamento para este plano
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
       case when v_plan.proxima_data < current_date then 'alta' else 'media' end::public.os_priority,
       'aberto', 'pmoc_auto', v_plan.building_id, v_plan.equipment_id,
       v_plan.id, v_plan.checklist_template_id,
       format('Manutenção preventiva PMOC — equipamento %s (vencimento %s)',
              v_plan.codigo_interno, to_char(v_plan.proxima_data, 'DD/MM/YYYY')),
       (v_plan.proxima_data::timestamptz + interval '9 hours'));

    -- reprograma a próxima visita a partir da data prevista
    update public.pmoc_plans
    set proxima_data = v_plan.proxima_data + v_plan.periodicidade_dias
    where id = v_plan.id;

    v_criadas := v_criadas + 1;
  end loop;

  return v_criadas;
end;
$$;

revoke all on function public.generate_pmoc_service_orders(integer) from public;
grant execute on function public.generate_pmoc_service_orders(integer) to service_role;
-- admin pode disparar manualmente pelo painel:
grant execute on function public.generate_pmoc_service_orders(integer) to authenticated;

-- ----------------------------------------------------------------------------
-- VIEWS DO DASHBOARD
-- security_invoker: a RLS do usuário logado se aplica às tabelas base.
-- ----------------------------------------------------------------------------

-- Chamados por mês (últimos 12 meses), por tipo e status
create or replace view public.vw_dashboard_chamados_por_mes
with (security_invoker = on) as
select
  date_trunc('month', so.created_at)::date            as mes,
  so.tipo,
  so.status,
  count(*)                                            as total
from public.service_orders so
where so.created_at >= date_trunc('month', current_date) - interval '11 months'
group by 1, 2, 3
order by 1, 2, 3;

-- Funil comercial do mês corrente (contagem e valor por estágio)
create or replace view public.vw_dashboard_funil_mes
with (security_invoker = on) as
select
  l.estagio,
  count(*)                                            as total,
  coalesce(sum(l.valor_estimado), 0)::numeric(14,2)   as valor_estimado_total
from public.leads l
where l.created_at >= date_trunc('month', current_date)
group by 1
order by 1;

-- Situação dos planos PMOC: em_dia / vencendo (<= 7 dias) / atrasado
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
  (p.proxima_data - current_date)        as dias_para_vencer,
  case
    when p.proxima_data < current_date                  then 'atrasado'
    when p.proxima_data <= current_date + 7             then 'vencendo'
    else 'em_dia'
  end                                    as situacao
from public.pmoc_plans p
join public.equipment e on e.id = p.equipment_id
join public.buildings b on b.id = e.building_id
join public.clients   c on c.id = b.client_id
where p.ativo
order by p.proxima_data;

-- Faturamento por competência (últimos 6 meses + mês corrente):
-- previsto (tudo que não foi cancelado), recebido, pendente e atrasado
create or replace view public.vw_dashboard_faturamento
with (security_invoker = on) as
select
  i.competencia                                                       as mes,
  sum(i.valor) filter (where i.status <> 'cancelado')                 as previsto,
  coalesce(sum(i.valor) filter (where i.status = 'pago'), 0)          as recebido,
  coalesce(sum(i.valor) filter (where i.status = 'pendente'), 0)      as pendente,
  coalesce(sum(i.valor) filter (where i.status = 'atrasado'), 0)      as atrasado
from public.invoices i
where i.competencia >= date_trunc('month', current_date)::date - interval '6 months'
group by 1
order by 1;

-- ----------------------------------------------------------------------------
-- Resumo geral em uma chamada (cards do topo do dashboard).
-- security invoker (padrão de função SQL sem definer): respeita a RLS.
-- ----------------------------------------------------------------------------
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
                            and concluded_at >= date_trunc('month', current_date)),
    'equip_com_chamado', (select count(*) from public.equipment
                          where status in ('chamado_aberto', 'tecnico_em_campo')),
    'pmoc_atrasados',    (select count(*) from public.pmoc_plans
                          where ativo and proxima_data < current_date),
    'pmoc_vencendo_7d',  (select count(*) from public.pmoc_plans
                          where ativo and proxima_data between current_date
                            and current_date + 7),
    'leads_mes',         (select count(*) from public.leads
                          where created_at >= date_trunc('month', current_date)),
    'faturamento_previsto_mes',
                         (select coalesce(sum(valor), 0) from public.invoices
                          where competencia = date_trunc('month', current_date)::date
                            and status <> 'cancelado'),
    'faturamento_recebido_mes',
                         (select coalesce(sum(valor), 0) from public.invoices
                          where competencia = date_trunc('month', current_date)::date
                            and status = 'pago')
  );
$$;

grant execute on function public.dashboard_resumo() to authenticated;
