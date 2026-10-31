import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, asUser, createDb, migrationFiles, stripCron } from "./supabase-stub";

/** Módulo de Orçamentos (0010): leitura por RLS, escrita só por RPC, totais, imutabilidade. */

const ADMIN = "11111111-1111-4111-8111-0000000000a1";
const ATEND = "11111111-1111-4111-8111-0000000000a2";
const TEC = "11111111-1111-4111-8111-0000000000a3";

const CLIENT_A = "22222222-2222-4222-8222-0000000000a1";
const CLIENT_B = "22222222-2222-4222-8222-0000000000a2";
const BUILD_A = "33333333-3333-4333-8333-0000000000a1";
const BUILD_B = "33333333-3333-4333-8333-0000000000a2";

let db: PGlite;
let catalogId: string;

async function signup(id: string, email: string) {
  await asService(db, `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{}'::jsonb)`, [
    id,
    email,
  ]);
}

async function hoje(offset = 0): Promise<string> {
  const [r] = await asService<{ d: string }>(db, `select (public.hoje_brt() + $1::int)::text as d`, [offset]);
  return r.d;
}

interface Item {
  catalog_item_id?: string | null;
  descricao: string;
  unidade?: string;
  quantidade: number;
  preco_unitario: number;
}

async function salvar(
  uid: string,
  quoteId: string | null,
  header: Record<string, unknown>,
  items: Item[],
): Promise<string> {
  const [r] = await asUser<{ id: string }>(db, uid, `select public.salvar_orcamento($1, $2::jsonb, $3::jsonb) as id`, [
    quoteId,
    JSON.stringify(header),
    JSON.stringify(items),
  ]);
  return r.id;
}

/** aprovar_orcamento; updatedAt nulo = o updated_at atual do orçamento. */
async function aprovar(
  uid: string,
  id: string,
  opts: { venc?: string; updatedAt?: string; aceitarVencido?: boolean } = {},
) {
  const [r] = await asUser<{ r: { service_order_id: string; invoice_id: string; contract_id: string } }>(
    db,
    uid,
    `select public.aprovar_orcamento(
       $1,
       coalesce($2::date, public.hoje_brt()),
       coalesce($3::timestamptz, (select q.updated_at from public.quotes q where q.id = $1)),
       $4
     ) as r`,
    [id, opts.venc ?? null, opts.updatedAt ?? null, opts.aceitarVencido ?? false],
  );
  return r.r;
}

const DENIED = /permission denied/;

async function header(extra: Record<string, unknown> = {}) {
  return {
    client_id: CLIENT_A,
    building_id: BUILD_A,
    tipo_servico: "instalacao",
    titulo: "Instalação de splits",
    validade: await hoje(15),
    desconto: 0,
    ...extra,
  };
}

async function quote(id: string) {
  const [q] = await asService<{
    status: string;
    subtotal: string;
    total: string;
    desconto: string;
    service_order_id: string | null;
    invoice_id: string | null;
    numero: string;
  }>(db, `select * from public.quotes where id = $1`, [id]);
  return q;
}

beforeAll(async () => {
  db = await createDb();
  await signup(ADMIN, "adm@example.com");
  await signup(ATEND, "at@example.com");
  await signup(TEC, "tec@example.com");
  await asService(db, `update public.profiles set role = 'admin', ativo = true where id = $1`, [ADMIN]);
  await asService(db, `update public.profiles set role = 'atendente', ativo = true where id = $1`, [ATEND]);
  await asService(db, `update public.profiles set role = 'tecnico', ativo = true where id = $1`, [TEC]);

  await asService(db, `insert into public.clients (id, razao_social) values ($1, 'Cliente A'), ($2, 'Cliente B')`, [
    CLIENT_A,
    CLIENT_B,
  ]);
  await asService(
    db,
    `insert into public.buildings (id, client_id, nome) values ($1, $2, 'Prédio A'), ($3, $4, 'Prédio B')`,
    [BUILD_A, CLIENT_A, BUILD_B, CLIENT_B],
  );
  const [c] = await asUser<{ id: string }>(
    db,
    ADMIN,
    `insert into public.service_catalog (nome, unidade, preco) values ('Instalação split 12k BTU', 'un', 1200) returning id`,
  );
  catalogId = c.id;
});

