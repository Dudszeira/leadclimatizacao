/**
 * Métricas puras do dashboard (sem I/O), testadas em tests/unit/dashboard.
 */

export interface FirstResponseInput {
  conversation_id: string;
  direcao: "in" | "out";
  created_at: string;
}

/**
 * Média (min) entre a 1ª mensagem do cliente e a 1ª resposta da conversa.
 * Exportada para teste; recebe mensagens em qualquer ordem.
 */
export function avgFirstResponseMinutes(messages: FirstResponseInput[]): number | null {
  const byConversation = new Map<string, FirstResponseInput[]>();
  for (const m of messages) {
    const list = byConversation.get(m.conversation_id) ?? [];
    list.push(m);
    byConversation.set(m.conversation_id, list);
  }
  const deltas: number[] = [];
  for (const list of byConversation.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const firstIn = list.find((m) => m.direcao === "in");
    if (!firstIn) continue;
    const firstOut = list.find(
      (m) => m.direcao === "out" && m.created_at >= firstIn.created_at,
    );
    if (!firstOut) continue;
    deltas.push(
      (new Date(firstOut.created_at).getTime() - new Date(firstIn.created_at).getTime()) / 60_000,
    );
  }
  if (deltas.length === 0) return null;
  return Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10;
}
