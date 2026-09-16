import { isDemoMode } from "@/lib/env";
import { conversationsFixture, messagesFixture } from "@/lib/fixtures";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type {
  ConversationStatus,
  ConversationWithMessages,
  OsPriority,
  Result,
} from "@/lib/types";
import { demoClient, demoEquipment, serviceOrdersFixture } from "./_demo";
import { failWith, matchesSearch, ok } from "./_shared";

const CLIENT_EMBED = "client:clients(id,razao_social,nome_fantasia)";

export interface ListConversationsParams {
  status?: ConversationStatus;
  /** Busca por nome do cliente ou telefone (aplicada em memória). */
  search?: string;
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

/** Conversas do atendimento (com mensagens), mais recentes primeiro. */
export async function listConversations(
  params: ListConversationsParams = {},
): Promise<Result<ConversationWithMessages[]>> {
  try {
    if (isDemoMode) {
      let items = conversationsFixture.map((c) => ({
        ...c,
        client: demoConversationClient(c.client_id),
        messages: messagesFixture
          .filter((m) => m.conversation_id === c.id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      }));
      if (params.status) items = items.filter((c) => c.status === params.status);
      const termDemo = params.search;
      if (termDemo) items = items.filter((c) => conversationMatches(c, termDemo));
      items.sort((a, b) =>
        (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at),
      );
      return ok(items);
    }

    const supabase = await createSupabase();
    let query = supabase
      .from("conversations")
      .select(`*, ${CLIENT_EMBED}, messages(*)`)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { referencedTable: "messages", ascending: true });
    if (params.status) query = query.eq("status", params.status);

    const { data, error } = await query;
    if (error) {
      return failWith("listConversations", error, "Não foi possível carregar as conversas. Tente novamente.");
    }
    let items = (data ?? []) as ConversationWithMessages[];
    // Volume de conversas é pequeno: busca em memória evita duplicar a lógica
    // de acento/telefone em SQL nesta fase.
    const term = params.search;
    if (term) items = items.filter((c) => conversationMatches(c, term));
    return ok(items);
  } catch (error) {
    return failWith("listConversations", error, "Não foi possível carregar as conversas. Tente novamente.");
  }
}

/** Conversa por id com cliente e mensagens em ordem cronológica. */
export async function getConversation(
  id: string,
): Promise<Result<ConversationWithMessages | null>> {
  try {
    if (isDemoMode) {
      const conversation = conversationsFixture.find((c) => c.id === id);
      if (!conversation) return ok(null);
      return ok({
        ...conversation,
        client: demoConversationClient(conversation.client_id),
        messages: messagesFixture
          .filter((m) => m.conversation_id === id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      });
    }

    const supabase = await createSupabase();
    const { data, error } = await supabase
      .from("conversations")
      .select(`*, ${CLIENT_EMBED}, messages(*)`)
      .eq("id", id)
      .order("created_at", { referencedTable: "messages", ascending: true })
      .maybeSingle();
    if (error) {
      return failWith("getConversation", error, "Não foi possível carregar a conversa. Tente novamente.");
    }
    return ok((data ?? null) as ConversationWithMessages | null);
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
