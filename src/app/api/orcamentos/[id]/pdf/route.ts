import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { orcamentoPdfFilename, renderOrcamentoPdf } from "@/lib/pdf/orcamento-pdf";
import { authorizeRoute } from "@/server/auth";
import { getQuote } from "@/server/quotes";

/**
 * GET /api/orcamentos/<id>/pdf — PDF do orçamento, inline (abre no
 * visualizador do navegador). Admin, atendente e técnico (mesma regra de
 * leitura dos orçamentos); a RLS do Supabase continua valendo no getQuote.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = z.uuid();

function erro(status: number, mensagem: string) {
  return NextResponse.json(
    { error: mensagem },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await authorizeRoute("admin", "atendente", "tecnico");
  if (auth.status === 401) return erro(401, "Sessão expirada — entre novamente.");
  if (auth.status === 403) return erro(403, "Sem permissão");

  const { id } = await ctx.params;
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return erro(400, "Orçamento inválido.");

  const quote = await getQuote(parsed.data);
  if (quote.error !== null) return erro(500, quote.error);
  if (!quote.data) return erro(404, "Orçamento não encontrado.");

  try {
    const pdf = await renderOrcamentoPdf(quote.data);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${orcamentoPdfFilename(quote.data.numero)}"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[api/orcamentos/pdf] render:", error instanceof Error ? error.message : error);
    return erro(500, "Não foi possível gerar o PDF do orçamento. Tente novamente.");
  }
}
