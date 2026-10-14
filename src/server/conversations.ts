import { isDemoMode } from "@/lib/env";
import { conversationsFixture, messagesFixture } from "@/lib/fixtures";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { z } from "zod";

import type {
  ConversationStatus,
  ConversationWithMessages,
  Message,
  OsPriority,
  PageParams,
  Paginated,
  Result,
} from "@/lib/types";
import { demoClient, demoEquipment, serviceOrdersFixture } from "./_demo";
import {
  failWith,
  matchesSearch,
  ok,
  pageRange,
  paginate,
  sanitizeIlike,
  toPaginated,
} from "./_shared";

const CLIENT_EMBED = "client:clients(id,razao_social,nome_fantasia)";

/** Conversas por página na lista do atendimento. */
export const CONVERSATIONS_PAGE_SIZE = 30;
/** Mensagens embutidas por conversa na lista (só a prévia). */
export const LIST_MESSAGES_LIMIT = 1;
/** Janela padrão de mensagens da conversa aberta e passo do "carregar mais". */
export const THREAD_MESSAGES_STEP = 50;
/** Teto de mensagens carregadas numa thread. */
export const THREAD_MESSAGES_MAX = 500;

export interface ListConversationsParams extends PageParams {
  status?: ConversationStatus;
  /** Busca por nome do cliente ou telefone. */
  search?: string;
}

/** Conversa com a janela das últimas mensagens e indicação de mais antigas. */
export interface ConversationThread extends ConversationWithMessages {
  /** true quando existem mensagens anteriores às carregadas. */
  has_older_messages: boolean;
}

/** true se a conversa bate com o termo (nome do cliente ou telefone). */
function conversationMatches(c: ConversationWithMessages, term: string): boolean {
  return matchesSearch(
    term,
    c.telefone,
    c.telefone.replace(/\D/g, ""),
    c.client?.razao_social,
    c.client?.nome_fantasia,
  );
}

function demoConversationClient(clientId: string | null) {
  if (!clientId) return null;
  const client = demoClient(clientId);
  return client
    ? { id: client.id, razao_social: client.razao_social, nome_fantasia: client.nome_fantasia }
    : null;
}

