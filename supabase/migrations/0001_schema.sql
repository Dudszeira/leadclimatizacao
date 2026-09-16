-- ============================================================================
-- Control Lead — Lead Climatização (Curitiba/PR)
-- Migration 0001: schema (extensões, tipos, tabelas, sequences, índices, triggers)
-- Alvo: Supabase (Postgres 15+). Ainda sem projeto online — arquivos versionados.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensões
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid / crypt (seed local)

-- ----------------------------------------------------------------------------
-- Tipos (enums) — criação idempotente via DO block
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'atendente', 'tecnico');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.equipment_type as enum ('split', 'vrf', 'chiller', 'self', 'janela');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.equipment_status as enum ('operacional', 'chamado_aberto', 'tecnico_em_campo', 'inativo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_origin as enum ('indicacao', 'site', 'whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_stage as enum ('lead', 'reuniao_marcada', 'reuniao_realizada', 'venda', 'perdido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.os_type as enum ('preventiva_pmoc', 'corretiva', 'instalacao', 'orcamento');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.os_priority as enum ('baixa', 'media', 'alta', 'urgente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.os_status as enum ('aberto', 'agendado', 'em_campo', 'concluido', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.os_origin as enum ('manual', 'pmoc_auto', 'ia_whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.conversation_status as enum ('ia', 'transferido', 'encerrado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_direction as enum ('in', 'out');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_author as enum ('ia', 'humano', 'cliente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contract_type as enum ('pmoc_recorrente', 'corretiva_avulsa', 'instalacao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contract_status as enum ('ativo', 'suspenso', 'encerrado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_status as enum ('pendente', 'pago', 'atrasado', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('pix', 'boleto');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 1. CRM
-- ----------------------------------------------------------------------------

-- Espelho de auth.users com papel de acesso
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  role        public.user_role not null default 'atendente',
  phone       text,
  avatar_url  text,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Empresa cliente (pessoa jurídica)
create table if not exists public.clients (
  id                uuid primary key default gen_random_uuid(),
  razao_social      text not null,
  nome_fantasia     text,
  cnpj              text unique,
  segmento          text,                       -- shopping, hospital, indústria, condomínio...
  contato_nome      text,
  contato_email     text,
  contato_telefone  text,
  observacoes       text,
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Prédio / unidade do cliente
create table if not exists public.buildings (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  nome        text not null,
  logradouro  text,
  numero      text,
  bairro      text,
  cidade      text not null default 'Curitiba',
  uf          text not null default 'PR',
  cep         text,
  lat         double precision,
  lng         double precision,
  regiao      text,                              -- ex.: 'centro', 'sul', 'cic', usado p/ roteirização
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Equipamento de climatização instalado em um prédio
create table if not exists public.equipment (
  id              uuid primary key default gen_random_uuid(),
  building_id     uuid not null references public.buildings (id) on delete cascade,
  tipo            public.equipment_type not null,
  marca           text,
  modelo          text,
  capacidade_btu  integer check (capacidade_btu is null or capacidade_btu > 0),
  codigo_interno  text not null,                 -- padrão andar-posição, ex.: '04-B7'
  ambiente        text,                          -- ex.: 'CTI - ala leste', 'Praça de alimentação'
  status          public.equipment_status not null default 'operacional',
  data_instalacao date,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (building_id, codigo_interno)
);

-- Funil comercial
create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  nome_contato    text not null,
  empresa         text,
  telefone        text,
  email           text,
  origem          public.lead_origin not null default 'whatsapp',
  estagio         public.lead_stage not null default 'lead',
  valor_estimado  numeric(12,2),
  client_id       uuid references public.clients (id) on delete set null, -- preenchido ao converter (estagio = venda)
  motivo_perda    text,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Chamados / Ordens de Serviço + PMOC
-- ----------------------------------------------------------------------------

-- Modelos de checklist por tipo de serviço (itens em JSONB)
create table if not exists public.checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  tipo        public.os_type not null,
  itens       jsonb not null default '[]'::jsonb, -- [{"id":"filtro","label":"Limpeza de filtros","tipo":"checkbox"}...]
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Plano de manutenção PMOC por equipamento (Lei 13.589/2018 + Portaria 3.523/98:
-- periodicidade definida no plano do responsável técnico; mensal é o usual em
-- ambientes climatizados de uso público — por isso armazenamos em dias).
create table if not exists public.pmoc_plans (
  id                     uuid primary key default gen_random_uuid(),
  equipment_id           uuid not null references public.equipment (id) on delete cascade,
  periodicidade_dias     integer not null check (periodicidade_dias > 0),
  proxima_data           date not null,
  checklist_template_id  uuid references public.checklist_templates (id) on delete set null,
  ativo                  boolean not null default true,
  observacoes            text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (equipment_id)                          -- 1 plano ativo por equipamento na Fase 1
);

-- Numeração sequencial humana das OS (exibida como OS-000123)
create sequence if not exists public.service_order_numero_seq start with 1000;

create table if not exists public.service_orders (
  id                     uuid primary key default gen_random_uuid(),
  numero                 bigint not null unique default nextval('public.service_order_numero_seq'),
  tipo                   public.os_type not null,
  prioridade             public.os_priority not null default 'media',
  status                 public.os_status not null default 'aberto',
  origem                 public.os_origin not null default 'manual',
  building_id            uuid not null references public.buildings (id) on delete restrict,
  equipment_id           uuid references public.equipment (id) on delete set null, -- nullable: orçamento/instalação podem não ter equipamento ainda
  pmoc_plan_id           uuid references public.pmoc_plans (id) on delete set null, -- preenchido quando origem = pmoc_auto
  technician_id          uuid references public.profiles (id) on delete set null,
  descricao              text,
  scheduled_at           timestamptz,
  -- check-in geolocalizado do técnico em campo
  checkin_lat            double precision,
  checkin_lng            double precision,
  checkin_at             timestamptz,
  -- execução
  checklist_template_id  uuid references public.checklist_templates (id) on delete set null,
  checklist_respostas    jsonb,                  -- {"filtro": true, "gas_ok": false, "obs": "..."}
  fotos_antes            text[] not null default '{}', -- storage paths no bucket os-fotos
  fotos_depois           text[] not null default '{}', -- storage paths no bucket os-fotos
  laudo                  text,
  assinatura_path        text,                   -- storage path no bucket os-assinaturas
  concluded_at           timestamptz,
  created_by             uuid references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. Atendimento IA (estrutura; integração WhatsApp vem depois)
-- ----------------------------------------------------------------------------
create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  canal            text not null default 'whatsapp',
  telefone         text not null,
  client_id        uuid references public.clients (id) on delete set null,
  status           public.conversation_status not null default 'ia',
  last_message_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  direcao          public.message_direction not null,
  autor            public.message_author not null,
  texto            text,
  metadata         jsonb not null default '{}'::jsonb, -- ids do provedor, mídia, intents da IA...
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. Financeiro (campos asaas_* preparados p/ integração sandbox futura)
-- ----------------------------------------------------------------------------
create table if not exists public.contracts (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients (id) on delete restrict,
  tipo            public.contract_type not null,
  valor_mensal    numeric(12,2) not null check (valor_mensal >= 0),
  status          public.contract_status not null default 'ativo',
  dia_vencimento  integer not null default 10 check (dia_vencimento between 1 and 28),
  inicio          date not null default current_date,
  fim             date,
  observacoes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.invoices (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references public.contracts (id) on delete restrict,
  competencia  date not null,                    -- sempre dia 1 do mês de referência
  valor        numeric(12,2) not null check (valor >= 0),
  status       public.invoice_status not null default 'pendente',
  metodo       public.payment_method,
  vencimento   date,
  asaas_id     text,                             -- id da cobrança no Asaas (sandbox futuro)
  asaas_url    text,                             -- link de pagamento Asaas
  nf_numero    text,                             -- número da NFS-e emitida
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (contract_id, competencia)
);

-- ----------------------------------------------------------------------------
-- Trigger de updated_at em todas as tabelas
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','clients','buildings','equipment','leads',
    'checklist_templates','pmoc_plans','service_orders',
    'conversations','messages','contracts','invoices'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Espelhamento auth.users -> profiles (padrão Supabase)
-- role vem de raw_user_meta_data.role quando informado no convite
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'atendente')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Índices (FKs, colunas de filtro e ordenação)
-- ----------------------------------------------------------------------------
create index if not exists idx_profiles_role              on public.profiles (role);

create index if not exists idx_clients_cnpj               on public.clients (cnpj);
create index if not exists idx_clients_ativo              on public.clients (ativo);

create index if not exists idx_buildings_client           on public.buildings (client_id);
create index if not exists idx_buildings_regiao           on public.buildings (regiao);

create index if not exists idx_equipment_building         on public.equipment (building_id);
create index if not exists idx_equipment_status           on public.equipment (status);
create index if not exists idx_equipment_tipo             on public.equipment (tipo);

create index if not exists idx_leads_estagio              on public.leads (estagio);
create index if not exists idx_leads_origem               on public.leads (origem);
create index if not exists idx_leads_client               on public.leads (client_id);
create index if not exists idx_leads_created_at           on public.leads (created_at desc);

create index if not exists idx_checklist_templates_tipo   on public.checklist_templates (tipo) where ativo;

create index if not exists idx_pmoc_plans_equipment       on public.pmoc_plans (equipment_id);
create index if not exists idx_pmoc_plans_proxima_data    on public.pmoc_plans (proxima_data) where ativo;

create index if not exists idx_os_status                  on public.service_orders (status);
create index if not exists idx_os_tipo                    on public.service_orders (tipo);
create index if not exists idx_os_prioridade              on public.service_orders (prioridade);
create index if not exists idx_os_building                on public.service_orders (building_id);
create index if not exists idx_os_equipment               on public.service_orders (equipment_id);
create index if not exists idx_os_technician              on public.service_orders (technician_id);
create index if not exists idx_os_pmoc_plan               on public.service_orders (pmoc_plan_id);
create index if not exists idx_os_scheduled_at            on public.service_orders (scheduled_at);
create index if not exists idx_os_created_at              on public.service_orders (created_at desc);
create index if not exists idx_os_tech_status             on public.service_orders (technician_id, status); -- agenda do técnico

create index if not exists idx_conversations_status       on public.conversations (status);
create index if not exists idx_conversations_client       on public.conversations (client_id);
create index if not exists idx_conversations_telefone     on public.conversations (telefone);
create index if not exists idx_conversations_last_msg     on public.conversations (last_message_at desc);

create index if not exists idx_messages_conversation      on public.messages (conversation_id, created_at);

create index if not exists idx_contracts_client           on public.contracts (client_id);
create index if not exists idx_contracts_status           on public.contracts (status);

create index if not exists idx_invoices_contract          on public.invoices (contract_id);
create index if not exists idx_invoices_status            on public.invoices (status);
create index if not exists idx_invoices_competencia       on public.invoices (competencia desc);
create index if not exists idx_invoices_vencimento        on public.invoices (vencimento);
