/**
 * Log estruturado (uma linha JSON por evento) — lido nos logs da Vercel e em drains de log.
 * Nunca registre conteúdo financeiro, e-mails, nomes, perguntas ou respostas da IA: apenas
 * identificadores técnicos, códigos de erro e contagens.
 */
type Level = "info" | "warn" | "error";
const SAFE = /^[\w.:/-]{0,120}$/;

export function logEvent(level: Level, event: string, data: Record<string, string | number | boolean | null | undefined> = {}) {
  const clean: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    clean[k] = typeof v === "string" && !SAFE.test(v) ? v.replace(/[^\w.:/ -]/g, "").slice(0, 120) : v;
  }
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...clean });
  if (level === "error") console.error(line); else if (level === "warn") console.warn(line); else console.log(line);
}

/** Nome/código seguro de um erro (sem a mensagem, que pode conter dados). */
export function errorKind(e: unknown): { error: string; status?: number } {
  if (e && typeof e === "object") {
    const o = e as { name?: string; status?: number; code?: string };
    return { error: String(o.code ?? o.name ?? "Error"), status: typeof o.status === "number" ? o.status : undefined };
  }
  return { error: typeof e };
}
