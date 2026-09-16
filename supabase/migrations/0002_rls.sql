-- ============================================================================
-- Control Lead — Migration 0002: Row Level Security
-- Papéis: admin (tudo) · atendente (CRM/chamados/conversas RW, financeiro RO)
--         tecnico (só OS atribuídas a ele + buildings/equipment relacionados)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: papel do usuário logado (security definer para não recursar na RLS
-- de profiles). STABLE: 1 leitura por statement.
-- ----------------------------------------------------------------------------
create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function public.get_my_role() from public;
grant execute on function public.get_my_role() to authenticated;

-- ----------------------------------------------------------------------------
-- Habilita RLS em TODAS as tabelas
-- ----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.clients             enable row level security;
alter table public.buildings           enable row level security;
alter table public.equipment           enable row level security;
alter table public.leads               enable row level security;
alter table public.checklist_templates enable row level security;
alter table public.pmoc_plans          enable row level security;
alter table public.service_orders      enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.contracts           enable row level security;
alter table public.invoices            enable row level security;

-- ----------------------------------------------------------------------------
-- profiles
-- Todos autenticados leem (listas de técnicos, nome do autor da OS etc.).
-- Cada um edita o próprio perfil; troca de role é bloqueada por trigger abaixo.
-- ----------------------------------------------------------------------------
drop policy if exists profiles_admin_all      on public.profiles;
drop policy if exists profiles_select_all     on public.profiles;
drop policy if exists profiles_update_own     on public.profiles;

create policy profiles_admin_all on public.profiles
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy profiles_select_all on public.profiles
  for select using (auth.uid() is not null);

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Não-admin não pode trocar o próprio role
create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
as $$
begin
  -- auth.uid() null = conexão service_role/migração (não bloquear)
  if new.role is distinct from old.role
     and auth.uid() is not null
     and public.get_my_role() is distinct from 'admin' then
    raise exception 'Apenas admin pode alterar o papel de um usuário';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_role_change on public.profiles;
create trigger guard_profile_role_change
  before update on public.profiles
  for each row execute function public.guard_profile_role_change();

-- ----------------------------------------------------------------------------
-- CRM: clients, leads — admin tudo; atendente lê/escreve (delete só admin)
-- ----------------------------------------------------------------------------
drop policy if exists clients_admin_all       on public.clients;
drop policy if exists clients_atendente_rw    on public.clients;
drop policy if exists clients_atendente_ins   on public.clients;
drop policy if exists clients_atendente_upd   on public.clients;

create policy clients_admin_all on public.clients
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create policy clients_atendente_rw on public.clients
  for select using (public.get_my_role() = 'atendente');
create policy clients_atendente_ins on public.clients
  for insert with check (public.get_my_role() = 'atendente');
create policy clients_atendente_upd on public.clients
  for update using (public.get_my_role() = 'atendente')
  with check (public.get_my_role() = 'atendente');

drop policy if exists leads_admin_all         on public.leads;
drop policy if exists leads_atendente_sel     on public.leads;
drop policy if exists leads_atendente_ins     on public.leads;
drop policy if exists leads_atendente_upd     on public.leads;

create policy leads_admin_all on public.leads
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
create policy leads_atendente_sel on public.leads
  for select using (public.get_my_role() = 'atendente');
create policy leads_atendente_ins on public.leads
  for insert with check (public.get_my_role() = 'atendente');
create policy leads_atendente_upd on public.leads
  for update using (public.get_my_role() = 'atendente')
  with check (public.get_my_role() = 'atendente');

-- ----------------------------------------------------------------------------
-- buildings / equipment — admin tudo; atendente lê/escreve;
-- tecnico lê apenas os relacionados a OS atribuídas a ele
-- ----------------------------------------------------------------------------
drop policy if exists buildings_admin_all     on public.buildings;
drop policy if exists buildings_atendente_sel on public.buildings;
drop policy if exists buildings_atendente_ins on public.buildings;
drop policy if exists buildings_atendente_upd on public.buildings;
drop policy if exists buildings_tecnico_sel   on public.buildings;

create policy buildings_admin_all on public.buildings
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
create policy buildings_atendente_sel on public.buildings
  for select using (public.get_my_role() = 'atendente');
create policy buildings_atendente_ins on public.buildings
  for insert with check (public.get_my_role() = 'atendente');
create policy buildings_atendente_upd on public.buildings
  for update using (public.get_my_role() = 'atendente')
  with check (public.get_my_role() = 'atendente');
create policy buildings_tecnico_sel on public.buildings
  for select using (
    public.get_my_role() = 'tecnico'
    and exists (
      select 1 from public.service_orders so
      where so.building_id = buildings.id
        and so.technician_id = auth.uid()
    )
  );

