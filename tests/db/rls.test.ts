import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, asUser, createDb, migrationFiles } from "./supabase-stub";

const ADMIN = "11111111-1111-4111-8111-000000000001";
const ATEND = "11111111-1111-4111-8111-000000000002";
const TEC1 = "11111111-1111-4111-8111-000000000003";
const TEC2 = "11111111-1111-4111-8111-000000000004";
const NOVO = "11111111-1111-4111-8111-000000000005";
const ADMIN2 = "11111111-1111-4111-8111-000000000006";

const CLIENT = "22222222-2222-4222-8222-000000000001";
const BUILDING = "33333333-3333-4333-8333-000000000001";
const EQUIP1 = "44444444-4444-4444-8444-000000000001";
const EQUIP2 = "44444444-4444-4444-8444-000000000002";
const PLAN = "55555555-5555-4555-8555-000000000001";
const OS_TEC1 = "66666666-6666-4666-8666-000000000001";
const OS_TEC2 = "66666666-6666-4666-8666-000000000002";
const CONTRATO_PMOC = "77777777-7777-4777-8777-000000000001";
const CONTRATO_AVULSO = "77777777-7777-4777-8777-000000000002";

let db: PGlite;

async function signup(id: string, email: string, meta: Record<string, unknown>) {
  await asService(
    db,
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)`,
    [id, email, JSON.stringify(meta)],
  );
}

async function hojeBrt(): Promise<string> {
  const [r] = await asService<{ d: string }>(db, `select public.hoje_brt()::text as d`);
  return r.d;
}

beforeAll(async () => {
  db = await createDb();

  // usuários: todos tentam se cadastrar como admin via metadata
  await signup(ADMIN, "admin@example.com", { full_name: "Admin", role: "admin" });
  await signup(ATEND, "atend@example.com", { full_name: "Atendente", role: "admin" });
  await signup(TEC1, "tec1@example.com", { full_name: "Técnico 1", role: "admin" });
  await signup(TEC2, "tec2@example.com", { full_name: "Técnico 2", role: "admin" });
  await signup(ADMIN2, "admin2@example.com", { full_name: "Admin 2" });

  // ativação inicial pelo serviço (sem JWT)
  await asService(db, `update public.profiles set role = 'admin', ativo = true where id = $1`, [ADMIN]);
  await asService(db, `update public.profiles set role = 'atendente', ativo = true where id = $1`, [ATEND]);
  await asService(db, `update public.profiles set ativo = true where id in ($1, $2)`, [TEC1, TEC2]);

  await asService(
    db,
    `insert into public.clients (id, razao_social) values ($1, 'Cliente Teste S.A.')`,
    [CLIENT],
  );
  await asService(
    db,
    `insert into public.buildings (id, client_id, nome) values ($1, $2, 'Prédio Teste')`,
    [BUILDING, CLIENT],
  );
  await asService(
    db,
    `insert into public.equipment (id, building_id, tipo, codigo_interno) values
       ($1, $3, 'split', '01-A1'), ($2, $3, 'chiller', '00-CAG')`,
    [EQUIP1, EQUIP2, BUILDING],
  );
  await asService(
    db,
    `insert into public.service_orders (id, tipo, status, building_id, equipment_id, technician_id, descricao)
     values ($1, 'corretiva', 'agendado', $3, $4, $5, 'Split pingando'),
            ($2, 'corretiva', 'aberto',   $3, null, $6, 'Outro chamado')`,
    [OS_TEC1, OS_TEC2, BUILDING, EQUIP1, TEC1, TEC2],
  );
  await asService(
    db,
    `insert into public.pmoc_plans (id, equipment_id, periodicidade_dias, proxima_data)
     values ($1, $2, 30, public.hoje_brt() - 2)`,
    [PLAN, EQUIP2],
  );
  await asService(
    db,
    `insert into public.contracts (id, client_id, tipo, valor_mensal, dia_vencimento, inicio)
     values ($1, $3, 'pmoc_recorrente', 5000, 10, public.hoje_brt() - 400),
            ($2, $3, 'corretiva_avulsa', 800, 5, public.hoje_brt() - 400)`,
    [CONTRATO_PMOC, CONTRATO_AVULSO, CLIENT],
  );
});

afterAll(async () => {
  await db?.close();
});

describe("cadastro e perfis", () => {
  it("signup com metadata role=admin nasce tecnico e inativo", async () => {
    await signup(NOVO, "novo@example.com", { full_name: "Fulano", role: "admin" });
    const [p] = await asService<{ role: string; ativo: boolean; full_name: string }>(
      db,
      `select role, ativo, full_name from public.profiles where id = $1`,
      [NOVO],
    );
    expect(p).toEqual({ role: "tecnico", ativo: false, full_name: "Fulano" });
  });

  it("usuário inativo não lê clients nem OS, mas vê o próprio perfil", async () => {
    expect(await asUser(db, NOVO, `select id from public.clients`)).toHaveLength(0);
    expect(await asUser(db, NOVO, `select id from public.service_orders`)).toHaveLength(0);
    const perfis = await asUser<{ id: string }>(db, NOVO, `select id from public.profiles`);
    expect(perfis.map((p) => p.id)).toEqual([NOVO]);
    const [r] = await asUser<{ role: string | null }>(db, NOVO, `select public.get_my_role() as role`);
    expect(r.role).toBeNull();
  });

  it("usuário ativo lê clients (sanidade)", async () => {
    expect(await asUser(db, ATEND, `select id from public.clients`)).toHaveLength(1);
  });

  it("usuário comum não altera o próprio role/ativo", async () => {
    await expect(
      asUser(db, TEC1, `update public.profiles set role = 'admin' where id = $1`, [TEC1]),
    ).rejects.toThrow(/Apenas admin/);
    await expect(
      asUser(db, NOVO, `update public.profiles set ativo = true where id = $1`, [NOVO]),
    ).rejects.toThrow(/Apenas admin/);
    // campos comuns continuam editáveis
    await asUser(db, TEC1, `update public.profiles set phone = '(41) 90000-0000' where id = $1`, [TEC1]);
  });
});

describe("admin_set_user_access", () => {
  it("admin ativa e define papel", async () => {
    const [p] = await asUser<{ role: string; ativo: boolean }>(
      db,
      ADMIN,
      `select role, ativo from public.admin_set_user_access($1, 'atendente', true)`,
      [NOVO],
    );
    expect(p).toEqual({ role: "atendente", ativo: true });
    expect(await asUser(db, NOVO, `select id from public.clients`)).toHaveLength(1);
  });

  it("não-admin não pode chamar", async () => {
    await expect(
      asUser(db, TEC1, `select public.admin_set_user_access($1, 'admin', true)`, [TEC1]),
    ).rejects.toThrow(/Apenas admin/);
  });

  it("bloqueia rebaixar/desativar o último admin ativo", async () => {
    await expect(
      asUser(db, ADMIN, `select public.admin_set_user_access($1, 'atendente', true)`, [ADMIN]),
    ).rejects.toThrow(/último admin/);
    await expect(
      asUser(db, ADMIN, `select public.admin_set_user_access($1, 'admin', false)`, [ADMIN]),
    ).rejects.toThrow(/último admin/);

    // com um segundo admin ativo, o primeiro pode sair
    await asUser(db, ADMIN, `select public.admin_set_user_access($1, 'admin', true)`, [ADMIN2]);
    await asUser(db, ADMIN2, `select public.admin_set_user_access($1, 'atendente', true)`, [ADMIN]);
    const [p] = await asService<{ role: string }>(db, `select role from public.profiles where id = $1`, [ADMIN]);
    expect(p.role).toBe("atendente");
    // devolve o papel para os próximos testes
    await asUser(db, ADMIN2, `select public.admin_set_user_access($1, 'admin', true)`, [ADMIN]);
  });

  it("anon não executa funções administrativas internas", async () => {
    const rows = await asService<{ ok: boolean }>(
      db,
      `select has_function_privilege('authenticated', 'public._generate_pmoc_service_orders_job(integer)', 'execute') as ok
       union all
       select has_function_privilege('anon', 'public.admin_set_user_access(uuid, public.user_role, boolean)', 'execute')
       union all
       select has_function_privilege('anon', 'public.dashboard_resumo()', 'execute')
       union all
       select has_function_privilege('service_role', 'public._generate_monthly_invoices_job(date)', 'execute')`,
    );
    expect(rows.map((r) => r.ok)).toEqual([false, false, false, false]);
  });
});

describe("OS: técnico", () => {
  it("técnico não lê nem altera OS de outro técnico", async () => {
    const vis = await asUser<{ id: string }>(db, TEC1, `select id from public.service_orders`);
    expect(vis.map((r) => r.id)).toEqual([OS_TEC1]);
    const upd = await asUser(
      db,
      TEC1,
      `update public.service_orders set laudo = 'x' where id = $1 returning id`,
      [OS_TEC2],
    );
    expect(upd).toHaveLength(0);
  });

  it("OS corretiva agendada marca equipamento com chamado; em_campo marca técnico em campo", async () => {
    const st = async () =>
      (await asService<{ status: string }>(db, `select status from public.equipment where id = $1`, [EQUIP1]))[0]
        .status;
    // OS foi inserida como agendada (corretiva)
    expect(await st()).toBe("chamado_aberto");
    await asUser(db, TEC1, `update public.service_orders set status = 'em_campo' where id = $1`, [OS_TEC1]);
    expect(await st()).toBe("tecnico_em_campo");
  });

  it("técnico não altera descrição, concluded_at nem cancela", async () => {
    await expect(
      asUser(db, TEC1, `update public.service_orders set descricao = 'outra' where id = $1`, [OS_TEC1]),
    ).rejects.toThrow(/Técnico só pode/);
    await expect(
      asUser(db, TEC1, `update public.service_orders set concluded_at = now() where id = $1`, [OS_TEC1]),
    ).rejects.toThrow(/Técnico só pode/);
    await expect(
      asUser(db, TEC1, `update public.service_orders set status = 'cancelado' where id = $1`, [OS_TEC1]),
    ).rejects.toThrow(/Transição de status inválida/);
  });

  it("técnico conclui (concluded_at automático) e não reabre OS concluída", async () => {
    await asUser(
      db,
      TEC1,
      `update public.service_orders
          set status = 'concluido', laudo = 'Dreno desobstruído',
              assinado_por_nome = 'Zelador', assinado_em = now(),
              observacoes_tecnicas = 'ok'
        where id = $1`,
      [OS_TEC1],
    );
    const [os] = await asService<{ concluded_at: string | null }>(
      db,
      `select concluded_at from public.service_orders where id = $1`,
      [OS_TEC1],
    );
    expect(os.concluded_at).not.toBeNull();
    const [eq] = await asService<{ status: string }>(db, `select status from public.equipment where id = $1`, [EQUIP1]);
    expect(eq.status).toBe("operacional");

    await expect(
      asUser(db, TEC1, `update public.service_orders set status = 'em_campo' where id = $1`, [OS_TEC1]),
    ).rejects.toThrow(/técnico não pode alterá-la/);
    await expect(
      asUser(db, TEC1, `update public.service_orders set laudo = 'editado' where id = $1`, [OS_TEC1]),
    ).rejects.toThrow(/técnico não pode alterá-la/);
  });
});

describe("Storage e fotos", () => {
  it("técnico sobe arquivo só na própria OS em aberto; admin sempre", async () => {
    // OS_TEC2 está aberta e é do TEC2
    await asUser(
      db,
      TEC2,
      `insert into storage.objects (bucket_id, name) values ('os-fotos', $1)`,
      [`${OS_TEC2}/antes/foto1.jpg`],
    );
    await expect(
      asUser(db, TEC1, `insert into storage.objects (bucket_id, name) values ('os-fotos', $1)`, [
        `${OS_TEC2}/foto-intrusa.jpg`,
      ]),
    ).rejects.toThrow(/row-level security/);
    // OS_TEC1 já está concluída
    await expect(
      asUser(db, TEC1, `insert into storage.objects (bucket_id, name) values ('os-fotos', $1)`, [
        `${OS_TEC1}/depois.jpg`,
      ]),
    ).rejects.toThrow(/row-level security/);
    // caminho fora do padrão não quebra a listagem
    await asService(db, `insert into storage.objects (bucket_id, name) values ('os-fotos', 'lixo/sem-uuid.jpg')`);
    const vis = await asUser<{ name: string }>(db, TEC2, `select name from storage.objects`);
    expect(vis.map((v) => v.name)).toEqual([`${OS_TEC2}/antes/foto1.jpg`]);
    expect(await asUser(db, TEC1, `select name from storage.objects`)).toHaveLength(0);
    // delete só admin
    const del = await asUser(db, TEC2, `delete from storage.objects returning id`);
    expect(del).toHaveLength(0);

    const [b] = await asService<{ n: number }>(
      db,
      `select count(*)::int as n from storage.buckets where id in ('os-fotos','os-assinaturas') and not public`,
    );
    expect(b.n).toBe(2);
  });

  it("service_order_photos segue a OS", async () => {
    await asUser(
      db,
      TEC2,
      `insert into public.service_order_photos (service_order_id, storage_path, legenda) values ($1, $2, 'antes')`,
      [OS_TEC2, `${OS_TEC2}/antes/foto1.jpg`],
    );
    expect(await asUser(db, TEC1, `select id from public.service_order_photos`)).toHaveLength(0);
    expect(await asUser(db, TEC2, `select id from public.service_order_photos`)).toHaveLength(1);
    expect(await asUser(db, ATEND, `select id from public.service_order_photos`)).toHaveLength(1);
  });
});

describe("PMOC", () => {
  it("gera OS sem avançar o plano; reprograma ao concluir", async () => {
    const hoje = await hojeBrt();
    await expect(
      asUser(db, TEC1, `select public.generate_pmoc_service_orders(7)`),
    ).rejects.toThrow(/Apenas admin/);

    const [g1] = await asUser<{ n: number }>(db, ADMIN, `select public.generate_pmoc_service_orders(7) as n`);
    expect(g1.n).toBe(1);
    const [g2] = await asUser<{ n: number }>(db, ADMIN, `select public.generate_pmoc_service_orders(7) as n`);
    expect(g2.n).toBe(0);

    const [antes] = await asService<{ d: string }>(
      db,
      `select proxima_data::text as d from public.pmoc_plans where id = $1`,
      [PLAN],
    );
    const [esperadoAntes] = await asService<{ d: string }>(db, `select ($1::date - 2)::text as d`, [hoje]);
    expect(antes.d).toBe(esperadoAntes.d);

    const [os] = await asService<{ id: string; prioridade: string; hora: string }>(
      db,
      `select id, prioridade::text,
              to_char(scheduled_at at time zone 'America/Sao_Paulo', 'HH24:MI') as hora
         from public.service_orders where pmoc_plan_id = $1`,
      [PLAN],
    );
    expect(os.prioridade).toBe("alta");
    expect(os.hora).toBe("09:00");

    await asUser(
      db,
      ADMIN,
      `update public.service_orders set technician_id = $2, status = 'agendado' where id = $1`,
      [os.id, TEC1],
    );
    await asUser(db, TEC1, `update public.service_orders set status = 'em_campo' where id = $1`, [os.id]);
    await asUser(db, TEC1, `update public.service_orders set status = 'concluido' where id = $1`, [os.id]);

    const [depois] = await asService<{ d: string }>(
      db,
      `select proxima_data::text as d from public.pmoc_plans where id = $1`,
      [PLAN],
    );
    const [esperado] = await asService<{ d: string }>(db, `select ($1::date + 30)::text as d`, [hoje]);
    expect(depois.d).toBe(esperado.d);

    // plano reprogramado para +30 dias: nada novo a gerar
    const [g3] = await asUser<{ n: number }>(db, ADMIN, `select public.generate_pmoc_service_orders(7) as n`);
    expect(g3.n).toBe(0);
  });
});

describe("Financeiro", () => {
  it("generate_monthly_invoices é idempotente e ignora corretiva avulsa", async () => {
    await expect(asUser(db, ATEND, `select public.generate_monthly_invoices()`)).rejects.toThrow(
      /Apenas admin/,
    );
    const [a] = await asUser<{ n: number }>(db, ADMIN, `select public.generate_monthly_invoices() as n`);
    expect(a.n).toBe(1);
    const [b] = await asUser<{ n: number }>(db, ADMIN, `select public.generate_monthly_invoices() as n`);
    expect(b.n).toBe(0);

    const [inv] = await asService<{ competencia: string; vencimento: string; esperado_comp: string }>(
      db,
      `select competencia::text, vencimento::text,
              date_trunc('month', public.hoje_brt())::date::text as esperado_comp
         from public.invoices where contract_id = $1`,
      [CONTRATO_PMOC],
    );
    expect(inv.competencia).toBe(inv.esperado_comp);
    expect(inv.vencimento.slice(8)).toBe("10");

    // competência explícita (normaliza para o dia 1)
    const [c] = await asUser<{ n: number }>(
      db,
      ADMIN,
      `select public.generate_monthly_invoices((date_trunc('month', public.hoje_brt()) - interval '1 month')::date + 14) as n`,
    );
    expect(c.n).toBe(1);
  });

  it("mark_overdue_invoices marca pendentes vencidas como atrasado", async () => {
    await asService(
      db,
      `update public.invoices set vencimento = public.hoje_brt() - 1 where contract_id = $1`,
      [CONTRATO_PMOC],
    );
    const [r] = await asUser<{ n: number }>(db, ADMIN, `select public.mark_overdue_invoices() as n`);
    expect(r.n).toBe(2);
    const rows = await asService<{ status: string }>(
      db,
      `select distinct status::text from public.invoices where contract_id = $1`,
      [CONTRATO_PMOC],
    );
    expect(rows).toEqual([{ status: "atrasado" }]);
  });

  it("webhook_events não é acessível por usuários", async () => {
    await expect(asUser(db, ADMIN, `select * from public.webhook_events`)).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("migrations + seed", () => {
  it("seed aplica limpo sobre todas as migrations e ativa a equipe", async () => {
    const seeded = await createDb({ seed: true });
    try {
      const rows = await seeded.query<{ n: number }>(
        `select count(*)::int as n from public.profiles where ativo`,
      );
      expect(rows.rows[0].n).toBe(5);
      const emails = await seeded.query<{ n: number }>(
        `select count(*)::int as n from auth.users where email not like '%@example.com'`,
      );
      expect(emails.rows[0].n).toBe(0);
    } finally {
      await seeded.close();
    }
  });

  it("0008: invoices.nf_url existe e só aceita https", async () => {
    const files = migrationFiles().map((f) => f.split("/").pop());
    expect(files).toContain("0007_cadastros.sql");
    expect(files).toContain("0008_nfse_link.sql");
    const cols = await db.query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'invoices'
          and column_name in ('nf_numero', 'nf_url')`,
    );
    expect(cols.rows.map((r) => r.column_name).sort()).toEqual(["nf_numero", "nf_url"]);
    const [chk] = await asService<{ n: number }>(
      db,
      `select count(*)::int as n from pg_constraint where conname = 'invoices_nf_url_https'`,
    );
    expect(chk.n).toBe(1);
  });

  it("blocos de pg_cron são ignorados onde a extensão não existe", async () => {
    for (const file of migrationFiles()) {
      const blocks = readFileSync(file, "utf8").match(/-- @cron-begin[\s\S]*?-- @cron-end/g) ?? [];
      for (const block of blocks) {
        await db.exec(block);
      }
    }
  });
});
