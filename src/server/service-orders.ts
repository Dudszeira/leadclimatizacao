import { isDemoMode } from "@/lib/env";
import { createClient as createSupabase } from "@/lib/supabase/server";
import {
  STORAGE_BUCKETS,
  type FieldOrderItem,
  type OsPriority,
  type OsStatus,
  type OsType,
  type PageParams,
  type Paginated,
  type Result,
  type ServiceOrder,
  type ServiceOrderEvidence,
  type ServiceOrderListItem,
  type ServiceOrderPhoto,
  type ServiceOrderPhotoView,
  type ServiceOrderWithRelations,
} from "@/lib/types";
import {
  demoBuildingWithClient,
  demoEquipment,
  demoServiceOrderListItem,
  profilesFixture,
  demoServiceOrderWithRelations,
  serviceOrdersFixture,
} from "./_demo";
import {
  failWith,
  matchesSearch,
  ok,
  pageRange,
  paginate,
  sanitizeIlike,
  toPaginated,
  safeErrorLog,
} from "./_shared";

export interface ListServiceOrdersParams extends PageParams {
  /** Busca por número da OS ou descrição. */
  search?: string;
  status?: OsStatus;
  tipo?: OsType;
  prioridade?: OsPriority;
  technicianId?: string;
  buildingId?: string;
}

const LIST_EMBED =
  "building:buildings(id,nome,bairro,regiao, client:clients(id,razao_social,nome_fantasia)), " +
  "equipment(id,codigo_interno,tipo,marca,modelo), " +
  "technician:profiles!service_orders_technician_id_fkey(id,full_name,phone)";

const DETAIL_EMBED =
  "building:buildings(*, client:clients(id,razao_social,nome_fantasia,segmento)), " +
  "equipment(*), " +
  "technician:profiles!service_orders_technician_id_fkey(*), " +
  "checklist_template:checklist_templates(*), " +
  "pmoc_plan:pmoc_plans(*)";

