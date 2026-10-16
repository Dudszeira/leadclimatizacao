-- ============================================================================
-- Control Lead — Migration 0004: endurecimento de segurança
--  * cadastro novo nasce tecnico/inativo (papel nunca vem do metadata)
--  * get_my_role() ignora perfis inativos
--  * guard de profiles (role/ativo) + admin_set_user_access()
--  * máquina de estados da OS para o técnico
--  * search_path fixo em triggers, grants do dashboard
--  * Storage: buckets os-fotos / os-assinaturas + policies
--  * evidências: service_order_photos + colunas de assinatura/laudo
-- Idempotente: pode ser reaplicada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper de data no fuso de Curitiba (usado por 0004..0006 e views)
-- ----------------------------------------------------------------------------
create or replace function public.hoje_brt()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- ----------------------------------------------------------------------------
-- 1. Cadastro: todo usuário novo nasce tecnico + inativo.
--    raw_user_meta_data.role é IGNORADO (o metadata é controlado pelo cliente
--    no signUp). Só admin ativa / define papel.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, ativo)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
             split_part(coalesce(new.email, ''), '@', 1),
             'Usuário'),
    'tecnico',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

alter table public.profiles alter column role  set default 'tecnico';
alter table public.profiles alter column ativo set default false;

-- ----------------------------------------------------------------------------
-- 2. get_my_role(): null quando o perfil não existe ou está inativo.
--    Todas as policies comparam get_my_role() = '<papel>', então usuário
--    inativo fica sem acesso a nada.
-- ----------------------------------------------------------------------------
create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and ativo;
$$;

revoke all on function public.get_my_role() from public, anon;
grant execute on function public.get_my_role() to authenticated, service_role;

-- profiles: usuário inativo enxerga só o próprio perfil (tela "aguardando
-- liberação"); ativos enxergam todos.
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all on public.profiles
  for select using (id = auth.uid() or public.get_my_role() is not null);

-- checklist_templates: só usuários ativos
drop policy if exists cht_select_all on public.checklist_templates;
create policy cht_select_all on public.checklist_templates
  for select using (public.get_my_role() is not null);

-- ----------------------------------------------------------------------------
-- 3. Guard de profiles: role e ativo só mudam por admin ativo ou por contexto
--    de serviço (service_role / migração / funções definer — current_user
--    diferente de anon/authenticated).
-- ----------------------------------------------------------------------------
create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.ativo is distinct from old.ativo)
     and current_user in ('anon', 'authenticated')
     and public.get_my_role() is distinct from 'admin' then
    raise exception 'Apenas admin pode alterar papel ou status de acesso de um usuário'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_role_change on public.profiles;
create trigger guard_profile_role_change
  before update on public.profiles
  for each row execute function public.guard_profile_role_change();

