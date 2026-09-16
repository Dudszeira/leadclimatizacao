"use server"

import { revalidatePath } from "next/cache"

import { isDemoMode } from "@/lib/env"
import { createClient as createSupabase } from "@/lib/supabase/server"

export interface GerarOsPmocState {
  status: "success" | "error"
  message: string
}

/**
 * Dispara a RPC generate_pmoc_service_orders(p_janela_dias := 7): gera OS
 * preventivas para os planos atrasados e para os que vencem nos próximos
 * 7 dias. Idempotente no banco — não duplica enquanto houver OS em andamento
 * ligada ao plano. Em modo demo não grava nada e devolve mensagem para toast.
 */
export async function gerarOsPmoc(): Promise<GerarOsPmocState> {
  if (isDemoMode) {
    return {
      status: "error",
      message:
        "Modo demonstração — a geração de OS será habilitada quando o banco do cliente for conectado.",
    }
  }

  try {
    const supabase = await createSupabase()
    const { data, error } = await supabase.rpc("generate_pmoc_service_orders", {
      p_janela_dias: 7,
    })
    if (error) {
      console.error("[actions/pmoc] generate_pmoc_service_orders:", error)
      return {
        status: "error",
        message: "Não foi possível gerar as OS agora. Tente novamente.",
      }
    }

    revalidatePath("/pmoc")
    revalidatePath("/chamados")

    const criadas = typeof data === "number" ? data : 0
    if (criadas === 0) {
      return {
        status: "success",
        message:
          "Nenhuma OS nova — os planos devidos já têm OS em andamento.",
      }
    }
    return {
      status: "success",
      message:
        criadas === 1
          ? "1 OS preventiva gerada com sucesso."
          : `${criadas} OS preventivas geradas com sucesso.`,
    }
  } catch (error) {
    console.error("[actions/pmoc] gerarOsPmoc:", error)
    return {
      status: "error",
      message: "Não foi possível gerar as OS agora. Tente novamente.",
    }
  }
}