afterAll(async () => {
  await db?.close();
});

describe("migrations 0010 e 0011", () => {
  it("são idempotentes (reaplicar em ordem não falha)", async () => {
    for (const nome of ["0010_orcamentos", "0011_orcamento_tipos"]) {
      const file = migrationFiles().find((f) => f.includes(nome));
      expect(file).toBeDefined();
      await db.exec(stripCron(readFileSync(file as string, "utf8")));
    }
  });
});

describe("RLS: matriz de papéis", () => {
  it("atendente e técnico leem, criam, editam (aguardando) e duplicam; não apagam, aprovam, declinam nem escrevem catálogo", async () => {
    for (const uid of [ATEND, TEC]) {
      const id = await salvar(uid, null, await header(), [{ descricao: "Item", quantidade: 1, preco_unitario: 100 }]);
      const [own] = await asUser<{ created_by: string; total: string }>(
        db,
        uid,
        `select created_by, total from public.quotes where id = $1`,
        [id],
      );
      expect(own.created_by).toBe(uid);
      expect(Number(own.total)).toBe(100);
      expect(await asUser(db, uid, `select id from public.quote_items where quote_id = $1`, [id])).toHaveLength(1);
      expect(await asUser(db, uid, `select id from public.service_catalog`)).toHaveLength(1);

      // edição enquanto aguardando
      await salvar(uid, id, await header({ titulo: "Editado" }), [{ descricao: "Novo", quantidade: 2, preco_unitario: 75 }]);
      expect(Number((await quote(id)).total)).toBe(150);
      await expect(
        asUser(db, uid, `update public.quote_items set quantidade = 3 where quote_id = $1`, [id]),
      ).rejects.toThrow(DENIED);

      // view com cliente/prédio (técnico não lê clients pela RLS)
      const [v] = await asUser<{ client_razao_social: string; building_nome: string }>(
        db,
        uid,
        `select client_razao_social, building_nome from public.vw_quotes where id = $1`,
        [id],
      );
      expect(v).toEqual({ client_razao_social: "Cliente A", building_nome: "Prédio A" });
      const opcoes = await asUser(db, uid, `select * from public.orcamento_opcoes_clientes()`);
      expect(opcoes.length).toBeGreaterThanOrEqual(2);

      const [dup] = await asUser<{ id: string }>(db, uid, `select public.duplicar_orcamento($1) as id`, [id]);
      expect((await quote(dup.id)).status).toBe("aguardando");

      // proibido
      await expect(asUser(db, uid, `delete from public.quotes where id = $1`, [id])).rejects.toThrow(DENIED);
      await expect(asUser(db, uid, `select public.excluir_orcamento($1)`, [id])).rejects.toThrow(/Apenas admin/);
      await expect(
        asUser(db, uid, `insert into public.service_catalog (nome, preco) values ('x', 1)`),
      ).rejects.toThrow(/row-level security/);
      const upd = await asUser(db, uid, `update public.service_catalog set preco = 1 returning id`);
      expect(upd).toHaveLength(0);
      await expect(aprovar(uid, id)).rejects.toThrow(/Apenas admin/);
      await expect(asUser(db, uid, `select public.declinar_orcamento($1, null)`, [id])).rejects.toThrow(/Apenas admin/);
      await expect(
        asUser(db, uid, `update public.quotes set status = 'aprovado' where id = $1`, [id]),
      ).rejects.toThrow(DENIED);

      const [r] = await asUser<{ qtd_emitidos: number }>(db, uid, `select * from public.orcamentos_resumo(null, null)`);
      expect(r.qtd_emitidos).toBeGreaterThanOrEqual(2);

      await asService(db, `delete from public.quotes where id in ($1, $2)`, [id, dup.id]);
    }
  });

  it("usuário inativo não vê nada", async () => {
    const INATIVO = "11111111-1111-4111-8111-0000000000a9";
    await signup(INATIVO, "inativo@example.com");
    await salvar(ADMIN, null, await header(), [{ descricao: "x", quantidade: 1, preco_unitario: 1 }]);
    expect(await asUser(db, INATIVO, `select id from public.quotes`)).toHaveLength(0);
    expect(await asUser(db, INATIVO, `select id from public.vw_quotes`)).toHaveLength(0);
    expect(await asUser(db, INATIVO, `select id from public.service_catalog`)).toHaveLength(0);
    await expect(
      salvar(INATIVO, null, await header(), [{ descricao: "x", quantidade: 1, preco_unitario: 1 }]),
    ).rejects.toThrow(/Sem permissão/);
  });

  it("admin lê o catálogo", async () => {
    expect(await asUser(db, ADMIN, `select id from public.service_catalog`)).toHaveLength(1);
  });
});