-- ----------------------------------------------------------------------------
-- 4. admin_set_user_access: ativa/desativa e define papel.
--    Bloqueia remover o último admin ativo (inclusive a si mesmo).
-- ----------------------------------------------------------------------------
create or replace function public.admin_set_user_access(
  p_user  uuid,
  p_role  public.user_role,
  p_ativo boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvo   public.profiles;
  v_admins integer;
begin
  if public.get_my_role() is distinct from 'admin' then
    raise exception 'Apenas admin ativo pode alterar acessos' using errcode = '42501';
  end if;
  if p_user is null or p_role is null or p_ativo is null then
    raise exception 'Parâmetros obrigatórios: usuário, papel e ativo' using errcode = '22004';
  end if;

  -- trava os admins ativos para evitar corrida entre dois rebaixamentos
  perform 1 from public.profiles where role = 'admin' and ativo for update;

  select * into v_alvo from public.profiles where id = p_user for update;
  if not found then
    raise exception 'Usuário não encontrado' using errcode = 'P0002';
  end if;

  if v_alvo.role = 'admin' and v_alvo.ativo
     and (p_role <> 'admin' or not p_ativo) then
    select count(*) into v_admins
    from public.profiles
    where role = 'admin' and ativo and id <> p_user;
    if v_admins = 0 then
      raise exception 'Não é possível remover o último admin ativo' using errcode = '42501';
    end if;
  end if;

  update public.profiles
     set role = p_role, ativo = p_ativo
   where id = p_user
  returning * into v_alvo;

  return v_alvo;
end;
$$;

revoke all on function public.admin_set_user_access(uuid, public.user_role, boolean) from public, anon;
grant execute on function public.admin_set_user_access(uuid, public.user_role, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Evidências da OS: colunas novas em service_orders
--    (checklist_respostas, laudo e assinatura_path já existem desde 0001)
-- ----------------------------------------------------------------------------
alter table public.service_orders add column if not exists checklist_respostas  jsonb;
alter table public.service_orders add column if not exists laudo                text;
alter table public.service_orders add column if not exists assinatura_path      text;
alter table public.service_orders add column if not exists assinado_por_nome    text;
alter table public.service_orders add column if not exists assinado_em          timestamptz;
alter table public.service_orders add column if not exists observacoes_tecnicas text;

-- ----------------------------------------------------------------------------
-- 6. Guard da OS para o técnico (máquina de estados a partir de old.status)
--    Fluxo: aberto -> agendado -> em_campo -> concluido
--    Técnico: {aberto, agendado} -> em_campo ; em_campo -> concluido.
--    cancelado: só admin/atendente. Técnico não mexe em OS concluída/cancelada.
--    concluded_at é preenchido aqui ao concluir (para todos os papéis).
-- ----------------------------------------------------------------------------
create or replace function public.guard_tecnico_os_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated')
     and public.get_my_role() = 'tecnico' then

    if old.status in ('concluido', 'cancelado') then
      raise exception 'OS % já está %; técnico não pode alterá-la', old.numero, old.status
        using errcode = '42501';
    end if;

    if new.numero        is distinct from old.numero
       or new.tipo          is distinct from old.tipo
       or new.prioridade    is distinct from old.prioridade
       or new.origem        is distinct from old.origem
       or new.building_id   is distinct from old.building_id
       or new.equipment_id  is distinct from old.equipment_id
       or new.pmoc_plan_id  is distinct from old.pmoc_plan_id
       or new.technician_id is distinct from old.technician_id
       or new.descricao     is distinct from old.descricao
       or new.scheduled_at  is distinct from old.scheduled_at
       or new.concluded_at  is distinct from old.concluded_at
       or new.created_by    is distinct from old.created_by
       or new.created_at    is distinct from old.created_at
       or new.checklist_template_id is distinct from old.checklist_template_id
    then
      raise exception 'Técnico só pode atualizar check-in, checklist, fotos, laudo, observações, assinatura e status da OS'
        using errcode = '42501';
    end if;

    if new.status is distinct from old.status then
      if not (
           (old.status in ('aberto', 'agendado') and new.status = 'em_campo')
        or (old.status = 'em_campo' and new.status = 'concluido')
      ) then
        raise exception 'Transição de status inválida para técnico: % -> %', old.status, new.status
          using errcode = '42501';
      end if;
    end if;
  end if;

  -- carimbo de conclusão (servidor é a fonte da verdade)
  if new.status = 'concluido' and old.status is distinct from 'concluido'
     and new.concluded_at is null then
    new.concluded_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists guard_tecnico_os_update on public.service_orders;
create trigger guard_tecnico_os_update
  before update on public.service_orders
  for each row execute function public.guard_tecnico_os_update();

-- ----------------------------------------------------------------------------
-- 7. search_path fixo em funções de trigger + grants do dashboard
-- ----------------------------------------------------------------------------
alter function public.set_updated_at() set search_path = public;

revoke all on function public.dashboard_resumo() from public, anon;
grant execute on function public.dashboard_resumo() to authenticated;

-- ----------------------------------------------------------------------------
-- 8. service_order_photos (evidências fotográficas)
-- storage_path = '<service_order_id>/<arquivo>' no bucket os-fotos
-- ----------------------------------------------------------------------------
create table if not exists public.service_order_photos (
  id                uuid primary key default gen_random_uuid(),
  service_order_id  uuid not null references public.service_orders (id) on delete cascade,
  storage_path      text not null unique,
  legenda           text,
  etapa             text check (etapa is null or etapa in ('antes', 'depois')),
  created_by        uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  constraint service_order_photos_path_prefix
    check (split_part(storage_path, '/', 1) = service_order_id::text)
);

create index if not exists idx_os_photos_os on public.service_order_photos (service_order_id, created_at);

alter table public.service_order_photos enable row level security;

drop policy if exists os_photos_admin_all      on public.service_order_photos;
drop policy if exists os_photos_atendente_sel  on public.service_order_photos;
drop policy if exists os_photos_atendente_ins  on public.service_order_photos;
drop policy if exists os_photos_tecnico_sel    on public.service_order_photos;
drop policy if exists os_photos_tecnico_ins    on public.service_order_photos;

create policy os_photos_admin_all on public.service_order_photos
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
create policy os_photos_atendente_sel on public.service_order_photos
  for select using (public.get_my_role() = 'atendente');
create policy os_photos_atendente_ins on public.service_order_photos
  for insert with check (public.get_my_role() = 'atendente');
create policy os_photos_tecnico_sel on public.service_order_photos
  for select using (
    public.get_my_role() = 'tecnico'
    and exists (
      select 1 from public.service_orders so
      where so.id = service_order_photos.service_order_id
        and so.technician_id = auth.uid()
    )
  );
create policy os_photos_tecnico_ins on public.service_order_photos
  for insert with check (
    public.get_my_role() = 'tecnico'
    and created_by = auth.uid()
    and exists (
      select 1 from public.service_orders so
      where so.id = service_order_photos.service_order_id
        and so.technician_id = auth.uid()
        and so.status not in ('concluido', 'cancelado')
    )
  );

-- ----------------------------------------------------------------------------
-- 9. Storage: buckets privados + policies em storage.objects
-- Caminho: '<service_order_id>/<arquivo>' (subpastas permitidas, ex.:
-- '<id>/antes/x.jpg'). O 1º segmento é convertido com segurança: nome fora
-- do padrão vira null (não derruba a query de listagem com erro de cast).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('os-fotos',       'os-fotos',       false, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('os-assinaturas', 'os-assinaturas', false, 1048576, array['image/png'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_os_id(p_name text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  v_seg text := (storage.foldername(p_name))[1];
begin
  if v_seg ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v_seg::uuid;
  end if;
  return null;
end;
$$;

drop policy if exists os_files_select       on storage.objects;
drop policy if exists os_files_insert       on storage.objects;
drop policy if exists os_files_update_admin on storage.objects;
drop policy if exists os_files_delete_admin on storage.objects;

create policy os_files_select on storage.objects
  for select to authenticated using (
    bucket_id in ('os-fotos', 'os-assinaturas')
    and (
      public.get_my_role() in ('admin', 'atendente')
      or (
        public.get_my_role() = 'tecnico'
        and exists (
          select 1 from public.service_orders so
          where so.id = public.storage_os_id(objects.name)
            and so.technician_id = auth.uid()
        )
      )
    )
  );

create policy os_files_insert on storage.objects
  for insert to authenticated with check (
    bucket_id in ('os-fotos', 'os-assinaturas')
    and public.storage_os_id(name) is not null
    and (
      (
        public.get_my_role() in ('admin', 'atendente')
        and exists (select 1 from public.service_orders so
                    where so.id = public.storage_os_id(objects.name))
      )
      or (
        public.get_my_role() = 'tecnico'
        and exists (
          select 1 from public.service_orders so
          where so.id = public.storage_os_id(objects.name)
            and so.technician_id = auth.uid()
            and so.status not in ('concluido', 'cancelado')
        )
      )
    )
  );

create policy os_files_update_admin on storage.objects
  for update to authenticated
  using (bucket_id in ('os-fotos', 'os-assinaturas') and public.get_my_role() = 'admin')
  with check (bucket_id in ('os-fotos', 'os-assinaturas') and public.get_my_role() = 'admin');

create policy os_files_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id in ('os-fotos', 'os-assinaturas') and public.get_my_role() = 'admin');
