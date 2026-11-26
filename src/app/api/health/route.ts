import { NextResponse } from "next/server";

/**
 * Verificação de saúde para monitoramento externo (uptime).
 * Não expõe dados: informa apenas se o app, a autenticação e o banco respondem.
 */
export const dynamic = "force-dynamic";

type Check = "ok" | "erro" | "não configurado";

async function probe(url: string, init: RequestInit): Promise<Check> {
  try {
    const r = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(4000) });
    return r.ok ? "ok" : "erro";
  } catch { return "erro"; }
}

export async function GET() {
  const started = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let auth: Check = "não configurado", banco: Check = "não configurado";
  if (url && key) {
    [auth, banco] = await Promise.all([
      probe(`${url}/auth/v1/health`, { headers: { apikey: key } }),
      probe(`${url}/rest/v1/rpc/health_check`, { method: "POST", headers: { apikey: key, "content-type": "application/json" }, body: "{}" }),
    ]);
  }
  const ok = auth === "ok" && banco === "ok";
  return NextResponse.json(
    { status: ok ? "ok" : "degradado", auth, banco, versao: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local", latencia_ms: Date.now() - started },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
