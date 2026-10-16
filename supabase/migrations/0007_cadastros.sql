-- ============================================================================
-- Control Lead — Migration 0007: cadastros (Onda 2D)
--  * equipment.numero_serie: chave natural da importação CSV de equipamentos
--  * pmoc_plans.responsavel_tecnico: RT do plano (Lei 13.589/2018)
--  * índice para casar prédio por (cliente, nome) na importação
-- Idempotente: pode ser reaplicada.
-- ============================================================================

alter table public.equipment add column if not exists numero_serie text;

-- unique simples (NULLs não conflitam): permite vários equipamentos sem série
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'equipment_numero_serie_key') then
    alter table public.equipment add constraint equipment_numero_serie_key unique (numero_serie);
  end if;
end $$;

alter table public.pmoc_plans add column if not exists responsavel_tecnico text;

create index if not exists idx_buildings_client_nome
  on public.buildings (client_id, lower(nome));
