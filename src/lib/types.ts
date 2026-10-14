/**
 * Tipos TypeScript do domínio Control Lead.
 * Fonte da verdade: supabase/migrations/0001_schema.sql (tabelas/enums),
 * 0003_functions.sql (views e dashboard_resumo()) e 0004..0006 (colunas novas).
 * Colunas adicionadas em 0004..0006 estão opcionais (`?`) até as fixtures
 * do modo demo serem atualizadas; no banco elas sempre existem.
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
  /** 0006 — código do serviço na prefeitura (NFS-e). */
  codigo_servico_municipal?: string | null;
  /** 0006 — alíquota de ISS em % (default 5). */
  aliquota_iss?: number;
  /** 0006 — ISS retido pelo tomador (default false). */
  reter_iss?: boolean;
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
  /** 0004 — nome de quem assinou no local. */
  assinado_por_nome?: string | null;
  /** 0004 — momento da assinatura. */
  assinado_em?: string | null;
  /** 0004 — observações técnicas livres do executor. */
  observacoes_tecnicas?: string | null;
  /** Preenchido pelo banco ao mudar status para "concluido". */
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
  /** 0006 — id da NFS-e no Asaas (único quando preenchido). */
  asaas_invoice_id?: string | null;
  nf_numero: string | null;
  /** 0008 — link (https) do PDF da NFS-e autorizada. */
  nf_url?: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

/** 0004 — public.service_order_photos (evidência no bucket os-fotos). */
export interface ServiceOrderPhoto {
  id: string;
  service_order_id: string;
  /** "<service_order_id>/<arquivo>" no bucket os-fotos. */
  storage_path: string;
  legenda: string | null;
  etapa: "antes" | "depois" | null;
  created_by: string | null;
  created_at: string;
}

/** 0006 — public.webhook_events (só service_role). id = id do evento Asaas. */
export interface WebhookEvent {
  id: string;
  event: string;
  payload: Record<string, unknown>;
  received_at: string;
  processed_at: string | null;
  error: string | null;
}

/** Buckets privados do Storage (0004). Caminho: "<service_order_id>/<arquivo>". */
export const STORAGE_BUCKETS = {
  fotos: "os-fotos",
  assinaturas: "os-assinaturas",
} as const;

// ----------------------------------------------------------------------------
// Tipos compostos (getters com relações e itens de lista das telas)
// ----------------------------------------------------------------------------

export interface BuildingWithClient extends Building {
  client: Pick<Client, "id" | "razao_social" | "nome_fantasia" | "segmento">;
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

// ----------------------------------------------------------------------------
// Onda 2D — cadastros (0007_cadastros.sql). Declaration merging: as colunas
// novas entram opcionais nas interfaces originais.
// ----------------------------------------------------------------------------

export interface Equipment {
  /** 0007 — número de série do fabricante (chave natural da importação). */
  numero_serie?: string | null;
}

export interface PmocPlan {
  /** 0007 — responsável técnico do plano (nome / registro CREA). */
  responsavel_tecnico?: string | null;
}

/** Plano PMOC com equipamento/prédio/cliente e a OS em aberto (tela de planos). */
export interface PmocPlanListItem extends PmocPlan {
  equipment: Pick<Equipment, "id" | "codigo_interno" | "tipo" | "marca" | "modelo" | "status">;
  building: Pick<Building, "id" | "nome">;
  client: Pick<Client, "id" | "razao_social" | "nome_fantasia">;
  /** OS do plano em aberto/agendada/em campo, se houver. */
  os_aberta: { id: string; numero: number; status: OsStatus } | null;
  /** Dias até proxima_data (negativo = atrasado). */
  dias_para_vencer: number;
  situacao: PmocSituacao;
}

// ----------------------------------------------------------------------------
// Execução da OS em campo (Onda 2C)
// ----------------------------------------------------------------------------

/** Item de checklist com obrigatoriedade explícita (opcional no JSONB). */
export interface ChecklistItemComRegra extends ChecklistItem {
  /** Default: checkbox/número obrigatórios, texto opcional. */
  obrigatorio?: boolean;
}

/** Foto da OS pronta para exibição (URL assinada gerada no servidor). */
export interface ServiceOrderPhotoView {
  /** id da linha em service_order_photos, ou "legado:<path>" (fotos_antes/fotos_depois). */
  id: string;
  storage_path: string;
  etapa: "antes" | "depois";
  legenda: string | null;
  created_at: string | null;
  /** null quando não há arquivo acessível (modo demo / legado sem objeto). */
  url: string | null;
}

/** Evidências da OS (fotos + assinatura) com URLs assinadas de curta duração. */
export interface ServiceOrderEvidence {
  photos: ServiceOrderPhotoView[];
  assinaturaUrl: string | null;
}

/** Card do app de campo: OS + endereço completo do prédio. */
export interface FieldOrderItem extends ServiceOrder {
  building: Pick<
    Building,
    "id" | "nome" | "logradouro" | "numero" | "bairro" | "cidade" | "uf" | "lat" | "lng"
  > & {
    client: Pick<Client, "id" | "razao_social" | "nome_fantasia">;
  };
  equipment: Pick<Equipment, "id" | "codigo_interno" | "tipo" | "ambiente"> | null;
  technician: Pick<Profile, "id" | "full_name"> | null;
}

/** Opção do combobox de equipamento (busca no servidor). */
export interface EquipmentOption {
  id: string;
  building_id: string;
  label: string;
}

// ----------------------------------------------------------------------------
// Mapa de equipamentos (src/server/map.ts): pino enxuto por prédio
// ----------------------------------------------------------------------------

/** Contagem de equipamentos do prédio por status. */
export type EquipmentStatusCounts = Record<EquipmentStatus, number>;

/** Pino do mapa: só o necessário para desenhar, buscar e abrir o cliente. */
export interface MapPin {
  id: string;
  nome: string;
  lat: number;
  lng: number;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  client: Pick<Client, "id" | "razao_social" | "nome_fantasia">;
  equipment_total: number;
  status_counts: EquipmentStatusCounts;
}

/** Recorte geográfico opcional do mapa (graus decimais). */
export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}
