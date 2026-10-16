-- ============================================================================
-- Control Lead — Migration 0009: hardening (Onda 3J)
--  * OS: guard por LISTA DE COLUNAS PERMITIDAS ao técnico (allowlist);
--    evidências (fotos_antes/fotos_depois/assinatura) e conclusão só por RPC
--    (registrar_assinatura / concluir_os), nunca por UPDATE direto via PostgREST
--  * concluded_at: carimbo do servidor na conclusão (só admin corrige)
--  * profiles: só usuário ATIVO edita o próprio perfil, e só nome/telefone/avatar
--  * webhook_events: limpeza diária (pg_cron) de eventos processados > 90 dias
-- Idempotente: pode ser reaplicada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Guard de UPDATE em service_orders (substitui o de 0004)
--    Vale só para chamadas pela API (current_user anon/authenticated); funções
--    security definer (RPCs abaixo, cron, triggers) rodam como owner.
--
--    Técnico: só altera as colunas da allowlist, só na OS aberta/agendada/em
--    campo, e só move aberto|agendado -> em_campo. Concluir = concluir_os().
--    Não-admin (técnico e atendente): não grava fotos_antes/fotos_depois/
--    assinatura_path/assinado_por_nome/assinado_em, não leva a OS a concluido
--    e não altera concluded_at diretamente.
-- ----------------------------------------------------------------------------
create or replace function public.guard_tecnico_os_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_api  boolean := current_user in ('anon', 'authenticated');
  v_role public.user_role := public.get_my_role();
  -- colunas que o técnico pode mudar (o resto da linha precisa ficar igual)
  v_tecnico_pode constant text[] := array[
    'checklist_respostas', 'laudo', 'observacoes_tecnicas',
    'checkin_lat', 'checkin_lng', 'checkin_at',
    'status', 'updated_at'
  ];
begin
  if v_api and v_role = 'tecnico' then
    if old.status in ('concluido', 'cancelado') then
      raise exception 'OS % já está %; técnico não pode alterá-la', old.numero, old.status
        using errcode = '42501';
    end if;

    if (to_jsonb(new) - v_tecnico_pode) is distinct from (to_jsonb(old) - v_tecnico_pode) then
      raise exception 'Técnico só pode atualizar check-in, checklist, laudo e observações da OS (fotos, assinatura e conclusão passam pelo fluxo de conclusão)'
        using errcode = '42501';
    end if;

    if new.status is distinct from old.status
       and not (old.status in ('aberto', 'agendado') and new.status = 'em_campo') then
      raise exception 'Transição de status inválida para técnico: % -> % (para concluir use o fluxo de conclusão)',
        old.status, new.status
        using errcode = '42501';
    end if;

    if new.checklist_respostas is distinct from old.checklist_respostas
       and new.checklist_respostas is not null
       and (jsonb_typeof(new.checklist_respostas) <> 'object'
            or pg_column_size(new.checklist_respostas) > 32768) then
      raise exception 'Checklist inválido ou grande demais (máx. 32 KB)' using errcode = '22023';
    end if;

    if coalesce(length(new.laudo), 0) > 8000
       or coalesce(length(new.observacoes_tecnicas), 0) > 8000 then
      raise exception 'Laudo/observações muito longos (máx. 8000 caracteres)' using errcode = '22023';
    end if;
  end if;

  if v_api and v_role is distinct from 'admin' then
    if new.fotos_antes       is distinct from old.fotos_antes
       or new.fotos_depois      is distinct from old.fotos_depois
       or new.assinatura_path   is distinct from old.assinatura_path
       or new.assinado_por_nome is distinct from old.assinado_por_nome
       or new.assinado_em       is distinct from old.assinado_em then
      raise exception 'Evidências (fotos e assinatura) só podem ser registradas pelo fluxo da OS'
        using errcode = '42501';
    end if;

    if new.status = 'concluido' and old.status is distinct from 'concluido' then
      raise exception 'A OS só pode ser concluída pelo fluxo de conclusão (com fotos e assinatura)'
        using errcode = '42501';
    end if;

    if new.concluded_at is distinct from old.concluded_at then
      raise exception 'Apenas admin pode alterar a data de conclusão da OS'
        using errcode = '42501';
    end if;
  end if;

  -- carimbo de conclusão: servidor é a fonte da verdade. Só admin (logado e
  -- ativo) pode informar outra data; qualquer outro contexto recebe now().
  if new.status = 'concluido' and old.status is distinct from 'concluido' then
    if v_role is distinct from 'admin' or new.concluded_at is null then
      new.concluded_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_tecnico_os_update on public.service_orders;
