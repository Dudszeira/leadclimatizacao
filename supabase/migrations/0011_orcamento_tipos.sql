-- ============================================================================
-- 0011 — Orçamentos: tipos de serviço Diagnóstico, Instalação, Corretiva e
--        Preventiva.
--
-- quotes.tipo_servico deixa de ser public.os_type (só aceitava instalacao /
-- corretiva) e vira text com os 4 tipos do orçamento. Na aprovação o tipo do
-- orçamento é convertido no tipo da OS:
--   diagnostico -> corretiva        (checklist "Corretiva — diagnóstico padrão")
--   preventiva  -> preventiva_pmoc  (OS sem equipamento/plano: fora do calendário PMOC)
--   instalacao / corretiva -> mesmo tipo
-- vw_quotes depende da coluna (q.*): sai e volta igual à 0010.
-- ============================================================================

drop view if exists public.vw_quotes;

alter table public.quotes drop constraint if exists quotes_tipo_servico_check;
alter table public.quotes alter column tipo_servico drop default;
alter table public.quotes alter column tipo_servico type text using tipo_servico::text;
alter table public.quotes alter column tipo_servico set default 'instalacao';
alter table public.quotes add constraint quotes_tipo_servico_check
  check (tipo_servico in ('diagnostico', 'instalacao', 'corretiva', 'preventiva'));

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
      coalesce(nullif(p_header ->> 'tipo_servico', ''), 'instalacao'),
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
      tipo_servico        = coalesce(nullif(p_header ->> 'tipo_servico', ''), 'instalacao'),
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
    case v_q.tipo_servico
      when 'diagnostico' then 'corretiva'
      when 'preventiva'  then 'preventiva_pmoc'
      else v_q.tipo_servico
    end::public.os_type,
    'aberto', 'manual', v_q.building_id,
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