drop policy if exists equipment_admin_all     on public.equipment;
drop policy if exists equipment_atendente_sel on public.equipment;
drop policy if exists equipment_atendente_ins on public.equipment;
drop policy if exists equipment_atendente_upd on public.equipment;
drop policy if exists equipment_tecnico_sel   on public.equipment;

create policy equipment_admin_all on public.equipment
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
create policy equipment_atendente_sel on public.equipment
  for select using (public.get_my_role() = 'atendente');
create policy equipment_atendente_ins on public.equipment
  for insert with check (public.get_my_role() = 'atendente');
create policy equipment_atendente_upd on public.equipment
  for update using (public.get_my_role() = 'atendente')
  with check (public.get_my_role() = 'atendente');
create policy equipment_tecnico_sel on public.equipment
  for select using (
    public.get_my_role() = 'tecnico'
    and exists (
      select 1 from public.service_orders so
      where so.equipment_id = equipment.id
        and so.technician_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- checklist_templates — leitura para todos autenticados (técnico precisa
-- responder o checklist); escrita admin/atendente
-- ----------------------------------------------------------------------------
drop policy if exists cht_admin_all           on public.checklist_templates;
drop policy if exists cht_select_all          on public.checklist_templates;
drop policy if exists cht_atendente_ins       on public.checklist_templates;
drop policy if exists cht_atendente_upd       on public.checklist_templates;

create policy cht_admin_all on public.checklist_templates
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
create policy cht_select_all on public.checklist_templates
  for select using (auth.uid() is not null);
create policy cht_atendente_ins on public.checklist_templates
  for insert with check (public.get_my_role() = 'atendente');
create policy cht_atendente_upd on public.checklist_templates
  for update using (public.get_my_role() = 'atendente')
  with check (public.get_my_role() = 'atendente');

-- ----------------------------------------------------------------------------
-- pmoc_plans — admin tudo; atendente lê/escreve
-- ----------------------------------------------------------------------------
drop policy if exists pmoc_admin_all          on public.pmoc_plans;
drop policy if exists pmoc_atendente_sel      on public.pmoc_plans;
drop policy if exists pmoc_atendente_ins      on public.pmoc_plans;
drop policy if exists pmoc_atendente_upd      on public.pmoc_plans;

create policy pmoc_admin_all on public.pmoc_plans
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
create policy pmoc_atendente_sel on public.pmoc_plans
  for select using (public.get_my_role() = 'atendente');
create policy pmoc_atendente_ins on public.pmoc_plans
  for insert with check (public.get_my_role() = 'atendente');
create policy pmoc_atendente_upd on public.pmoc_plans
  for update using (public.get_my_role() = 'atendente')
  with check (public.get_my_role() = 'atendente');

-- ----------------------------------------------------------------------------
-- service_orders — admin tudo; atendente lê/escreve;
-- tecnico: SELECT/UPDATE apenas nas OS atribuídas a ele
-- ----------------------------------------------------------------------------
drop policy if exists os_admin_all            on public.service_orders;
drop policy if exists os_atendente_sel        on public.service_orders;
drop policy if exists os_atendente_ins        on public.service_orders;
drop policy if exists os_atendente_upd        on public.service_orders;
drop policy if exists os_tecnico_sel          on public.service_orders;
drop policy if exists os_tecnico_upd          on public.service_orders;

create policy os_admin_all on public.service_orders
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
create policy os_atendente_sel on public.service_orders
  for select using (public.get_my_role() = 'atendente');
create policy os_atendente_ins on public.service_orders
  for insert with check (public.get_my_role() = 'atendente');
create policy os_atendente_upd on public.service_orders
  for update using (public.get_my_role() = 'atendente')
  with check (public.get_my_role() = 'atendente');
create policy os_tecnico_sel on public.service_orders
  for select using (
    public.get_my_role() = 'tecnico' and technician_id = auth.uid()
  );
create policy os_tecnico_upd on public.service_orders
  for update using (
    public.get_my_role() = 'tecnico' and technician_id = auth.uid()
  )
  with check (
    public.get_my_role() = 'tecnico' and technician_id = auth.uid()
  );

-- Técnico só altera campos de execução: check-in, checklist, fotos, laudo,
-- assinatura e status (aberto/agendado -> em_campo -> concluido).
-- RLS não restringe colunas, então o guard é feito por trigger.
create or replace function public.guard_tecnico_os_update()
returns trigger
language plpgsql
as $$
begin
  if public.get_my_role() = 'tecnico' then
    if new.numero        is distinct from old.numero
       or new.tipo          is distinct from old.tipo
       or new.prioridade    is distinct from old.prioridade
       or new.origem        is distinct from old.origem
       or new.building_id   is distinct from old.building_id
       or new.equipment_id  is distinct from old.equipment_id
       or new.pmoc_plan_id  is distinct from old.pmoc_plan_id
       or new.technician_id is distinct from old.technician_id
       or new.scheduled_at  is distinct from old.scheduled_at
       or new.created_by    is distinct from old.created_by
       or new.checklist_template_id is distinct from old.checklist_template_id
    then
      raise exception 'Técnico só pode atualizar check-in, checklist, fotos, laudo, assinatura e status da OS';
    end if;
    if new.status is distinct from old.status
       and new.status not in ('em_campo', 'concluido') then
      raise exception 'Técnico só pode mover a OS para em_campo ou concluido';
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
-- conversations / messages — admin tudo; atendente lê/escreve
-- (inserção de mensagens da IA/webhook usa service_role, que ignora RLS)
-- ----------------------------------------------------------------------------
drop policy if exists conv_admin_all          on public.conversations;
drop policy if exists conv_atendente_sel      on public.conversations;
drop policy if exists conv_atendente_ins      on public.conversations;
drop policy if exists conv_atendente_upd      on public.conversations;

create policy conv_admin_all on public.conversations
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
create policy conv_atendente_sel on public.conversations
  for select using (public.get_my_role() = 'atendente');
create policy conv_atendente_ins on public.conversations
  for insert with check (public.get_my_role() = 'atendente');
create policy conv_atendente_upd on public.conversations
  for update using (public.get_my_role() = 'atendente')
  with check (public.get_my_role() = 'atendente');

drop policy if exists msg_admin_all           on public.messages;
drop policy if exists msg_atendente_sel       on public.messages;
drop policy if exists msg_atendente_ins       on public.messages;

create policy msg_admin_all on public.messages
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
create policy msg_atendente_sel on public.messages
  for select using (public.get_my_role() = 'atendente');
create policy msg_atendente_ins on public.messages
  for insert with check (public.get_my_role() = 'atendente');

-- ----------------------------------------------------------------------------
-- Financeiro — admin tudo; atendente SOMENTE leitura
-- ----------------------------------------------------------------------------
drop policy if exists contracts_admin_all     on public.contracts;
drop policy if exists contracts_atendente_sel on public.contracts;

create policy contracts_admin_all on public.contracts
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
create policy contracts_atendente_sel on public.contracts
  for select using (public.get_my_role() = 'atendente');

drop policy if exists invoices_admin_all      on public.invoices;
drop policy if exists invoices_atendente_sel  on public.invoices;

create policy invoices_admin_all on public.invoices
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
create policy invoices_atendente_sel on public.invoices
  for select using (public.get_my_role() = 'atendente');

-- ============================================================================
-- STORAGE (criar via Dashboard/CLI quando o projeto Supabase existir)
-- ============================================================================
-- Buckets necessários (privados):
--   os-fotos        — fotos antes/depois das OS. Path: {service_order_id}/{antes|depois}/{uuid}.jpg
--   os-assinaturas  — assinatura do responsável no local. Path: {service_order_id}/assinatura.png
--
-- insert into storage.buckets (id, name, public) values
--   ('os-fotos', 'os-fotos', false),
--   ('os-assinaturas', 'os-assinaturas', false)
-- on conflict (id) do nothing;
--
-- Policies sugeridas em storage.objects (mesma lógica da tabela service_orders):
--
-- create policy "os_fotos_admin_atendente_all" on storage.objects
--   for all using (
--     bucket_id in ('os-fotos', 'os-assinaturas')
--     and public.get_my_role() in ('admin', 'atendente')
--   ) with check (
--     bucket_id in ('os-fotos', 'os-assinaturas')
--     and public.get_my_role() in ('admin', 'atendente')
--   );
--
-- -- Técnico lê/grava apenas arquivos das OS atribuídas a ele
-- -- (1º segmento do path = service_orders.id)
-- create policy "os_fotos_tecnico_rw" on storage.objects
--   for all using (
--     bucket_id in ('os-fotos', 'os-assinaturas')
--     and public.get_my_role() = 'tecnico'
--     and exists (
--       select 1 from public.service_orders so
--       where so.id::text = (storage.foldername(name))[1]
--         and so.technician_id = auth.uid()
--     )
--   ) with check (
--     bucket_id in ('os-fotos', 'os-assinaturas')
--     and public.get_my_role() = 'tecnico'
--     and exists (
--       select 1 from public.service_orders so
--       where so.id::text = (storage.foldername(name))[1]
--         and so.technician_id = auth.uid()
--     )
--   );
-- ============================================================================