describe("totais", () => {
  it("subtotal/total recalculam com itens e desconto (trigger vale até para o serviço)", async () => {
    const id = await salvar(ADMIN, null, await header({ desconto: 100 }), [
      { catalog_item_id: catalogId, descricao: "Instalação split 12k", quantidade: 2, preco_unitario: 1200 },
      { descricao: "Tubulação de cobre", unidade: "m", quantidade: 3.5, preco_unitario: 85.5 },
    ]);
    let q = await quote(id);
    // 2400 + 299.25 = 2699.25 - 100
    expect(Number(q.subtotal)).toBe(2699.25);
    expect(Number(q.total)).toBe(2599.25);

    await asService(db, `insert into public.quote_items (quote_id, descricao, quantidade, preco_unitario) values ($1, 'Visita', 1, 150)`, [id]);
    q = await quote(id);
    expect(Number(q.subtotal)).toBe(2849.25);
    expect(Number(q.total)).toBe(2749.25);

    await asService(db, `update public.quotes set subtotal = 1, total = 1, desconto = 49.25 where id = $1`, [id]);
    q = await quote(id);
    expect(Number(q.subtotal)).toBe(2849.25);
    expect(Number(q.total)).toBe(2800);

    await asService(db, `delete from public.quote_items where quote_id = $1 and descricao = 'Visita'`, [id]);
    q = await quote(id);
    expect(Number(q.total)).toBe(2650);

    await expect(
      asService(db, `update public.quotes set desconto = 999999 where id = $1`, [id]),
    ).rejects.toThrow(/desconto/);

    // edição via RPC substitui itens atomicamente
    await salvar(ADMIN, id, await header({ desconto: 10 }), [{ descricao: "Único", quantidade: 1, preco_unitario: 500 }]);
    q = await quote(id);
    expect(Number(q.subtotal)).toBe(500);
    expect(Number(q.total)).toBe(490);
    const itens = await asService(db, `select id from public.quote_items where quote_id = $1`, [id]);
    expect(itens).toHaveLength(1);
  });

  it("escrita direta em quotes/quote_items é negada aos 3 papéis (inclusive admin)", async () => {
    const id = await salvar(ADMIN, null, await header(), [{ descricao: "x", quantidade: 1, preco_unitario: 10 }]);
    for (const uid of [ADMIN, ATEND, TEC]) {
      await expect(
        asUser(db, uid, `insert into public.quotes (client_id, building_id, titulo, validade) values ($1, $2, 'y', public.hoje_brt())`, [
          CLIENT_A,
          BUILD_A,
        ]),
      ).rejects.toThrow(DENIED);
      await expect(asUser(db, uid, `update public.quotes set titulo = 'z' where id = $1`, [id])).rejects.toThrow(DENIED);
      await expect(asUser(db, uid, `update public.quotes set status = 'aprovado' where id = $1`, [id])).rejects.toThrow(
        DENIED,
      );
      await expect(asUser(db, uid, `delete from public.quotes where id = $1`, [id])).rejects.toThrow(DENIED);
      await expect(
        asUser(db, uid, `insert into public.quote_items (quote_id, descricao, quantidade, preco_unitario) values ($1, 'x', 1, 1)`, [id]),
      ).rejects.toThrow(DENIED);
      await expect(asUser(db, uid, `update public.quote_items set quantidade = 5 where quote_id = $1`, [id])).rejects.toThrow(
        DENIED,
      );
      await expect(asUser(db, uid, `delete from public.quote_items where quote_id = $1`, [id])).rejects.toThrow(DENIED);
      // sequence: ninguém queima/ajusta a numeração
      await expect(asUser(db, uid, `select nextval('public.quote_numero_seq')`)).rejects.toThrow(DENIED);
      await expect(asUser(db, uid, `select setval('public.quote_numero_seq', 5000)`)).rejects.toThrow(DENIED);
    }
    expect((await quote(id)).status).toBe("aguardando");
    expect(Number((await quote(id)).total)).toBe(10);
  });

  it("numero e created_at não são manipuláveis (nem pelo serviço)", async () => {
    const id = await salvar(ADMIN, null, await header(), [{ descricao: "x", quantidade: 1, preco_unitario: 10 }]);
    const [antes] = await asService<{ numero: string; created_at: string; created_by: string }>(
      db,
      `select numero, created_at::text, created_by from public.quotes where id = $1`,
      [id],
    );
    expect(antes.created_by).toBe(ADMIN);
    await asService(
      db,
      `update public.quotes set numero = -1, created_at = now() - interval '400 days', created_by = $2 where id = $1`,
      [id, TEC],
    );
    const [depois] = await asService<{ numero: string; created_at: string; created_by: string }>(
      db,
      `select numero, created_at::text, created_by from public.quotes where id = $1`,
      [id],
    );
    expect(depois).toEqual(antes);

    // INSERT ignora numero/created_at informados: sempre nextval/now()
    const [ins] = await asService<{ numero: string; velho: boolean }>(
      db,
      `insert into public.quotes (numero, created_at, client_id, building_id, titulo, validade)
       values (-1, now() - interval '400 days', $1, $2, 'svc', public.hoje_brt())
       returning numero, created_at < now() - interval '1 day' as velho`,
      [CLIENT_A, BUILD_A],
    );
    expect(Number(ins.numero)).toBeGreaterThan(Number(antes.numero));
    expect(ins.velho).toBe(false);
    // e salvar_orcamento continua funcionando (sem duplicate key)
    await salvar(ATEND, null, await header(), [{ descricao: "x", quantidade: 1, preco_unitario: 1 }]);
  });

  it("cliente inativo é recusado ao criar/trocar cliente", async () => {
    const CLIENT_INAT = "22222222-2222-4222-8222-0000000000a9";
    const BUILD_INAT = "33333333-3333-4333-8333-0000000000a9";
    await asService(db, `insert into public.clients (id, razao_social, ativo) values ($1, 'Cliente Inativo', false)`, [
      CLIENT_INAT,
    ]);
    await asService(db, `insert into public.buildings (id, client_id, nome) values ($1, $2, 'Prédio I')`, [
      BUILD_INAT,
      CLIENT_INAT,
    ]);
    const item = [{ descricao: "x", quantidade: 1, preco_unitario: 1 }];
    await expect(
      salvar(ADMIN, null, await header({ client_id: CLIENT_INAT, building_id: BUILD_INAT }), item),
    ).rejects.toThrow(/Cliente inativo/);
    const id = await salvar(ADMIN, null, await header(), item);
    await expect(
      salvar(ADMIN, id, await header({ client_id: CLIENT_INAT, building_id: BUILD_INAT }), item),
    ).rejects.toThrow(/Cliente inativo/);
  });

  it("_quote_building_ok e demais auxiliares não são executáveis pela API", async () => {
    for (const fn of [
      `public._quote_building_ok($1::uuid, $2::uuid)`,
      `public._quote_client_ativo($1::uuid)`,
      `public._quote_require_admin()`,
      `public._quote_require_user()`,
      `public._quote_insert_items($1::uuid, '[]'::jsonb)`,
    ]) {
      const params = fn.includes("$2") ? [BUILD_A, CLIENT_A] : fn.includes("$1") ? [BUILD_A] : [];
      await expect(asUser(db, ADMIN, `select ${fn}`, params)).rejects.toThrow(DENIED);
    }
  });

  it("prédio de outro cliente é recusado", async () => {
    await expect(
      salvar(ADMIN, null, await header({ building_id: BUILD_B }), [{ descricao: "x", quantidade: 1, preco_unitario: 1 }]),
    ).rejects.toThrow(/não pertence ao cliente/);
  });

  it("orçamento sem itens é recusado", async () => {
    await expect(salvar(ADMIN, null, await header(), [])).rejects.toThrow(/pelo menos 1 item/);
  });
});