create trigger guard_tecnico_os_update
  before update on public.service_orders
  for each row execute function public.guard_tecnico_os_update();

-- ----------------------------------------------------------------------------
-- 2. Helpers de evidência
-- ----------------------------------------------------------------------------

-- Quantos itens obrigatórios do template estão sem resposta válida.
-- Regra igual à da UI (execution-rules.ts): obrigatorio explícito vence;
-- senão checkbox/numero obrigatórios e texto opcional.
create or replace function public.os_checklist_pendentes(p_itens jsonb, p_respostas jsonb)
returns integer
language sql
immutable
set search_path = public
as $$
  select count(*)::integer
  from jsonb_array_elements(
         case when jsonb_typeof(p_itens) = 'array' then p_itens else '[]'::jsonb end
       ) as item
  where case
          when jsonb_typeof(item -> 'obrigatorio') = 'boolean' then (item ->> 'obrigatorio')::boolean
          else coalesce(item ->> 'tipo', '') <> 'texto'
        end
    and not coalesce(
      case item ->> 'tipo'
        when 'checkbox' then jsonb_typeof(coalesce(p_respostas, '{}'::jsonb) -> (item ->> 'id')) = 'boolean'
        when 'numero'   then jsonb_typeof(coalesce(p_respostas, '{}'::jsonb) -> (item ->> 'id')) = 'number'
        when 'texto'    then jsonb_typeof(coalesce(p_respostas, '{}'::jsonb) -> (item ->> 'id')) = 'string'
                             and length(btrim(coalesce(p_respostas, '{}'::jsonb) ->> (item ->> 'id'))) > 0
        else false
      end,
      false
    );
$$;

revoke all on function public.os_checklist_pendentes(jsonb, jsonb) from public, anon;
grant execute on function public.os_checklist_pendentes(jsonb, jsonb) to authenticated, service_role;

-- Confere quem chama, trava a OS e devolve a linha. Técnico: só a OS dele.
create or replace function public._os_lock_for_execution(p_os uuid)
returns public.service_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role := public.get_my_role();
  v_os   public.service_orders;
begin
  if v_role is null then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if p_os is null then
    raise exception 'OS obrigatória' using errcode = '22004';
  end if;

  select * into v_os from public.service_orders where id = p_os for update;
  if not found then
    raise exception 'OS não encontrada' using errcode = 'P0002';
  end if;
  if v_role = 'tecnico' and v_os.technician_id is distinct from auth.uid() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  if v_os.status <> 'em_campo' then
    raise exception 'A OS precisa estar em campo (status atual: %)', v_os.status using errcode = 'P0001';
  end if;
  return v_os;
end;
$$;

revoke all on function public._os_lock_for_execution(uuid) from public, anon, authenticated, service_role;

-- Assinatura: caminho '<os>/<arquivo>' no bucket os-assinaturas e objeto existente.
create or replace function public._os_check_assinatura(p_os uuid, p_path text, p_nome text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_path is null or p_nome is null or length(btrim(p_nome)) < 3 then
    raise exception 'Colete a assinatura e o nome do responsável no local.' using errcode = 'P0001';
  end if;
  if length(btrim(p_nome)) > 120 then
    raise exception 'Nome de quem assinou muito longo (máx. 120).' using errcode = 'P0001';
  end if;
  if left(p_path, length(p_os::text) + 1) <> p_os::text || '/'
     or position('..' in p_path) > 0
     or length(p_path) > 250 then
    raise exception 'Caminho da assinatura inválido para esta OS.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'os-assinaturas' and o.name = p_path
  ) then
    raise exception 'Arquivo da assinatura não encontrado — envie novamente.' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public._os_check_assinatura(uuid, text, text) from public, anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. registrar_assinatura: grava assinatura + nome + momento (OS em campo)
-- ----------------------------------------------------------------------------
create or replace function public.registrar_assinatura(
  p_os                uuid,
  p_assinatura_path   text,
  p_assinado_por_nome text
)
returns public.service_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_os public.service_orders;
begin
  v_os := public._os_lock_for_execution(p_os);
  perform public._os_check_assinatura(p_os, p_assinatura_path, p_assinado_por_nome);

  update public.service_orders
     set assinatura_path   = p_assinatura_path,
         assinado_por_nome = btrim(p_assinado_por_nome),
         assinado_em       = now()
   where id = p_os
  returning * into v_os;
  return v_os;
end;
$$;

