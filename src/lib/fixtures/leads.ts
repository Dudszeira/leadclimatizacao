import type { Lead, LeadOrigin, LeadStage } from "@/lib/types";
import { isoAgo } from "./dates";

type LeadSeed = [
  id: string,
  nome_contato: string,
  empresa: string,
  telefone: string,
  email: string,
  origem: LeadOrigin,
  estagio: LeadStage,
  valor_estimado: number,
  client_id: string | null,
  motivo_perda: string | null,
  observacoes: string | null,
  criadoHaDias: number,
];

/** 8 leads do funil comercial — espelho da seção 8 do seed.sql. */
const rows: LeadSeed[] = [
  ["1ead0000-0000-4000-8000-000000000001", "Marcos Antunes", "Condomínio Alpha Business", "(41) 99711-2201", "marcos@alphabusiness.com.br", "site", "lead", 18000, null, null, "Pediu proposta de PMOC para 22 splits", 2],
  ["1ead0000-0000-4000-8000-000000000002", "Patrícia Lima", "Clínica OdontoPrime", "(41) 99822-3302", "patricia@odontoprime.com.br", "whatsapp", "lead", 6500, null, null, "Chegou pela IA do WhatsApp; 4 consultórios", 4],
  ["1ead0000-0000-4000-8000-000000000003", "Roberto Krüger", "Escola Kinder Haus", "(41) 99933-4403", "roberto@kinderhaus.com.br", "indicacao", "reuniao_marcada", 22000, null, null, "Indicação do Hotel Vista Barigui; reunião quinta 14h", 6],
  ["1ead0000-0000-4000-8000-000000000004", "Sandra Nogueira", "Academia CorpoFit Batel", "(41) 99644-5504", "sandra@corpofit.com.br", "site", "reuniao_marcada", 9800, null, null, "Reunião marcada para semana que vem", 3],
  ["1ead0000-0000-4000-8000-000000000005", "Felipe Sartori", "Cantina Sartori", "(41) 99755-6605", "felipe@cantinasartori.com.br", "whatsapp", "reuniao_realizada", 12500, null, null, "Reunião feita; aguardando fechar proposta de 3 splits + PMOC", 9],
  ["1ead0000-0000-4000-8000-000000000006", "Juliana Prado", "Hotel Vista Barigui", "(41) 99866-7706", "gerencia@hotelvistabarigui.com.br", "indicacao", "venda", 54000, "c0000000-0000-4000-8000-000000000012", null, "Convertido em cliente — contrato PMOC recorrente", 75],
  ["1ead0000-0000-4000-8000-000000000007", "Otávio Bastos", "Gráfica Impressul", "(41) 99977-8807", "otavio@impressul.com.br", "site", "perdido", 15000, null, "Fechou com concorrente por preço", null, 20],
  ["1ead0000-0000-4000-8000-000000000008", "Camila Ferraz", "Laboratório BioCuritiba", "(41) 99588-9908", "camila@biocuritiba.com.br", "whatsapp", "lead", 30000, null, null, "Sala limpa: exige projeto; avaliar parceria de engenharia", 1],
];

export const leadsFixture: Lead[] = rows.map(
  ([id, nome_contato, empresa, telefone, email, origem, estagio, valor_estimado, client_id, motivo_perda, observacoes, dias]) => {
    const created = isoAgo({ days: dias });
    return {
      id,
      nome_contato,
      empresa,
      telefone,
      email,
      origem,
      estagio,
      valor_estimado,
      client_id,
      motivo_perda,
      observacoes,
      created_at: created,
      updated_at: created,
    };
  },
);