describe("aprovar", () => {
  it("cria OS + contrato avulso encerrado + fatura; congela o orçamento; 2ª chamada falha sem duplicar", async () => {
    const id = await salvar(ADMIN, null, await header({ titulo: "Instalação loja", desconto: 50 }), [
      { descricao: "Split 18k", quantidade: 1, preco_unitario: 3050 },
    ]);
    const venc = await hoje(10);
    const r = { r: await aprovar(ADMIN, id, { venc }) };
    const q = await quote(id);
    expect(q.status).toBe("aprovado");
    expect(q.service_order_id).toBe(r.r.service_order_id);
    expect(q.invoice_id).toBe(r.r.invoice_id);

    const [os] = await asService<{ tipo: string; status: string; building_id: string; descricao: string; created_by: string }>(
      db,
      `select * from public.service_orders where id = $1`,
      [r.r.service_order_id],
    );
    expect(os).toMatchObject({ tipo: "instalacao", status: "aberto", building_id: BUILD_A, created_by: ADMIN });
    expect(os.descricao).toContain(`ORC-${q.numero}: Instalação loja`);
    expect(os.descricao).toContain("Split 18k");

    const [ct] = await asService<{ tipo: string; status: string; valor_mensal: string; quote_id: string }>(
      db,
      `select * from public.contracts where id = $1`,
      [r.r.contract_id],
    );
    expect(ct).toMatchObject({ tipo: "corretiva_avulsa", status: "encerrado", quote_id: id });
    expect(Number(ct.valor_mensal)).toBe(3000);

    const [inv] = await asService<{ valor: string; status: string; vencimento: string; competencia: string }>(
      db,
      `select valor, status, vencimento::text, competencia::text from public.invoices where id = $1`,
      [r.r.invoice_id],
    );
    expect(Number(inv.valor)).toBe(3000);
    expect(inv.status).toBe("pendente");
    expect(inv.vencimento).toBe(venc);
    expect(inv.competencia).toBe(`${(await hoje()).slice(0, 7)}-01`);

    // idempotência
    await expect(aprovar(ADMIN, id, { venc })).rejects.toThrow(/já foi aprovado/);
    const [n] = await asService<{ os: number; ct: number; inv: number }>(
      db,
      `select (select count(*)::int from public.service_orders where descricao like 'Orçamento ORC-' || $2 || ':%') as os,
              (select count(*)::int from public.contracts where quote_id = $1) as ct,
              (select count(*)::int from public.invoices i join public.contracts c on c.id = i.contract_id where c.quote_id = $1) as inv`,
      [id, q.numero],
    );
    expect(n).toEqual({ os: 1, ct: 1, inv: 1 });

    // imutável (trigger vale até para o serviço; a API nem tem grant)
    await expect(
      asService(db, `update public.quotes set titulo = 'outro' where id = $1`, [id]),
    ).rejects.toThrow(/não pode mais ser alterado/);
    await expect(
      asService(db, `update public.quote_items set quantidade = 2 where quote_id = $1`, [id]),
    ).rejects.toThrow(/itens não podem mais ser alterados/);
    await expect(
      asService(db, `insert into public.quote_items (quote_id, descricao, quantidade, preco_unitario) values ($1, 'x', 1, 1)`, [id]),
    ).rejects.toThrow(/itens não podem mais ser alterados/);
    await expect(asService(db, `delete from public.quotes where id = $1`, [id])).rejects.toThrow(/não pode ser excluído/);
    await expect(asUser(db, ADMIN, `select public.excluir_orcamento($1)`, [id])).rejects.toThrow(/não pode ser excluído/);
    await expect(salvar(ADMIN, id, await header(), [{ descricao: "x", quantidade: 1, preco_unitario: 1 }])).rejects.toThrow(
      /não pode mais ser alterado/,
    );
    // anulação do vínculo com OS/fatura ainda existentes: recusada (P1-1)
    for (const uid of [ADMIN, ATEND, TEC]) {
      await expect(
        asUser(db, uid, `update public.quotes set service_order_id = null, invoice_id = null where id = $1`, [id]),
      ).rejects.toThrow(DENIED);
    }
    await expect(
      asService(db, `update public.quotes set service_order_id = null where id = $1`, [id]),
    ).rejects.toThrow(/não pode mais ser alterado/);
    await expect(
      asService(db, `update public.quotes set invoice_id = null where id = $1`, [id]),
    ).rejects.toThrow(/não pode mais ser alterado/);
    // nem o serviço (owner) altera um orçamento decidido
    await expect(asService(db, `update public.quotes set total = 1, titulo = 'z' where id = $1`, [id])).rejects.toThrow(
      /não pode mais ser alterado/,
    );

    // contrato encerrado/avulso não entra no faturamento mensal
    await asService(db, `select public._generate_monthly_invoices_job()`);
    const [cnt] = await asService<{ n: number }>(
      db,
      `select count(*)::int as n from public.invoices where contract_id = $1`,
      [r.r.contract_id],
    );
    expect(cnt.n).toBe(1);

    // OS excluída: vínculo vira null (FK set null passa pela imutabilidade)
    await asService(db, `delete from public.service_orders where id = $1`, [r.r.service_order_id]);
    expect((await quote(id)).service_order_id).toBeNull();
  });

  it("tipo do orçamento vira tipo da OS: diagnóstico → corretiva, preventiva → preventiva PMOC", async () => {
    const casos = [
      ["diagnostico", "corretiva"],
      ["instalacao", "instalacao"],
      ["corretiva", "corretiva"],
      ["preventiva", "preventiva_pmoc"],
    ] as const;
    for (const [tipoOrc, tipoOs] of casos) {
      const id = await salvar(ADMIN, null, await header({ tipo_servico: tipoOrc, titulo: `Tipo ${tipoOrc}` }), [
        { descricao: "Visita", quantidade: 1, preco_unitario: 150 },
      ]);
      const [q] = await asService<{ tipo_servico: string }>(db, `select tipo_servico from public.quotes where id = $1`, [id]);
      expect(q.tipo_servico).toBe(tipoOrc);
      const r = await aprovar(ADMIN, id);
      const [os] = await asService<{ tipo: string }>(db, `select tipo::text from public.service_orders where id = $1`, [
        r.service_order_id,
      ]);
      expect(os.tipo).toBe(tipoOs);
    }
  });

  it("recusa tipo de serviço fora dos 4 do orçamento", async () => {
    await expect(
      salvar(ADMIN, null, await header({ tipo_servico: "orcamento" }), [{ descricao: "Item", quantidade: 1, preco_unitario: 10 }]),
    ).rejects.toThrow(/quotes_tipo_servico_check/);
  });

  it("recusa vencimento no passado e orçamento sem valor", async () => {
    const id = await salvar(ADMIN, null, await header(), [{ descricao: "Brinde", quantidade: 1, preco_unitario: 0 }]);
    await expect(aprovar(ADMIN, id, { venc: await hoje(-1) })).rejects.toThrow(/vencimento/);
    await expect(aprovar(ADMIN, id)).rejects.toThrow(/sem valor/);
  });

  it("recusa aprovar com updated_at velho (orçamento alterado depois de aberto)", async () => {
    const id = await salvar(ADMIN, null, await header(), [{ descricao: "A", quantidade: 1, preco_unitario: 100 }]);
    const [v] = await asService<{ u: string }>(db, `select updated_at::text as u from public.quotes where id = $1`, [id]);
    // outra pessoa edita (novo total) — em outra transação
    await salvar(ATEND, id, await header(), [{ descricao: "A", quantidade: 1, preco_unitario: 900 }]);
    await expect(aprovar(ADMIN, id, { updatedAt: v.u })).rejects.toThrow(/alterado por outra pessoa; recarregue/);
    expect((await quote(id)).status).toBe("aguardando");
    // com o updated_at atual aprova pelo total novo
    const r = await aprovar(ADMIN, id);
    const [inv] = await asService<{ valor: string }>(db, `select valor from public.invoices where id = $1`, [r.invoice_id]);
    expect(Number(inv.valor)).toBe(900);
  });

  it("orçamento vencido: sem confirmação falha, com p_aceitar_vencido aprova", async () => {
    const id = await salvar(ADMIN, null, await header({ validade: await hoje(-3) }), [
      { descricao: "A", quantidade: 1, preco_unitario: 100 },
    ]);
    const [d] = await asService<{ d: string }>(db, `select to_char(public.hoje_brt() - 3, 'DD/MM/YYYY') as d`);
    await expect(aprovar(ADMIN, id)).rejects.toThrow(`Orçamento vencido em ${d.d}. Confirme para aprovar mesmo assim`);
    expect((await quote(id)).status).toBe("aguardando");
    await aprovar(ADMIN, id, { aceitarVencido: true });
    expect((await quote(id)).status).toBe("aprovado");
  });

  it("recusa aprovar orçamento de cliente inativo", async () => {
    const id = await salvar(ADMIN, null, await header({ client_id: CLIENT_B, building_id: BUILD_B }), [
      { descricao: "A", quantidade: 1, preco_unitario: 100 },
    ]);
    await asService(db, `update public.clients set ativo = false where id = $1`, [CLIENT_B]);
    try {
      await expect(aprovar(ADMIN, id)).rejects.toThrow(/Cliente inativo/);
      // declinar continua possível
      await asUser(db, ADMIN, `select public.declinar_orcamento($1)`, [id]);
      expect((await quote(id)).status).toBe("declinado");
    } finally {
      await asService(db, `update public.clients set ativo = true where id = $1`, [CLIENT_B]);
    }
  });
});

