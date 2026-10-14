import { NextResponse, type NextRequest } from "next/server"

import { isDemoMode } from "@/lib/env"
import { createClient as createSupabase } from "@/lib/supabase/server"

/**
 * Encerra a sessão a partir de um redirect de Server Component (que não pode
 * gravar cookies) — usado quando o usuário está inativo ou sem papel.
 * O "Sair" do menu usa a server action signOut (POST).
 */
export async function GET(request: NextRequest) {
  if (!isDemoMode) {
    try {
      const supabase = await createSupabase()
      await supabase.auth.signOut()
    } catch (error) {
      console.error("[auth/sair]:", error)
    }
  }
  const target = new URL("/login", request.nextUrl.origin)
  if (request.nextUrl.searchParams.get("erro") === "inativo") {
    target.searchParams.set("erro", "inativo")
  }
  return NextResponse.redirect(target)
}
