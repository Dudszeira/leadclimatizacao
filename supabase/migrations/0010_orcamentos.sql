-- ============================================================================
-- Control Lead — Migration 0010: Orçamentos (propostas comerciais)
--  * service_catalog: catálogo de serviços/produtos com preço padrão
--  * quotes + quote_items: orçamento com itens (snapshot de descrição/preço)
--  * subtotal/total mantidos SÓ pelo banco (trigger recalcula a cada escrita)
--  * imutável fora de 'aguardando' (trigger, não só UI); status só muda pelas
--    RPCs aprovar_orcamento / declinar_orcamento
--  * aprovar = OS (aberta) + contrato avulso encerrado + fatura pendente
--  * Acesso: admin, atendente e técnico leem, criam, editam (enquanto
--    aguardando) e duplicam; excluir, aprovar (gera cobrança) e declinar
--    são só admin; catálogo: todos leem, só admin escreve
--  * ESCRITA SÓ POR RPC: quotes/quote_items não têm INSERT/UPDATE/DELETE
--    para anon/authenticated (nem admin). Toda escrita passa por
--    salvar_orcamento, duplicar_orcamento, aprovar_orcamento,
--    declinar_orcamento e excluir_orcamento (security definer, cada uma
--    checa o papel). SELECT continua pela RLS. Os triggers ficam como
--    defesa em profundidade (numero/created_at/created_by imutáveis,
--    totais pelo banco, decidido congelado).
--  * vw_quotes: quote + dados de cliente/prédio para os 3 papéis. DECISÃO DO
--    DONO: o técnico tem acesso geral ao orçamento, inclusive ao contato do
--    cliente (nome/e-mail/telefone/CNPJ) — exposição intencional. A view
--    roda como owner (o linter security_definer_view do Supabase vai
--    apontar: esperado) com security_barrier e filtro de usuário ativo.
-- Idempotente: pode ser reaplicada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tipos
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.quote_status as enum ('aguardando', 'aprovado', 'declinado');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. Tabelas
-- ----------------------------------------------------------------------------
create table if not exists public.service_catalog (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(btrim(nome)) between 1 and 200),
  descricao   text check (descricao is null or length(descricao) <= 2000),
  unidade     text not null default 'un' check (length(btrim(unidade)) between 1 and 20),
  preco       numeric(12,2) not null default 0 check (preco >= 0),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Numeração humana (exibida como ORC-1000, mesmo padrão de OS-1000)
create sequence if not exists public.quote_numero_seq start with 1000;