describe("declinar e duplicar", () => {
  it("declina só de aguardando; duplicar cria novo aguardando com os mesmos itens", async () => {
    const id = await salvar(ADMIN, null, await header({ desconto: 20, validade: await hoje(30) }), [
      { descricao: "A", quantidade: 2, preco_unitario: 100 },
      { descricao: "B", quantidade: 1, preco_unitario: 50 },
    ]);
    const [d] = await asUser<{ status: string; motivo_declinio: string }>(
      db,
      ADMIN,
      `select status, motivo_declinio from public.declinar_orcamento($1, '  Preço acima  ')`,
      [id],
    );
    expect(d).toEqual({ status: "declinado", motivo_declinio: "Preço acima" });
    await expect(
      asUser(db, ADMIN, `select public.declinar_orcamento($1, null)`, [id]),
    ).rejects.toThrow(/já foi declinado/);
    await expect(aprovar(ADMIN, id)).rejects.toThrow(/já foi declinado/);

    const [dup] = await asUser<{ id: string }>(db, ADMIN, `select public.duplicar_orcamento($1) as id`, [id]);
    const [nq] = await asService<{ status: string; total: string; desconto: string; validade: string; created_by: string }>(
      db,
      `select status, total, desconto, validade::text, created_by from public.quotes where id = $1`,
      [dup.id],
    );
    expect(nq.status).toBe("aguardando");
    expect(Number(nq.total)).toBe(230);
    expect(Number(nq.desconto)).toBe(20);
    expect(nq.validade).toBe(await hoje(30));
    expect(nq.created_by).toBe(ADMIN);
    const itens = await asService<{ descricao: string }>(
      db,
      `select descricao from public.quote_items where quote_id = $1 order by ordem`,
      [dup.id],
    );
    expect(itens.map((i) => i.descricao)).toEqual(["A", "B"]);
  });
});