/** Lista paginada de OS com prédio/cliente, equipamento e técnico. */
export async function listServiceOrders(
  params: ListServiceOrdersParams = {},
): Promise<Result<Paginated<ServiceOrderListItem>>> {
  try {
    if (isDemoMode) {
      let items = serviceOrdersFixture.map(demoServiceOrderListItem);
      if (params.status) items = items.filter((o) => o.status === params.status);
      if (params.tipo) items = items.filter((o) => o.tipo === params.tipo);
      if (params.prioridade) items = items.filter((o) => o.prioridade === params.prioridade);
      if (params.technicianId) items = items.filter((o) => o.technician_id === params.technicianId);
      if (params.buildingId) items = items.filter((o) => o.building_id === params.buildingId);
      const term = params.search;
      if (term) {
        items = items.filter((o) =>
          matchesSearch(
            term,
            o.numero,
            o.descricao,
            o.building.nome,
            o.building.client.razao_social,
            o.building.client.nome_fantasia,
          ),
        );
      }
      items.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return ok(paginate(items, params));
    }

    const supabase = await createSupabase();
    const { from, to } = pageRange(params);
    let query = supabase
      .from("service_orders")
      .select(`*, ${LIST_EMBED}`, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (params.status) query = query.eq("status", params.status);
    if (params.tipo) query = query.eq("tipo", params.tipo);
    if (params.prioridade) query = query.eq("prioridade", params.prioridade);
    if (params.technicianId) query = query.eq("technician_id", params.technicianId);
    if (params.buildingId) query = query.eq("building_id", params.buildingId);
    const q = params.search ? sanitizeIlike(params.search) : "";
    if (q) {
      const numero = Number.parseInt(q.replace(/^os-?/i, ""), 10);
      query = Number.isFinite(numero)
        ? query.eq("numero", numero)
        : query.ilike("descricao", `%${q}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      return failWith("listServiceOrders", error, "Não foi possível carregar os chamados. Tente novamente.");
    }
    return ok(toPaginated((data ?? []) as ServiceOrderListItem[], count, params));
  } catch (error) {
    return failWith("listServiceOrders", error, "Não foi possível carregar os chamados. Tente novamente.");
  }
}

/** OS por id com equipamento, prédio (+cliente), técnico, checklist e plano. */
export async function getServiceOrder(
  id: string,
): Promise<Result<ServiceOrderWithRelations | null>> {
  try {
    if (isDemoMode) {
      const os = serviceOrdersFixture.find((o) => o.id === id);
      return ok(os ? demoServiceOrderWithRelations(os) : null);
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("service_orders")
      .select(`*, ${DETAIL_EMBED}`)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return failWith("getServiceOrder", error, "Não foi possível carregar o chamado. Tente novamente.");
    }
    return ok((data ?? null) as ServiceOrderWithRelations | null);
  } catch (error) {
    return failWith("getServiceOrder", error, "Não foi possível carregar o chamado. Tente novamente.");
  }
}

/** OS pelo número humano (ex.: 1004 para "OS-1004"). */
export async function getServiceOrderByNumero(
  numero: number,
): Promise<Result<ServiceOrderWithRelations | null>> {
  try {
    if (isDemoMode) {
      const os = serviceOrdersFixture.find((o) => o.numero === numero);
      return ok(os ? demoServiceOrderWithRelations(os) : null);
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("service_orders")
      .select(`*, ${DETAIL_EMBED}`)
      .eq("numero", numero)
      .maybeSingle();
    if (error) {
      return failWith("getServiceOrderByNumero", error, "Não foi possível carregar o chamado. Tente novamente.");
    }
    return ok((data ?? null) as ServiceOrderWithRelations | null);
  } catch (error) {
    return failWith("getServiceOrderByNumero", error, "Não foi possível carregar o chamado. Tente novamente.");
  }
}

// ---------------------------------------------------------------------------
// Evidências (fotos + assinatura) com URL assinada gerada no servidor
// ---------------------------------------------------------------------------

/** Validade das URLs assinadas de fotos e assinaturas (segundos): 10 min. */
const SIGNED_URL_TTL = 600;

function legacyPhotos(os: Pick<ServiceOrder, "fotos_antes" | "fotos_depois">, known: Set<string>) {
  const out: Array<Omit<ServiceOrderPhotoView, "url">> = [];
  for (const [etapa, paths] of [
    ["antes", os.fotos_antes ?? []],
    ["depois", os.fotos_depois ?? []],
  ] as const) {
    for (const path of paths) {
      if (known.has(path)) continue;
      out.push({ id: `legado:${path}`, storage_path: path, etapa, legenda: null, created_at: null });
    }
  }
  return out;
}

/**
 * Fotos da OS (service_order_photos + colunas legadas fotos_antes/depois) e
 * assinatura, com URLs assinadas de 1 h. Buckets são privados: a RLS de
 * storage.objects decide quem consegue assinar.
 */
export async function getServiceOrderEvidence(
  os: Pick<ServiceOrder, "id" | "fotos_antes" | "fotos_depois" | "assinatura_path">,
): Promise<Result<ServiceOrderEvidence>> {
  try {
    if (isDemoMode) {
      const photos = legacyPhotos(os, new Set()).map((p) => ({ ...p, url: null }));
      return ok({ photos, assinaturaUrl: null });
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("service_order_photos")
      .select("*")
      .eq("service_order_id", os.id)
      .order("created_at", { ascending: true });
    if (error) {
      return failWith("getServiceOrderEvidence", error, "Não foi possível carregar as fotos do chamado.");
    }
    const rows = (data ?? []) as ServiceOrderPhoto[];
    const base: Array<Omit<ServiceOrderPhotoView, "url">> = [
      ...rows.map((r) => ({
        id: r.id,
        storage_path: r.storage_path,
        etapa: r.etapa === "depois" ? ("depois" as const) : ("antes" as const),
        legenda: r.legenda,
        created_at: r.created_at,
      })),
      ...legacyPhotos(os, new Set(rows.map((r) => r.storage_path))),
    ];

    const urlByPath = new Map<string, string>();
    if (base.length > 0) {
      const { data: signed, error: signError } = await supabase.storage
        .from(STORAGE_BUCKETS.fotos)
        .createSignedUrls(
          base.map((p) => p.storage_path),
          SIGNED_URL_TTL,
        );
      if (signError) console.error("[data-layer] getServiceOrderEvidence sign:", safeErrorLog(signError));
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl && !s.error) urlByPath.set(s.path, s.signedUrl);
      }
    }

    let assinaturaUrl: string | null = null;
    if (os.assinatura_path) {
      const { data: sig, error: sigError } = await supabase.storage
        .from(STORAGE_BUCKETS.assinaturas)
        .createSignedUrl(os.assinatura_path, SIGNED_URL_TTL);
      if (sigError) console.error("[data-layer] getServiceOrderEvidence assinatura:", safeErrorLog(sigError));
      assinaturaUrl = sig?.signedUrl ?? null;
    }

    return ok({
      photos: base.map((p) => ({ ...p, url: urlByPath.get(p.storage_path) ?? null })),
      assinaturaUrl,
    });
  } catch (error) {
    return failWith("getServiceOrderEvidence", error, "Não foi possível carregar as fotos do chamado.");
  }
}

// ---------------------------------------------------------------------------
// App de campo (/campo)
// ---------------------------------------------------------------------------

const FIELD_EMBED =
  "building:buildings(id,nome,logradouro,numero,bairro,cidade,uf,lat,lng, client:clients(id,razao_social,nome_fantasia)), " +
  "equipment(id,codigo_interno,tipo,ambiente), " +
  "technician:profiles!service_orders_technician_id_fkey(id,full_name)";

const FIELD_STATUSES: OsStatus[] = ["aberto", "agendado", "em_campo"];
const FIELD_LIMIT = 200;

export interface ListFieldOrdersParams {
  /** Filtra pelo técnico responsável. Ausente = todas as OS com técnico (visão admin). */
  technicianId?: string;
}

/** OS ativas (aberto/agendado/em campo) com técnico designado e endereço do prédio. */
export async function listFieldOrders(
  params: ListFieldOrdersParams = {},
): Promise<Result<FieldOrderItem[]>> {
  try {
    if (isDemoMode) {
      const profileById = new Map(profilesFixture.map((p) => [p.id, p]));
      const items: FieldOrderItem[] = serviceOrdersFixture
        .filter((o) => FIELD_STATUSES.includes(o.status) && o.technician_id !== null)
        .filter((o) => !params.technicianId || o.technician_id === params.technicianId)
        .map((o) => {
          const b = demoBuildingWithClient(o.building_id);
          const e = o.equipment_id ? demoEquipment(o.equipment_id) : undefined;
          const t = o.technician_id ? profileById.get(o.technician_id) : undefined;
          return {
            ...o,
            building: {
              id: b.id,
              nome: b.nome,
              logradouro: b.logradouro,
              numero: b.numero,
              bairro: b.bairro,
              cidade: b.cidade,
              uf: b.uf,
              lat: b.lat,
              lng: b.lng,
              client: {
                id: b.client.id,
                razao_social: b.client.razao_social,
                nome_fantasia: b.client.nome_fantasia,
              },
            },
            equipment: e
              ? { id: e.id, codigo_interno: e.codigo_interno, tipo: e.tipo, ambiente: e.ambiente }
              : null,
            technician: t ? { id: t.id, full_name: t.full_name } : null,
          };
        });
      return ok(items.slice(0, FIELD_LIMIT));
    }

    const supabase = await createSupabase();
    let query = supabase
      .from("service_orders")
      .select(`*, ${FIELD_EMBED}`)
      .in("status", FIELD_STATUSES)
      .not("technician_id", "is", null)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(FIELD_LIMIT);
    if (params.technicianId) query = query.eq("technician_id", params.technicianId);
    const { data, error } = await query;
    if (error) {
      return failWith("listFieldOrders", error, "Não foi possível carregar suas ordens de serviço. Tente novamente.");
    }
    return ok((data ?? []) as FieldOrderItem[]);
  } catch (error) {
    return failWith("listFieldOrders", error, "Não foi possível carregar suas ordens de serviço. Tente novamente.");
  }
}