create table if not exists public.quotes (
  id                   uuid primary key default gen_random_uuid(),
  numero               bigint not null unique, -- sempre nextval pelo trigger
  client_id            uuid not null references public.clients (id) on delete restrict,
  building_id          uuid not null references public.buildings (id) on delete restrict,
  tipo_servico         public.os_type not null default 'instalacao'
                         check (tipo_servico in ('instalacao', 'corretiva')),
  titulo               text not null check (length(btrim(titulo)) between 1 and 200),
  observacoes          text check (observacoes is null or length(observacoes) <= 4000),
  validade             date not null default ((now() at time zone 'America/Sao_Paulo')::date + 15),
  condicoes_pagamento  text check (condicoes_pagamento is null or length(condicoes_pagamento) <= 1000),
  prazo_execucao       text check (prazo_execucao is null or length(prazo_execucao) <= 500),
  garantia             text check (garantia is null or length(garantia) <= 500),
  desconto             numeric(12,2) not null default 0 check (desconto >= 0),
  subtotal             numeric(12,2) not null default 0 check (subtotal >= 0),
  total                numeric(12,2) not null default 0 check (total >= 0),
  status               public.quote_status not null default 'aguardando',
  motivo_declinio      text check (motivo_declinio is null or length(motivo_declinio) <= 1000),
  decidido_em          timestamptz,
  service_order_id     uuid references public.service_orders (id) on delete set null,
  invoice_id           uuid references public.invoices (id) on delete set null,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.quote_items (
  id               uuid primary key default gen_random_uuid(),
  quote_id         uuid not null references public.quotes (id) on delete cascade,
  catalog_item_id  uuid references public.service_catalog (id) on delete set null,
  descricao        text not null check (length(btrim(descricao)) between 1 and 500),
  unidade          text not null default 'un' check (length(btrim(unidade)) between 1 and 20),
  quantidade       numeric(12,3) not null check (quantidade > 0),
  preco_unitario   numeric(12,2) not null check (preco_unitario >= 0),
  valor            numeric(12,2) generated always as (round(quantidade * preco_unitario, 2)) stored,
  ordem            integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- numero só pelo trigger (sem default: reaplicação remove o antigo)
alter table public.quotes alter column numero drop default;

-- Contrato avulso gerado na aprovação (rastreio; 1 por orçamento)
alter table public.contracts
  add column if not exists quote_id uuid unique references public.quotes (id) on delete set null;

-- ----------------------------------------------------------------------------
-- 3. Índices
-- ----------------------------------------------------------------------------
create index if not exists idx_service_catalog_ativo  on public.service_catalog (ativo, nome);
create index if not exists idx_quotes_client          on public.quotes (client_id);
create index if not exists idx_quotes_building        on public.quotes (building_id);
create index if not exists idx_quotes_status          on public.quotes (status);
create index if not exists idx_quotes_created_at      on public.quotes (created_at desc);
create index if not exists idx_quotes_service_order   on public.quotes (service_order_id);
create index if not exists idx_quotes_invoice         on public.quotes (invoice_id);
create index if not exists idx_quote_items_quote      on public.quote_items (quote_id, ordem);
create index if not exists idx_quote_items_catalog    on public.quote_items (catalog_item_id);

-- updated_at (mesmo padrão de 0001)
do $$
declare
  t text;
begin
  foreach t in array array['service_catalog', 'quotes', 'quote_items'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Guard + recálculo do cabeçalho (quotes)
--    Escrita direta está revogada (seção 6); este trigger é defesa em
--    profundidade e vale para qualquer caminho (RPCs, service_role, FK):
--    * INSERT: numero := nextval, created_at := now(), nasce aguardando sem
--      decisão/vínculos; cliente precisa estar ativo.
--    * UPDATE: numero, created_at e created_by nunca mudam.
--    * Decidido: nada muda, exceto service_order_id/invoice_id virarem null
--      quando a OS/fatura referenciada não existe mais (on delete set null).
--    * subtotal/total sempre recalculados a partir dos itens.
--    Se alguém regrantar escrita à API (anon/authenticated), status/decisão
--    continuam bloqueados.
-- ----------------------------------------------------------------------------
create or replace function public._quote_building_ok(p_building uuid, p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.buildings b
    where b.id = p_building and b.client_id = p_client
  );
$$;

revoke all on function public._quote_building_ok(uuid, uuid) from public, anon, authenticated;

create or replace function public._quote_client_ativo(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.clients c where c.id = p_client and c.ativo);
$$;

revoke all on function public._quote_client_ativo(uuid) from public, anon, authenticated;

create or replace function public.quotes_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_api boolean := current_user in ('anon', 'authenticated');
  -- colunas que podem mudar num orçamento já decidido (set null de FK)
  v_pos_decisao constant text[] := array['service_order_id', 'invoice_id', 'updated_at'];
begin
  if tg_op = 'DELETE' then
    if old.status <> 'aguardando' then
      raise exception 'Orçamento ORC-% já foi %; não pode ser excluído', old.numero, old.status
        using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    new.numero     := nextval('public.quote_numero_seq');
    new.created_at := now();
    new.updated_at := now();
    if v_api then
      new.status           := 'aguardando';
      new.decidido_em      := null;
      new.motivo_declinio  := null;
      new.service_order_id := null;
      new.invoice_id       := null;
      new.created_by       := auth.uid();
    elsif new.status <> 'aguardando' or new.decidido_em is not null or new.motivo_declinio is not null
          or new.service_order_id is not null or new.invoice_id is not null then
      raise exception 'Orçamento novo nasce aguardando resposta' using errcode = '22023';
    end if;
    if not public._quote_client_ativo(new.client_id) then
      raise exception 'Cliente inativo: reative o cliente antes de criar o orçamento' using errcode = '23514';
    end if;
  else
    -- UPDATE: identidade e trilha nunca mudam
    new.numero     := old.numero;
    new.created_at := old.created_at;
    new.created_by := old.created_by;

    if old.status <> 'aguardando' then
      if (to_jsonb(new) - v_pos_decisao - 'subtotal' - 'total')
           is distinct from (to_jsonb(old) - v_pos_decisao - 'subtotal' - 'total')
         -- vínculo só pode sumir se a OS/fatura não existe mais (FK set null)
         or (new.service_order_id is distinct from old.service_order_id
             and (new.service_order_id is not null
                  or exists (select 1 from public.service_orders so where so.id = old.service_order_id)))
         or (new.invoice_id is distinct from old.invoice_id
             and (new.invoice_id is not null
                  or exists (select 1 from public.invoices i where i.id = old.invoice_id))) then
        raise exception 'Orçamento ORC-% já foi %; não pode mais ser alterado (use "duplicar" para refazer)',
          old.numero, old.status
          using errcode = '42501';
      end if;
      -- decidido: mantém os valores congelados
      new.subtotal := old.subtotal;
      new.total    := old.total;
      return new;
    end if;

    if v_api then
      if new.status is distinct from old.status then
        raise exception 'Use as ações Aprovar/Declinar para mudar o status do orçamento'
          using errcode = '42501';
      end if;
      if new.decidido_em      is distinct from old.decidido_em
         or new.motivo_declinio  is distinct from old.motivo_declinio
         or new.service_order_id is distinct from old.service_order_id
         or new.invoice_id       is distinct from old.invoice_id then
        raise exception 'Dados da decisão do orçamento só são gravados por Aprovar/Declinar'
          using errcode = '42501';
      end if;
    elsif new.status = 'aguardando' and (
         new.decidido_em is not null or new.service_order_id is not null or new.invoice_id is not null) then
      raise exception 'Orçamento aguardando não tem decisão/vínculos' using errcode = '22023';
    end if;

    if new.client_id is distinct from old.client_id and not public._quote_client_ativo(new.client_id) then
      raise exception 'Cliente inativo: escolha um cliente ativo' using errcode = '23514';
    end if;
  end if;

  -- prédio precisa ser do cliente
  if not public._quote_building_ok(new.building_id, new.client_id) then
    raise exception 'O prédio selecionado não pertence ao cliente do orçamento' using errcode = '23514';
  end if;

  new.subtotal := coalesce(
    (select sum(i.valor) from public.quote_items i where i.quote_id = new.id), 0);
  new.total := new.subtotal - new.desconto;
  if new.total < 0 then
    raise exception 'O desconto (R$ %) não pode ser maior que o subtotal (R$ %)', new.desconto, new.subtotal
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.quotes_before_write() from public, anon, authenticated;

drop trigger if exists quotes_before_write on public.quotes;
create trigger quotes_before_write
  before insert or update or delete on public.quotes
  for each row execute function public.quotes_before_write();

-- ----------------------------------------------------------------------------
-- 5. Itens: só em orçamento aguardando; toda escrita recalcula o cabeçalho
-- ----------------------------------------------------------------------------
create or replace function public.quote_items_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status public.quote_status;
  v_numero bigint;
begin
  if tg_op = 'UPDATE' and new.quote_id is distinct from old.quote_id then
    raise exception 'Item não pode ser movido para outro orçamento' using errcode = '42501';
  end if;

  -- trava o pai: serializa com aprovar/declinar/excluir (que também usam
  -- FOR UPDATE) e relê o status já confirmado por elas
  select q.status, q.numero into v_status, v_numero
  from public.quotes q
  where q.id = case when tg_op = 'DELETE' then old.quote_id else new.quote_id end
  for update;

  -- not found: cascata da exclusão do próprio orçamento (já validada no pai)
  if found and v_status <> 'aguardando' then
    raise exception 'Orçamento ORC-% já foi %; os itens não podem mais ser alterados', v_numero, v_status
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.quote_items_guard() from public, anon, authenticated;

drop trigger if exists quote_items_guard on public.quote_items;
create trigger quote_items_guard
  before insert or update or delete on public.quote_items
  for each row execute function public.quote_items_guard();

-- "toca" o cabeçalho: quotes_before_write recalcula subtotal/total
create or replace function public.quote_items_recalc()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.quotes set subtotal = subtotal
     where id = old.quote_id and status = 'aguardando';
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.quotes set subtotal = subtotal
     where id = new.quote_id and status = 'aguardando'
       and (tg_op = 'INSERT' or new.quote_id is distinct from old.quote_id
            or new.valor is distinct from old.valor);
  end if;
  return null;
end;
$$;

revoke all on function public.quote_items_recalc() from public, anon, authenticated;

drop trigger if exists quote_items_recalc on public.quote_items;
create trigger quote_items_recalc
  after insert or update or delete on public.quote_items
  for each row execute function public.quote_items_recalc();

-- ----------------------------------------------------------------------------
-- 6. RLS e grants
--    quotes/quote_items: os 3 papéis ativos só LEEM pela RLS; nenhuma
--    escrita direta (INSERT/UPDATE/DELETE revogados de anon/authenticated,
--    inclusive admin) — escrita só pelas RPCs security definer.
--    service_catalog: os 3 leem; escrita direta só admin (RLS).
-- ----------------------------------------------------------------------------
alter table public.service_catalog enable row level security;
alter table public.quotes          enable row level security;
alter table public.quote_items     enable row level security;

drop policy if exists service_catalog_admin_all on public.service_catalog;
drop policy if exists service_catalog_select    on public.service_catalog;
create policy service_catalog_admin_all on public.service_catalog
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');
create policy service_catalog_select on public.service_catalog
  for select using (public.get_my_role() is not null);

drop policy if exists quotes_admin_all    on public.quotes;
drop policy if exists quotes_select       on public.quotes;
drop policy if exists quotes_insert       on public.quotes;
drop policy if exists quotes_update       on public.quotes;
drop policy if exists quotes_delete_admin on public.quotes;
create policy quotes_select on public.quotes
  for select using (public.get_my_role() is not null);

drop policy if exists quote_items_admin_all on public.quote_items;
drop policy if exists quote_items_all       on public.quote_items;
drop policy if exists quote_items_select    on public.quote_items;
create policy quote_items_select on public.quote_items
  for select using (public.get_my_role() is not null);

revoke all on table public.service_catalog from anon;
revoke all on table public.quotes          from public, anon, authenticated;
revoke all on table public.quote_items     from public, anon, authenticated;
grant select on table public.quotes      to authenticated;
grant select on table public.quote_items to authenticated;
revoke all on sequence public.quote_numero_seq from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Helpers internos
-- ----------------------------------------------------------------------------
create or replace function public._quote_require_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.get_my_role() is distinct from 'admin' then
    raise exception 'Apenas admin pode gerenciar orçamentos' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public._quote_require_admin() from public, anon, authenticated;

-- qualquer papel ativo (admin, atendente, técnico)
create or replace function public._quote_require_user()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.get_my_role() is null then
    raise exception 'Sem permissão para orçamentos' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public._quote_require_user() from public, anon, authenticated;

-- Grava os itens (jsonb array) de um orçamento aguardando. Ordem = posição.
create or replace function public._quote_insert_items(p_quote uuid, p_items jsonb)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Inclua pelo menos 1 item no orçamento' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Máximo de 200 itens por orçamento' using errcode = '22023';
  end if;

  insert into public.quote_items
    (quote_id, catalog_item_id, descricao, unidade, quantidade, preco_unitario, ordem)
  select
    p_quote,
    nullif(it ->> 'catalog_item_id', '')::uuid,
    btrim(it ->> 'descricao'),
    coalesce(nullif(btrim(it ->> 'unidade'), ''), 'un'),
    (it ->> 'quantidade')::numeric,
    (it ->> 'preco_unitario')::numeric,
    (ord - 1)::integer
  from jsonb_array_elements(p_items) with ordinality as e(it, ord);
end;
$$;

revoke all on function public._quote_insert_items(uuid, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. salvar_orcamento: cria (p_quote null) ou edita cabeçalho + SUBSTITUI os
--    itens numa transação. security definer (escrita direta revogada):
--    checa usuário ativo; os 3 papéis (edição só enquanto aguardando,
--    garantida aqui e pela trigger; cliente ativo e prédio do cliente
--    validados pela trigger).
--    p_header: {client_id, building_id, tipo_servico, titulo, observacoes,
--      validade, condicoes_pagamento, prazo_execucao, garantia, desconto}
--    p_items: [{catalog_item_id?, descricao, unidade, quantidade, preco_unitario}]
-- ----------------------------------------------------------------------------
create or replace function public.salvar_orcamento(p_quote uuid, p_header jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid := p_quote;
  v_status   public.quote_status;
  v_numero   bigint;
  v_desconto numeric(12,2) := coalesce(nullif(p_header ->> 'desconto', '')::numeric, 0);
begin
  perform public._quote_require_user();
  if p_header is null or jsonb_typeof(p_header) <> 'object' then
    raise exception 'Dados do orçamento inválidos' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.quotes (
      client_id, building_id, tipo_servico, titulo, observacoes, validade,
      condicoes_pagamento, prazo_execucao, garantia, desconto, created_by
    ) values (
      (p_header ->> 'client_id')::uuid,
      (p_header ->> 'building_id')::uuid,
      coalesce(nullif(p_header ->> 'tipo_servico', ''), 'instalacao')::public.os_type,
      btrim(p_header ->> 'titulo'),
      nullif(btrim(p_header ->> 'observacoes'), ''),
      (p_header ->> 'validade')::date,
      nullif(btrim(p_header ->> 'condicoes_pagamento'), ''),
      nullif(btrim(p_header ->> 'prazo_execucao'), ''),
      nullif(btrim(p_header ->> 'garantia'), ''),
      0,
      auth.uid()
    )
    returning id into v_id;
  else
    select q.status, q.numero into v_status, v_numero
    from public.quotes q where q.id = v_id for update;
    if not found then
      raise exception 'Orçamento não encontrado' using errcode = 'P0002';
    end if;
    if v_status <> 'aguardando' then
      raise exception 'Orçamento ORC-% já foi %; não pode mais ser alterado (use "duplicar" para refazer)',
        v_numero, v_status using errcode = '42501';
    end if;

    -- desconto zerado durante a troca dos itens (subtotal passa por 0)
    update public.quotes set
      client_id           = (p_header ->> 'client_id')::uuid,
      building_id         = (p_header ->> 'building_id')::uuid,
      tipo_servico        = coalesce(nullif(p_header ->> 'tipo_servico', ''), 'instalacao')::public.os_type,
      titulo              = btrim(p_header ->> 'titulo'),
      observacoes         = nullif(btrim(p_header ->> 'observacoes'), ''),
      validade            = (p_header ->> 'validade')::date,
      condicoes_pagamento = nullif(btrim(p_header ->> 'condicoes_pagamento'), ''),
      prazo_execucao      = nullif(btrim(p_header ->> 'prazo_execucao'), ''),
      garantia            = nullif(btrim(p_header ->> 'garantia'), ''),
      desconto            = 0
    where id = v_id;

    delete from public.quote_items where quote_id = v_id;
  end if;

  perform public._quote_insert_items(v_id, p_items);

  if v_desconto <> 0 then
    update public.quotes set desconto = v_desconto where id = v_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.salvar_orcamento(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.salvar_orcamento(uuid, jsonb, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- 9. aprovar_orcamento: OS + contrato avulso (encerrado) + fatura pendente.
--    Contrato corretiva_avulsa/encerrado fica fora do faturamento mensal
--    (_generate_monthly_invoices_job filtra status='ativo' e tipo<>avulsa).
--    p_updated_at: o updated_at que a tela exibiu; se o orçamento mudou
--      depois disso, recusa (hint 'quote_alterado') — cobra o que foi visto.
--    p_aceitar_vencido: validade < hoje só aprova com confirmação explícita
--      (hint 'quote_vencido').
-- ----------------------------------------------------------------------------
drop function if exists public.aprovar_orcamento(uuid, date);

create or replace function public.aprovar_orcamento(
  p_quote uuid,
  p_vencimento date,
  p_updated_at timestamptz,
  p_aceitar_vencido boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q        public.quotes;
  v_hoje     date := public.hoje_brt();
  v_itens    text;
  v_os       uuid;
  v_contrato uuid;
  v_fatura   uuid;
begin
  perform public._quote_require_admin();
  if p_quote is null then
    raise exception 'Orçamento obrigatório' using errcode = '22004';
  end if;
  if p_vencimento is null or p_vencimento < v_hoje then
    raise exception 'Informe um vencimento a partir de hoje' using errcode = '22023';
  end if;

  select * into v_q from public.quotes where id = p_quote for update;
  if not found then
    raise exception 'Orçamento não encontrado' using errcode = 'P0002';
  end if;
  if v_q.status <> 'aguardando' then
    raise exception 'Orçamento ORC-% já foi %', v_q.numero, v_q.status using errcode = 'P0001';
  end if;
  -- precisão de ms: a tela pode ter passado o valor por Date (JS)
  if p_updated_at is null
     or date_trunc('milliseconds', v_q.updated_at) <> date_trunc('milliseconds', p_updated_at) then
    raise exception 'O orçamento foi alterado por outra pessoa; recarregue antes de aprovar'
      using errcode = 'P0001', hint = 'quote_alterado';
  end if;
  if not public._quote_client_ativo(v_q.client_id) then
    raise exception 'Cliente inativo: reative o cliente antes de aprovar o orçamento' using errcode = 'P0001';
  end if;
  if v_q.validade < v_hoje and not coalesce(p_aceitar_vencido, false) then
    raise exception 'Orçamento vencido em %. Confirme para aprovar mesmo assim', to_char(v_q.validade, 'DD/MM/YYYY')
      using errcode = 'P0001', hint = 'quote_vencido';
  end if;
  if v_q.total <= 0 then
    raise exception 'Orçamento sem valor: inclua itens antes de aprovar' using errcode = 'P0001';
  end if;

  select string_agg(
           '- ' || trim_scale(i.quantidade)::text || ' ' || i.unidade || ' · ' || i.descricao,
           E'\n' order by i.ordem, i.created_at)
    into v_itens
  from public.quote_items i
  where i.quote_id = p_quote;

  insert into public.service_orders (tipo, status, origem, building_id, descricao, created_by)
  values (
    v_q.tipo_servico, 'aberto', 'manual', v_q.building_id,
    left('Orçamento ORC-' || v_q.numero || ': ' || v_q.titulo
         || coalesce(E'\n' || v_itens, ''), 4000),
    auth.uid()
  )
  returning id into v_os;

  insert into public.contracts (client_id, tipo, valor_mensal, status, inicio, fim, observacoes, quote_id)
  values (
    v_q.client_id, 'corretiva_avulsa', v_q.total, 'encerrado', v_hoje, v_hoje,
    'Gerado pela aprovação do orçamento ORC-' || v_q.numero, v_q.id
  )
  returning id into v_contrato;

  insert into public.invoices (contract_id, competencia, valor, status, vencimento)
  values (v_contrato, date_trunc('month', v_hoje)::date, v_q.total, 'pendente', p_vencimento)
  returning id into v_fatura;

  update public.quotes
     set status           = 'aprovado',
         decidido_em      = now(),
         service_order_id = v_os,
         invoice_id       = v_fatura
   where id = p_quote;

  return jsonb_build_object(
    'service_order_id', v_os,
    'invoice_id',       v_fatura,
    'contract_id',      v_contrato
  );
end;
$$;

revoke all on function public.aprovar_orcamento(uuid, date, timestamptz, boolean) from public, anon;
grant execute on function public.aprovar_orcamento(uuid, date, timestamptz, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 10. declinar_orcamento
-- ----------------------------------------------------------------------------
create or replace function public.declinar_orcamento(p_quote uuid, p_motivo text default null)
returns public.quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.quotes;
begin
  perform public._quote_require_admin();
  if p_quote is null then
    raise exception 'Orçamento obrigatório' using errcode = '22004';
  end if;
  if length(p_motivo) > 1000 then
    raise exception 'Motivo muito longo (máx. 1000 caracteres)' using errcode = '22023';
  end if;

  select * into v_q from public.quotes where id = p_quote for update;
  if not found then
    raise exception 'Orçamento não encontrado' using errcode = 'P0002';
  end if;
  if v_q.status <> 'aguardando' then
    raise exception 'Orçamento ORC-% já foi %', v_q.numero, v_q.status using errcode = 'P0001';
  end if;

  update public.quotes
     set status          = 'declinado',
         decidido_em     = now(),
         motivo_declinio = nullif(btrim(p_motivo), '')
   where id = p_quote
  returning * into v_q;
  return v_q;
end;
$$;

revoke all on function public.declinar_orcamento(uuid, text) from public, anon;
grant execute on function public.declinar_orcamento(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 10b. excluir_orcamento: só admin, só aguardando (itens vão em cascata)
-- ----------------------------------------------------------------------------
create or replace function public.excluir_orcamento(p_quote uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q public.quotes;
begin
  perform public._quote_require_admin();
  if p_quote is null then
    raise exception 'Orçamento obrigatório' using errcode = '22004';
  end if;

  select * into v_q from public.quotes where id = p_quote for update;
  if not found then
    raise exception 'Orçamento não encontrado' using errcode = 'P0002';
  end if;
  if v_q.status <> 'aguardando' then
    raise exception 'Orçamento ORC-% já foi %; não pode ser excluído', v_q.numero, v_q.status
      using errcode = 'P0001';
  end if;

  delete from public.quotes where id = p_quote;
  return p_quote;
end;
$$;

revoke all on function public.excluir_orcamento(uuid) from public, anon;
grant execute on function public.excluir_orcamento(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 11. duplicar_orcamento (os 3 papéis): novo orçamento aguardando, mesmos itens.
--     validade = hoje + (validade antiga - data de criação antiga), mín. hoje.
-- ----------------------------------------------------------------------------
create or replace function public.duplicar_orcamento(p_quote uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q    public.quotes;
  v_novo uuid;
begin
  perform public._quote_require_user();
  select * into v_q from public.quotes where id = p_quote;
  if not found then
    raise exception 'Orçamento não encontrado' using errcode = 'P0002';
  end if;

  insert into public.quotes (
    client_id, building_id, tipo_servico, titulo, observacoes, validade,
    condicoes_pagamento, prazo_execucao, garantia, desconto, created_by
  ) values (
    v_q.client_id, v_q.building_id, v_q.tipo_servico, v_q.titulo, v_q.observacoes,
    public.hoje_brt()
      + greatest(v_q.validade - (v_q.created_at at time zone 'America/Sao_Paulo')::date, 0),
    v_q.condicoes_pagamento, v_q.prazo_execucao, v_q.garantia, 0, auth.uid()
  )
  returning id into v_novo;

  insert into public.quote_items
    (quote_id, catalog_item_id, descricao, unidade, quantidade, preco_unitario, ordem)
  select v_novo, i.catalog_item_id, i.descricao, i.unidade, i.quantidade, i.preco_unitario, i.ordem
  from public.quote_items i
  where i.quote_id = p_quote
  order by i.ordem, i.created_at;

  if v_q.desconto > 0 then
    update public.quotes set desconto = v_q.desconto where id = v_novo;
  end if;
  return v_novo;
end;
$$;

revoke all on function public.duplicar_orcamento(uuid) from public, anon;
grant execute on function public.duplicar_orcamento(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 12. Indicadores: orçamentos criados no período (datas de Curitiba).
--     security invoker: a RLS filtra (os 3 papéis ativos veem tudo).
--     p_inicio/p_fim nulos = sem limite naquele lado.
-- ----------------------------------------------------------------------------
create or replace function public.orcamentos_resumo(p_inicio date default null, p_fim date default null)
returns table (
  qtd_emitidos      integer,
  valor_emitido     numeric,
  qtd_aprovados     integer,
  valor_aprovado    numeric,
  qtd_aguardando    integer,
  valor_aguardando  numeric,
  qtd_declinados    integer,
  valor_declinado   numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)::integer,
    coalesce(sum(q.total), 0)::numeric(14,2),
    (count(*) filter (where q.status = 'aprovado'))::integer,
    coalesce(sum(q.total) filter (where q.status = 'aprovado'), 0)::numeric(14,2),
    (count(*) filter (where q.status = 'aguardando'))::integer,
    coalesce(sum(q.total) filter (where q.status = 'aguardando'), 0)::numeric(14,2),
    (count(*) filter (where q.status = 'declinado'))::integer,
    coalesce(sum(q.total) filter (where q.status = 'declinado'), 0)::numeric(14,2)
  from public.quotes q
  where (p_inicio is null or q.created_at >= (p_inicio::timestamp at time zone 'America/Sao_Paulo'))
    and (p_fim    is null or q.created_at <  ((p_fim + 1)::timestamp at time zone 'America/Sao_Paulo'));
$$;

revoke all on function public.orcamentos_resumo(date, date) from public, anon;
grant execute on function public.orcamentos_resumo(date, date) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 13. vw_quotes: orçamento + campos mínimos de cliente e prédio.
--     O técnico não lê clients e só lê buildings das OS dele (0002). DECISÃO
--     DO DONO: acesso geral do técnico ao orçamento, INCLUSIVE contato do
--     cliente (nome, e-mail, telefone, CNPJ) — exposição intencional. Por
--     isso a view roda como owner (security definer deliberado; o linter
--     security_definer_view do Supabase vai acusar, é esperado), com
--     security_barrier (o filtro de usuário ativo roda antes de qualquer
--     predicado do chamador) e só expõe cliente/prédio de quem tem orçamento.
-- ----------------------------------------------------------------------------
create or replace view public.vw_quotes with (security_barrier = true) as
select
  q.*,
  c.razao_social      as client_razao_social,
  c.nome_fantasia     as client_nome_fantasia,
  c.cnpj              as client_cnpj,
  c.contato_nome      as client_contato_nome,
  c.contato_email     as client_contato_email,
  c.contato_telefone  as client_contato_telefone,
  b.nome              as building_nome,
  b.logradouro        as building_logradouro,
  b.numero            as building_numero,
  b.bairro            as building_bairro,
  b.cidade            as building_cidade,
  b.uf                as building_uf,
  b.cep               as building_cep
from public.quotes q
join public.clients   c on c.id = q.client_id
join public.buildings b on b.id = q.building_id
where public.get_my_role() is not null;

revoke all on table public.vw_quotes from public, anon;
grant select on table public.vw_quotes to authenticated, service_role;

-- Opções de cliente/prédio para o formulário de orçamento (os 3 papéis):
-- clientes ativos com seus prédios.
create or replace function public.orcamento_opcoes_clientes()
returns table (
  client_id      uuid,
  razao_social   text,
  nome_fantasia  text,
  building_id    uuid,
  building_nome  text,
  bairro         text,
  cidade         text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public._quote_require_user();
  return query
    select c.id, c.razao_social, c.nome_fantasia, b.id, b.nome, b.bairro, b.cidade
    from public.clients c
    join public.buildings b on b.client_id = c.id
    where c.ativo
    order by c.razao_social, b.nome;
end;
$$;

revoke all on function public.orcamento_opcoes_clientes() from public, anon;
grant execute on function public.orcamento_opcoes_clientes() to authenticated;