describe("excluir_orcamento", () => {
  it("só admin e só aguardando; itens vão junto", async () => {
    const id = await salvar(ATEND, null, await header(), [{ descricao: "A", quantidade: 1, preco_unitario: 10 }]);
    for (const uid of [ATEND, TEC]) {
      await expect(asUser(db, uid, `select public.excluir_orcamento($1)`, [id])).rejects.toThrow(/Apenas admin/);
    }
    await asUser(db, ADMIN, `select public.excluir_orcamento($1)`, [id]);
    expect(await asService(db, `select id from public.quotes where id = $1`, [id])).toHaveLength(0);
    expect(await asService(db, `select id from public.quote_items where quote_id = $1`, [id])).toHaveLength(0);
    await expect(asUser(db, ADMIN, `select public.excluir_orcamento($1)`, [id])).rejects.toThrow(/não encontrado/);

    const dec = await salvar(ADMIN, null, await header(), [{ descricao: "A", quantidade: 1, preco_unitario: 10 }]);
    await asUser(db, ADMIN, `select public.declinar_orcamento($1)`, [dec]);
    await expect(asUser(db, ADMIN, `select public.excluir_orcamento($1)`, [dec])).rejects.toThrow(/não pode ser excluído/);
  });
});

describe("vw_quotes", () => {
  it("é security_barrier", async () => {
    const [r] = await asService<{ opts: string[] | null }>(
      db,
      `select reloptions as opts from pg_class where oid = 'public.vw_quotes'::regclass`,
    );
    expect(r.opts).toContain("security_barrier=true");
  });
});