revoke all on function public.registrar_assinatura(uuid, text, text) from public, anon;
grant execute on function public.registrar_assinatura(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. concluir_os: em_campo -> concluido SÓ com evidência
--    - técnico dono da OS, ou admin/atendente
--    - checklist obrigatório respondido conforme o template
--    - >= 1 foto "depois" registrada E existente no bucket os-fotos
--    - assinatura em os-assinaturas/<os>/... existente + nome
--    p_assinatura_path / p_assinado_por_nome nulos = usa a já registrada.
-- ----------------------------------------------------------------------------
create or replace function public.concluir_os(
  p_os                uuid,
  p_assinatura_path   text default null,
  p_assinado_por_nome text default null
)
returns public.service_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_os         public.service_orders;
  v_itens      jsonb;
  v_pendentes  integer;
  v_path       text;
  v_nome       text;
begin
  v_os := public._os_lock_for_execution(p_os);

  if v_os.checklist_template_id is not null then
    select t.itens into v_itens from public.checklist_templates t where t.id = v_os.checklist_template_id;
    v_pendentes := public.os_checklist_pendentes(v_itens, v_os.checklist_respostas);
    if v_pendentes > 0 then
      raise exception 'Responda os % item(ns) obrigatório(s) do checklist.', v_pendentes using errcode = 'P0001';
    end if;
  end if;

  if not exists (
    select 1
    from public.service_order_photos f
    join storage.objects o on o.bucket_id = 'os-fotos' and o.name = f.storage_path
    where f.service_order_id = p_os and f.etapa = 'depois'
  ) then
    raise exception 'Envie pelo menos 1 foto "depois" do serviço.' using errcode = 'P0001';
  end if;

  v_path := coalesce(p_assinatura_path, v_os.assinatura_path);
  v_nome := coalesce(p_assinado_por_nome, v_os.assinado_por_nome);
  perform public._os_check_assinatura(p_os, v_path, v_nome);

  update public.service_orders
     set assinatura_path   = v_path,
         assinado_por_nome = btrim(v_nome),
         assinado_em       = case
                               when v_path = v_os.assinatura_path and v_os.assinado_em is not null
                                 then v_os.assinado_em
                               else now()
                             end,
         status            = 'concluido',
         concluded_at      = now()
   where id = p_os
  returning * into v_os;
  return v_os;
end;
$$;

revoke all on function public.concluir_os(uuid, text, text) from public, anon;
grant execute on function public.concluir_os(uuid, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. profiles: só usuário ATIVO edita o próprio perfil, e só nome/telefone/
--    avatar. Papel/ativo continuam com guard_profile_role_change (0004).
-- ----------------------------------------------------------------------------
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid() and public.get_my_role() is not null)
  with check (id = auth.uid() and public.get_my_role() is not null);

create or replace function public.guard_profile_self_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_pode constant text[] := array['full_name', 'phone', 'avatar_url', 'updated_at'];
begin
  if current_user in ('anon', 'authenticated')
     and public.get_my_role() is distinct from 'admin' then
    if public.get_my_role() is null then
      raise exception 'Usuário inativo não pode alterar o perfil' using errcode = '42501';
    end if;
    if (to_jsonb(new) - v_pode) is distinct from (to_jsonb(old) - v_pode) then
      raise exception 'Você só pode alterar nome, telefone e foto do perfil' using errcode = '42501';
    end if;
    if length(btrim(coalesce(new.full_name, ''))) < 2 or length(new.full_name) > 120
       or coalesce(length(new.phone), 0) > 30
       or coalesce(length(new.avatar_url), 0) > 500 then
      raise exception 'Dados do perfil inválidos' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

-- nome ordena depois de guard_profile_role_change (triggers BEFORE rodam em ordem alfabética)
drop trigger if exists guard_profile_self_update on public.profiles;
create trigger guard_profile_self_update
  before update on public.profiles
  for each row execute function public.guard_profile_self_update();

-- ----------------------------------------------------------------------------
-- 6. LGPD: retenção de webhook_events (processados há mais de 90 dias)
-- ----------------------------------------------------------------------------
create or replace function public._purge_webhook_events_job()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd integer;
begin
  delete from public.webhook_events
   where processed_at is not null
     and processed_at < now() - interval '90 days';
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

revoke all on function public._purge_webhook_events_job() from public, anon, authenticated, service_role;

-- @cron-begin
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'control-lead-webhook-retencao';
    perform cron.schedule(
      'control-lead-webhook-retencao',
      '30 6 * * *',
      'select public._purge_webhook_events_job()'
    );
  end if;
end
$cron$;
-- @cron-end
