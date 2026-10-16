-- ============================================================================
-- Control Lead — Migration 0008: link da NFS-e (Onda 3G)
--  * invoices.nf_numero: número da NFS-e (já existe desde a 0001; garantido aqui)
--  * invoices.nf_url: link do PDF da NFS-e autorizada (webhook INVOICE_AUTHORIZED,
--    campo invoice.pdfUrl do Asaas). Só https é gravado/renderizado.
-- Idempotente: pode ser reaplicada.
-- ============================================================================

alter table public.invoices add column if not exists nf_numero text;
alter table public.invoices add column if not exists nf_url text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_nf_url_https') then
    alter table public.invoices
      add constraint invoices_nf_url_https check (nf_url is null or nf_url ~ '^https://');
  end if;
end $$;
