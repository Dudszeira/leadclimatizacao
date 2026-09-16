/**
 * Tipos TypeScript do domínio Control Lead.
 * Fonte da verdade: supabase/migrations/0001_schema.sql (tabelas/enums)
 * e 0003_functions.sql (views e dashboard_resumo()).
 *
 * Convenções:
 * - Colunas `date` viram string "YYYY-MM-DD".
 * - Colunas `timestamptz` viram string ISO 8601.
 * - Colunas `numeric` viram number.
 */

// ----------------------------------------------------------------------------
// Enums (idênticos aos enums SQL de 0001_schema.sql)
// ----------------------------------------------------------------------------

export type UserRole = "admin" | "atendente" | "tecnico";

export type EquipmentType = "split" | "vrf" | "chiller" | "self" | "janela";

export type EquipmentStatus =
  | "operacional"
  | "chamado_aberto"
  | "tecnico_em_campo"
  | "inativo";

export type LeadOrigin = "indicacao" | "site" | "whatsapp";

export type LeadStage =
  | "lead"
  | "reuniao_marcada"
  | "reuniao_realizada"
  | "venda"
  | "perdido";

export type OsType = "preventiva_pmoc" | "corretiva" | "instalacao" | "orcamento";

export type OsPriority = "baixa" | "media" | "alta" | "urgente";

export type OsStatus = "aberto" | "agendado" | "em_campo" | "concluido" | "cancelado";

export type OsOrigin = "manual" | "pmoc_auto" | "ia_whatsapp";

export type ConversationStatus = "ia" | "transferido" | "encerrado";

export type MessageDirection = "in" | "out";

export type MessageAuthor = "ia" | "humano" | "cliente";

export type ContractType = "pmoc_recorrente" | "corretiva_avulsa" | "instalacao";

export type ContractStatus = "ativo" | "suspenso" | "encerrado";

export type InvoiceStatus = "pendente" | "pago" | "atrasado" | "cancelado";

export type PaymentMethod = "pix" | "boleto";

/** Situação calculada de um plano PMOC (vw_dashboard_pmoc_situacao). */
export type PmocSituacao = "em_dia" | "vencendo" | "atrasado";

// ----------------------------------------------------------------------------
// Linhas das tabelas
// ----------------------------------------------------------------------------

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  segmento: string | null;
  contato_nome: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Building {
  id: string;
  client_id: string;
  nome: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  cep: string | null;
  lat: number | null;
  lng: number | null;
  regiao: string | null;
  created_at: string;
  updated_at: string;
}

