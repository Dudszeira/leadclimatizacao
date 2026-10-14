import type { LeadOrigin, LeadStage } from "../../lib/types"

export const STAGE_LABELS: Record<LeadStage, string> = {
  lead: "Lead",
  reuniao_marcada: "Reunião marcada",
  reuniao_realizada: "Reunião realizada",
  venda: "Venda",
  perdido: "Perdido",
}

export const ORIGIN_LABELS: Record<LeadOrigin, string> = {
  indicacao: "Indicação",
  site: "Site",
  whatsapp: "WhatsApp",
}
