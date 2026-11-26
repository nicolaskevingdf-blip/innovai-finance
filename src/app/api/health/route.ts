import { NextResponse } from "next/server";

/**
 * Verificação de saúde para monitoramento externo (uptime).
 * Não expõe dados: informa apenas se o app e o serviço de autenticação/banco respondem.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let backend: "ok" | "erro" | "não configurado" = "não configurado";
  if (url && key) {
    try {
      const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key }, cache: "no-store", signal: AbortSignal.timeout(4000) });
      backend = r.ok ? "ok" : "erro";
    } catch { backend = "erro"; }
  }
  const ok = backend === "ok";
  return NextResponse.json({ status: ok ? "ok" : "degradado", backend, latencia_ms: Date.now() - started }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
