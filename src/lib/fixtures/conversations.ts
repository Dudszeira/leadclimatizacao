import type { Conversation, Message, MessageAuthor, MessageDirection } from "@/lib/types";
import { isoAgo } from "./dates";

/** 4 conversas do atendimento IA — espelho da seção 9 do seed.sql. */
export const conversationsFixture: Conversation[] = [
  {
    id: "ca000000-0000-4000-8000-000000000001",
    canal: "whatsapp",
    telefone: "+554133303030",
    client_id: "c0000000-0000-4000-8000-000000000003",
    status: "transferido",
    last_message_at: isoAgo({ hours: 3 }),
    created_at: isoAgo({ hours: 4 }),
    updated_at: isoAgo({ hours: 3 }),
  },
  {
    id: "ca000000-0000-4000-8000-000000000002",
    canal: "whatsapp",
    telefone: "+554132221010",
    client_id: "c0000000-0000-4000-8000-000000000001",
    status: "ia",
    last_message_at: isoAgo({ minutes: 50 }),
    created_at: isoAgo({ hours: 1 }),
    updated_at: isoAgo({ minutes: 50 }),
  },
  {
    id: "ca000000-0000-4000-8000-000000000003",
    canal: "whatsapp",
    telefone: "+5541998223302",
    client_id: null,
    status: "ia",
    last_message_at: isoAgo({ days: 4 }),
    created_at: isoAgo({ days: 4 }),
    updated_at: isoAgo({ days: 4 }),
  },
  {
    id: "ca000000-0000-4000-8000-000000000004",
    canal: "whatsapp",
    telefone: "+554132427070",
    client_id: "c0000000-0000-4000-8000-000000000007",
    status: "encerrado",
    last_message_at: isoAgo({ days: 1 }),
    created_at: isoAgo({ days: 1 }),
    updated_at: isoAgo({ days: 1 }),
  },
];

type MessageSeed = [
  conversation_id: string,
  direcao: MessageDirection,
  autor: MessageAuthor,
  texto: string,
  metadata: Record<string, unknown>,
  createdAt: string,
];

const rows: MessageSeed[] = [
  // Hospital Santa Clara: urgência escalada para humano
  ["ca000000-0000-4000-8000-000000000001", "in", "cliente", "O chiller da casa de máquinas entrou em alarme e o CTI está esquentando. Preciso de atendimento URGENTE.", { wa_id: "msg_9001" }, isoAgo({ hours: 4 })],
  ["ca000000-0000-4000-8000-000000000001", "out", "ia", "Entendi, situação crítica no CTI do Hospital Santa Clara. Já abri a OS nº 1004 com prioridade urgente e estou acionando a equipe. Um atendente assume a conversa agora.", { intent: "abrir_chamado", os_numero: 1004 }, isoAgo({ hours: 3, minutes: 55 })],
  ["ca000000-0000-4000-8000-000000000001", "out", "humano", "Dr. Aloísio, aqui é a Fernanda da Lead. O técnico Carlos já está a caminho, chega em ~40 min. Vou acompanhando com o senhor por aqui.", {}, isoAgo({ hours: 3 })],
  // Shopping Água Verde: dúvida simples resolvida pela IA
  ["ca000000-0000-4000-8000-000000000002", "in", "cliente", "Bom dia! A preventiva do chiller está confirmada para amanhã?", { wa_id: "msg_9010" }, isoAgo({ hours: 1 })],
  ["ca000000-0000-4000-8000-000000000002", "out", "ia", "Bom dia, Marcelo! Sim: OS nº 1006, amanhã às 7h, técnico Rafael Siqueira. A janela termina antes das 10h, como combinado.", { intent: "consulta_agendamento", os_numero: 1006 }, isoAgo({ minutes: 50 })],
  // Lead novo (Clínica OdontoPrime)
  ["ca000000-0000-4000-8000-000000000003", "in", "cliente", "Olá, vocês fazem manutenção de ar-condicionado em clínica odontológica? São 4 consultórios.", { wa_id: "msg_9020" }, isoAgo({ days: 4 })],
  ["ca000000-0000-4000-8000-000000000003", "out", "ia", "Olá! Sim, atendemos clínicas com plano PMOC (obrigatório pela Lei 13.589/2018). Posso agendar uma visita técnica gratuita para dimensionar a proposta?", { intent: "qualificar_lead" }, isoAgo({ days: 4, minutes: -2 })],
  // Torres do Batel: chamado resolvido e encerrado
  ["ca000000-0000-4000-8000-000000000004", "in", "cliente", "O ar do salão de festas está pingando água no piso.", { wa_id: "msg_9030" }, isoAgo({ days: 1 })],
  ["ca000000-0000-4000-8000-000000000004", "out", "ia", "Obrigado pelo aviso, Sr. Valdir. Abri a OS nº 1007 e agendei o técnico Carlos para depois de amanhã às 9h, antes do evento do fim de semana.", { intent: "abrir_chamado", os_numero: 1007 }, isoAgo({ days: 1, minutes: -3 })],
  ["ca000000-0000-4000-8000-000000000004", "in", "cliente", "Perfeito, obrigado!", { wa_id: "msg_9031" }, isoAgo({ days: 1, minutes: -10 })],
];

export const messagesFixture: Message[] = rows.map(
  ([conversation_id, direcao, autor, texto, metadata, createdAt], i) => ({
    id: `3e000000-0000-4000-8000-0000000000${String(i + 1).padStart(2, "0")}`,
    conversation_id,
    direcao,
    autor,
    texto,
    metadata,
    created_at: createdAt,
    updated_at: createdAt,
  }),
);