describe("orcamentos_resumo", () => {
  it("soma por status no período", async () => {
    await asService(db, `delete from public.quotes where status = 'aguardando'`);
    const [antes] = await asUser<Record<string, string | number>>(db, ADMIN, `select * from public.orcamentos_resumo(null, null)`);

    const a = await salvar(ADMIN, null, await header(), [{ descricao: "x", quantidade: 1, preco_unitario: 1000 }]);
    const b = await salvar(ADMIN, null, await header(), [{ descricao: "y", quantidade: 2, preco_unitario: 250 }]);
    await salvar(ADMIN, null, await header(), [{ descricao: "z", quantidade: 1, preco_unitario: 300 }]);
    await aprovar(ADMIN, a);
    await asUser(db, ADMIN, `select public.declinar_orcamento($1)`, [b]);

    const [r] = await asUser<Record<string, string | number>>(
      db,
      ADMIN,
      `select * from public.orcamentos_resumo(public.hoje_brt(), public.hoje_brt())`,
    );
    const [tudo] = await asUser<Record<string, string | number>>(db, ADMIN, `select * from public.orcamentos_resumo(null, null)`);
    expect(Number(tudo.qtd_emitidos) - Number(antes.qtd_emitidos)).toBe(3);
    expect(Number(r.qtd_aguardando)).toBe(1);
    expect(Number(r.valor_aguardando)).toBe(300);
    expect(Number(tudo.valor_aprovado) - Number(antes.valor_aprovado)).toBe(1000);
    expect(Number(tudo.valor_declinado) - Number(antes.valor_declinado)).toBe(500);
    expect(Number(r.valor_emitido)).toBe(
      Number(r.valor_aprovado) + Number(r.valor_aguardando) + Number(r.valor_declinado),
    );

    // fora do período
    const [vazio] = await asUser<Record<string, string | number>>(
      db,
      ADMIN,
      `select * from public.orcamentos_resumo(public.hoje_brt() + 1, public.hoje_brt() + 30)`,
    );
    expect(Number(vazio.qtd_emitidos)).toBe(0);
  });
});
