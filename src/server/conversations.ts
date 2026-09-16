import { isDemoMode } from "@/lib/env";
import { conversationsFixture, messagesFixture } from "@/lib/fixtures";
import { createClient as createSupabase } from "@/lib/supabase/server";
import type {
  ConversationStatus,
  ConversationWithMessages,
  Result,
} from "@/lib/types";
import { demoClient } from "./_demo";
import { failWith, ok } from "./_shared";

const CLIENT_EMBED = "client:clients(id,razao_social,nome_fantasia)";

export interface ListConversationsParams {
  status?: ConversationStatus;
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
    return ok((data ?? []) as ConversationWithMessages[]);
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