/** Últimas `limit` mensagens da conversa (demo), em ordem cronológica. */
function demoMessages(conversationId: string, limit: number): { messages: Message[]; hasOlder: boolean } {
  const all = messagesFixture
    .filter((m) => m.conversation_id === conversationId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { messages: all.slice(-limit), hasOlder: all.length > limit };
}

function clampMessagesLimit(limit: number | undefined): number {
  const n = Math.floor(limit ?? THREAD_MESSAGES_STEP);
  return Math.min(THREAD_MESSAGES_MAX, Math.max(1, Number.isFinite(n) ? n : THREAD_MESSAGES_STEP));
}

/**
 * Ids de clientes cujo nome bate com o termo (busca SQL da lista).
 * Limitado: a busca é para achar uma conversa, não para varrer a base.
 */
async function clientIdsMatching(
  supabase: Awaited<ReturnType<typeof createSupabase>>,
  term: string,
): Promise<string[]> {
  const safe = sanitizeIlike(term);
  if (!safe) return [];
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .or(`razao_social.ilike.%${safe}%,nome_fantasia.ilike.%${safe}%`)
    .limit(200);
  if (error) {
    console.error("[data-layer] listConversations (clientes):", error);
    return [];
  }
  return (data ?? []).map((row) => row.id as string);
}

/**
 * Conversas do atendimento, paginadas, mais recentes primeiro. Cada item
 * traz só a última mensagem (prévia); a thread completa vem de
 * getConversation, também limitada.
 */
export async function listConversations(
  params: ListConversationsParams = {},
): Promise<Result<Paginated<ConversationWithMessages>>> {
  const pageParams = { page: params.page, pageSize: params.pageSize ?? CONVERSATIONS_PAGE_SIZE };
  try {
    if (isDemoMode) {
      let items: ConversationWithMessages[] = conversationsFixture.map((c) => ({
        ...c,
        client: demoConversationClient(c.client_id),
        messages: demoMessages(c.id, LIST_MESSAGES_LIMIT).messages,
      }));
      if (params.status) items = items.filter((c) => c.status === params.status);
      const termDemo = params.search?.trim();
      if (termDemo) items = items.filter((c) => conversationMatches(c, termDemo));
      items.sort((a, b) =>
        (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at),
      );
      return ok(paginate(items, pageParams));
    }

    const supabase = await createSupabase();
    const { from, to } = pageRange(pageParams);
    let query = supabase
      .from("conversations")
      .select(`*, ${CLIENT_EMBED}, messages(*)`, { count: "exact" })
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(LIST_MESSAGES_LIMIT, { referencedTable: "messages" })
      .range(from, to);
    if (params.status) query = query.eq("status", params.status);

    const term = params.search?.trim();
    if (term) {
      const filters: string[] = [];
      const digits = term.replace(/\D/g, "");
      if (digits.length >= 3) filters.push(`telefone.ilike.%${digits}%`);
      const ids = await clientIdsMatching(supabase, term);
      if (ids.length > 0) filters.push(`client_id.in.(${ids.join(",")})`);
      if (filters.length === 0) return ok(toPaginated([], 0, pageParams));
      query = query.or(filters.join(","));
    }

    const { data, error, count } = await query;
    if (error) {
      return failWith("listConversations", error, "Não foi possível carregar as conversas. Tente novamente.");
    }
    const items = ((data ?? []) as ConversationWithMessages[]).map((c) => ({
      ...c,
      messages: [...(c.messages ?? [])].reverse(),
    }));
    return ok(toPaginated(items, count, pageParams));
  } catch (error) {
    return failWith("listConversations", error, "Não foi possível carregar as conversas. Tente novamente.");
  }
}

/**
 * Conversa por id com cliente e as últimas `messagesLimit` mensagens em ordem
 * cronológica (default 50, teto 500). `has_older_messages` habilita o
 * "carregar anteriores" da thread.
 */
export async function getConversation(
  id: string,
  options: { messagesLimit?: number } = {},
): Promise<Result<ConversationThread | null>> {
  const limit = clampMessagesLimit(options.messagesLimit);
  try {
    if (isDemoMode) {
      const conversation = conversationsFixture.find((c) => c.id === id);
      if (!conversation) return ok(null);
      const { messages, hasOlder } = demoMessages(id, limit);
      return ok({
        ...conversation,
        client: demoConversationClient(conversation.client_id),
        messages,
        has_older_messages: hasOlder,
      });
    }

    if (!z.uuid().safeParse(id).success) return ok(null);

    const supabase = await createSupabase();
    // Busca limit + 1 para saber se há mensagens mais antigas sem contar tudo.
    const { data, error } = await supabase
      .from("conversations")
      .select(`*, ${CLIENT_EMBED}, messages(*)`)
      .eq("id", id)
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(limit + 1, { referencedTable: "messages" })
      .maybeSingle();
    if (error) {
      return failWith("getConversation", error, "Não foi possível carregar a conversa. Tente novamente.");
    }
    if (!data) return ok(null);
    const row = data as ConversationWithMessages;
    const recent = row.messages ?? [];
    return ok({
      ...row,
      messages: recent.slice(0, limit).reverse(),
      has_older_messages: recent.length > limit,
    });
  } catch (error) {
    return failWith("getConversation", error, "Não foi possível carregar a conversa. Tente novamente.");
  }
}

/**
 * Referência mínima de OS citada numa conversa (metadata.os_numero das
 * mensagens) — alimenta o painel "O que a IA fez" e os chips de sistema.
 */
export interface ConversationOsRef {
  id: string;
  numero: number;
  prioridade: OsPriority;
  /** Código interno do equipamento vinculado, se houver. */
  equipment_codigo: string | null;
}

/** Resolve números de OS (ex.: 1004) para id/prioridade/equipamento. */
export async function getServiceOrderRefsByNumeros(
  numeros: number[],
): Promise<Result<ConversationOsRef[]>> {
  if (numeros.length === 0) return ok([]);
  try {
    if (isDemoMode) {
      const wanted = new Set(numeros);
      const refs = serviceOrdersFixture
        .filter((os) => wanted.has(os.numero))
        .map((os) => ({
          id: os.id,
          numero: os.numero,
          prioridade: os.prioridade,
          equipment_codigo: os.equipment_id
            ? demoEquipment(os.equipment_id)?.codigo_interno ?? null
            : null,
        }));
      return ok(refs);
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("service_orders")
      .select("id,numero,prioridade,equipment:equipment(codigo_interno)")
      .in("numero", numeros);
    if (error) {
      return failWith(
        "getServiceOrderRefsByNumeros",
        error,
        "Não foi possível carregar os chamados citados na conversa.",
      );
    }
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      numero: number;
      prioridade: OsPriority;
      equipment: { codigo_interno: string } | null;
    }>;
    return ok(
      rows.map((row) => ({
        id: row.id,
        numero: row.numero,
        prioridade: row.prioridade,
        equipment_codigo: row.equipment?.codigo_interno ?? null,
      })),
    );
  } catch (error) {
    return failWith(
      "getServiceOrderRefsByNumeros",
      error,
      "Não foi possível carregar os chamados citados na conversa.",
    );
  }
}