export interface Equipment {
  id: string;
  building_id: string;
  tipo: EquipmentType;
  marca: string | null;
  modelo: string | null;
  capacidade_btu: number | null;
  codigo_interno: string;
  ambiente: string | null;
  status: EquipmentStatus;
  data_instalacao: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  nome_contato: string;
  empresa: string | null;
  telefone: string | null;
  email: string | null;
  origem: LeadOrigin;
  estagio: LeadStage;
  valor_estimado: number | null;
  client_id: string | null;
  motivo_perda: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

/** Item do JSONB `itens` de checklist_templates. */
export interface ChecklistItem {
  id: string;
  label: string;
  tipo: "checkbox" | "numero" | "texto";
  unidade?: string;
}

export interface ChecklistTemplate {
  id: string;
  nome: string;
  tipo: OsType;
  itens: ChecklistItem[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface PmocPlan {
  id: string;
  equipment_id: string;
  periodicidade_dias: number;
  proxima_data: string;
  checklist_template_id: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

/** Respostas do checklist de uma OS (JSONB livre por template). */
export type ChecklistRespostas = Record<string, string | number | boolean | null>;

export interface ServiceOrder {
  id: string;
  numero: number;
  tipo: OsType;
  prioridade: OsPriority;
  status: OsStatus;
  origem: OsOrigin;
  building_id: string;
  equipment_id: string | null;
  pmoc_plan_id: string | null;
  technician_id: string | null;
  descricao: string | null;
  scheduled_at: string | null;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkin_at: string | null;
  checklist_template_id: string | null;
  checklist_respostas: ChecklistRespostas | null;
  fotos_antes: string[];
  fotos_depois: string[];
  laudo: string | null;
  assinatura_path: string | null;
  concluded_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  canal: string;
  telefone: string;
  client_id: string | null;
  status: ConversationStatus;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  direcao: MessageDirection;
  autor: MessageAuthor;
  texto: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  client_id: string;
  tipo: ContractType;
  valor_mensal: number;
  status: ContractStatus;
  dia_vencimento: number;
  inicio: string;
  fim: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  contract_id: string;
  competencia: string;
  valor: number;
  status: InvoiceStatus;
  metodo: PaymentMethod | null;
  vencimento: string | null;
  asaas_id: string | null;
  asaas_url: string | null;
  nf_numero: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// Tipos compostos (getters com relações e itens de lista das telas)
// ----------------------------------------------------------------------------

export interface BuildingWithClient extends Building {
  client: Pick<Client, "id" | "razao_social" | "nome_fantasia" | "segmento">;
}

/** Pino do mapa: prédio + cliente + contagem de equipamentos por status. */
export interface BuildingMapItem extends BuildingWithClient {
  equipment_total: number;
  equipment_com_chamado: number;
}

export interface BuildingWithEquipment extends Building {
  equipment: Equipment[];
}

export interface ClientWithRelations extends Client {
  buildings: BuildingWithEquipment[];
  contracts: Contract[];
}

export interface EquipmentWithBuilding extends Equipment {
  building: BuildingWithClient;
}

export interface EquipmentWithRelations extends EquipmentWithBuilding {
  pmoc_plan: PmocPlan | null;
}

export interface ServiceOrderListItem extends ServiceOrder {
  building: Pick<Building, "id" | "nome" | "bairro" | "regiao"> & {
    client: Pick<Client, "id" | "razao_social" | "nome_fantasia">;
  };
  equipment: Pick<Equipment, "id" | "codigo_interno" | "tipo" | "marca" | "modelo"> | null;
  technician: Pick<Profile, "id" | "full_name" | "phone"> | null;
}

export interface ServiceOrderWithRelations extends ServiceOrder {
  building: BuildingWithClient;
  equipment: Equipment | null;
  technician: Profile | null;
  checklist_template: ChecklistTemplate | null;
  pmoc_plan: PmocPlan | null;
}

export interface ContractWithClient extends Contract {
  client: Pick<Client, "id" | "razao_social" | "nome_fantasia" | "cnpj">;
}

export interface ContractWithRelations extends ContractWithClient {
  invoices: Invoice[];
}

export interface InvoiceWithContract extends Invoice {
  contract: Pick<Contract, "id" | "tipo" | "valor_mensal" | "dia_vencimento"> & {
    client: Pick<Client, "id" | "razao_social" | "nome_fantasia">;
  };
}

export interface ConversationWithMessages extends Conversation {
  client: Pick<Client, "id" | "razao_social" | "nome_fantasia"> | null;
  messages: Message[];
}

// ----------------------------------------------------------------------------
// Agregados do dashboard (0003_functions.sql)
// ----------------------------------------------------------------------------

/** Retorno de public.dashboard_resumo() (jsonb → objeto). */
export interface DashboardResumo {
  os_abertas: number;
  os_agendadas: number;
  os_em_campo: number;
  os_concluidas_mes: number;
  equip_com_chamado: number;
  pmoc_atrasados: number;
  pmoc_vencendo_7d: number;
  leads_mes: number;
  faturamento_previsto_mes: number;
  faturamento_recebido_mes: number;
}

/** Linha de public.vw_dashboard_chamados_por_mes. */
export interface ChamadosPorMesRow {
  mes: string;
  tipo: OsType;
  status: OsStatus;
  total: number;
}

/** Ponto agregado da série mensal de chamados usada nos gráficos (6 meses). */
export interface ChamadosPorMesPoint {
  /** Primeiro dia do mês, "YYYY-MM-DD". */
  mes: string;
  total: number;
  por_tipo: Record<OsType, number>;
}

/** Linha de public.vw_dashboard_funil_mes. */
export interface FunilMesRow {
  estagio: LeadStage;
  total: number;
  valor_estimado_total: number;
}

/** Funil comercial do mês corrente, pronto para a tela. */
export interface FunilDoMes {
  /** Leads criados no mês (todos os estágios, inclusive perdidos). */
  leads_total: number;
  /** Chegaram a marcar reunião (estágio >= reuniao_marcada, exceto perdido). */
  reunioes_marcadas: number;
  /** Reuniões realizadas (estágio >= reuniao_realizada, exceto perdido). */
  reunioes_realizadas: number;
  vendas: number;
  perdidos: number;
  /** Soma de valor_estimado dos leads convertidos (estagio = venda) no mês. */
  valor_convertido: number;
  /** Soma de valor_estimado de todo o funil do mês. */
  valor_em_funil: number;
  /** Taxas em % (0-100), null quando o denominador é zero. */
  taxa_lead_para_reuniao: number | null;
  taxa_reuniao_para_realizada: number | null;
  taxa_realizada_para_venda: number | null;
  taxa_conversao_geral: number | null;
  por_estagio: FunilMesRow[];
}

/** Linha de public.vw_dashboard_pmoc_situacao. */
export interface PmocSituacaoItem {
  pmoc_plan_id: string;
  cliente: string;
  predio: string;
  codigo_interno: string;
  equipamento_tipo: EquipmentType;
  periodicidade_dias: number;
  proxima_data: string;
  dias_para_vencer: number;
  situacao: PmocSituacao;
}

/** Contadores de situação PMOC para cards/badges. */
export interface PmocContadores {
  total: number;
  em_dia: number;
  vencendo_7d: number;
  atrasados: number;
}

/** Visita (real ou projetada pela periodicidade) no calendário PMOC. */
export interface PmocCalendarItem {
  /** Data da visita no mês consultado, "YYYY-MM-DD". */
  data: string;
  pmoc_plan_id: string;
  codigo_interno: string;
  equipamento_tipo: EquipmentType;
  cliente: string;
  predio: string;
  periodicidade_dias: number;
  situacao: PmocSituacao;
  /** true quando a data é projeção futura (proxima_data + n × periodicidade). */
  projetada: boolean;
}

/** Linha de public.vw_dashboard_faturamento. */
export interface FaturamentoMesRow {
  mes: string;
  previsto: number;
  recebido: number;
  pendente: number;
  atrasado: number;
}

/** KPIs do topo do dashboard. */
export interface DashboardKpis {
  /** Equipamentos ativos em prédios de clientes com contrato ativo. */
  equipamentos_sob_contrato: number;
  /** OS em andamento (aberto + agendado + em_campo). */
  chamados_abertos: number;
  /** % de conversas triadas pela IA sem transferência para humano (0-100). */
  triagem_ia_pct: number | null;
  /** Tempo médio (minutos) entre a 1ª mensagem do cliente e a 1ª resposta. */
  tempo_primeira_resposta_min: number | null;
}

// ----------------------------------------------------------------------------
// Infra do data layer (paginação e padrão de erro)
// ----------------------------------------------------------------------------

/**
 * Todo acesso a dados resolve para Result<T>: nunca lança e nunca vaza o erro
 * cru do Supabase — `error` já vem como mensagem pt-BR acionável para a UI.
 */
export type Result<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface PageParams {
  /** 1-based. Default 1. */
  page?: number;
  /** Default 20. */
  pageSize?: number;
}
