import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { isDemoMode } from "@/lib/env"
import { createClient as createSupabase } from "@/lib/supabase/server"
import { safeNext } from "../safe-next"

const OTP_TYPES: readonly EmailOtpType[] = [
  "invite",
  "recovery",
  "signup",
  "magiclink",
  "email",
  "email_change",
]

/**
 * Retorno dos links de e-mail do Supabase (recuperação de senha e convite).
 * - `?code=` (PKCE): troca o code por sessão.
 * - `?token_hash=&type=` (template de e-mail customizado): verifica o OTP.
 * `next` só aceita caminho relativo (anti open redirect).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const next = safeNext(params.get("next")) ?? "/"
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin))

  if (isDemoMode) return to("/")

  const code = params.get("code")
  const tokenHash = params.get("token_hash")
  const type = params.get("type") as EmailOtpType | null

  try {
    const supabase = await createSupabase()
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return to(next)
      console.error("[auth/callback] exchangeCodeForSession:", error.message)
    } else if (tokenHash && type && OTP_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      if (!error) return to(next)
      console.error("[auth/callback] verifyOtp:", error.message)
    }
  } catch (error) {
    console.error("[auth/callback]:", error)
  }

  return to("/login?erro=link")
}
