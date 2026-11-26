import { NextResponse } from "next/server";
import { logEvent } from "@/lib/log";

/**
 * Recebe erros ocorridos no navegador (telas de erro) e registra no log do servidor.
 * Aceita apenas campos técnicos curtos; nunca mensagens livres (podem conter dados do usuário).
 */
export async function POST(req: Request) {
  const raw = await req.text().catch(() => "");
  if (raw.length > 2000) return new NextResponse(null, { status: 413 });
  let body: { digest?: unknown; name?: unknown; path?: unknown; where?: unknown } = {};
  try { body = JSON.parse(raw); } catch { /* corpo inválido: registra assim mesmo */ }
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
  logEvent("error", "client.error", {
    digest: str(body.digest, 40),
    error: str(body.name, 60),
    path: str(body.path, 120)?.split("?")[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id"),
    where: str(body.where, 30),
  });
  return new NextResponse(null, { status: 204 });
}
