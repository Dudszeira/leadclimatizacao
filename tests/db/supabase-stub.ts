/**
 * Banco Postgres em memória (PGlite) com stubs mínimos do Supabase
 * (schemas auth/storage, roles anon/authenticated/service_role, auth.uid())
 * e as migrations de supabase/migrations aplicadas em ordem.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const SUPABASE_DIR = join(__dirname, "..", "..", "supabase");

const STUB_SQL = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema if not exists auth;
create schema if not exists storage;

create table auth.users (
  instance_id         uuid,
  id                  uuid primary key,
  aud                 text,
  role                text,
  email               text,
  encrypted_password  text,
  email_confirmed_at  timestamptz,
  raw_app_meta_data   jsonb default '{}'::jsonb,
  raw_user_meta_data  jsonb default '{}'::jsonb,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table storage.buckets (
  id                  text primary key,
  name                text not null,
  owner               uuid,
  public              boolean default false,
  file_size_limit     bigint,
  allowed_mime_types  text[],
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create table storage.objects (
  id          uuid primary key default gen_random_uuid(),
  bucket_id   text references storage.buckets (id),
  name        text not null,
  owner       uuid default auth.uid(),
  metadata    jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;

create function storage.foldername(name text) returns text[]
language plpgsql immutable as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1 : array_length(_parts, 1) - 1];
end
$$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
grant all on storage.objects to anon, authenticated, service_role;

-- igual ao Supabase: tudo que for criado em public já nasce com grant p/ as roles da API
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export function migrationFiles(): string[] {
  const dir = join(SUPABASE_DIR, "migrations");
  return readdirSync(dir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort()
    .map((f) => join(dir, f));
}

/** Remove blocos de pg_cron (marcados com -- @cron-begin / -- @cron-end). */
export function stripCron(sql: string): string {
  return sql.replace(/-- @cron-begin[\s\S]*?-- @cron-end/g, "");
}

export async function createDb(opts: { seed?: boolean } = {}): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(STUB_SQL);
  for (const file of migrationFiles()) {
    try {
      await db.exec(stripCron(readFileSync(file, "utf8")));
    } catch (e) {
      throw new Error(`Falha ao aplicar ${file}: ${(e as Error).message}`);
    }
  }
  if (opts.seed) {
    await db.exec(readFileSync(join(SUPABASE_DIR, "seed.sql"), "utf8"));
  }
  return db;
}

/**
 * Executa uma query como usuário autenticado (role authenticated + JWT sub),
 * dentro de uma transação. Erros fazem rollback e são relançados.
 */
export async function asUser<T = Record<string, unknown>>(
  db: PGlite,
  uid: string,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await db.exec("begin");
  try {
    await db.exec("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    const res = await db.query<T>(sql, params);
    await db.exec("commit");
    return res.rows;
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}

/** Query como superusuário/serviço (sem JWT; ignora RLS). */
export async function asService<T = Record<string, unknown>>(
  db: PGlite,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await db.query<T>(sql, params);
  return res.rows;
}
