import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "../supabase/server";
import { errorKind, logEvent } from "../log";

/**
 * A IA generativa é OPCIONAL. Sem ANTHROPIC_API_KEY, a plataforma usa o
 * interpretador determinístico e o motor de regras — e informa isso na interface.
 */
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
export function claude() {
  if (!aiEnabled()) return null;
  // Tempo máximo por chamada e no máximo 1 nova tentativa: o usuário nunca fica preso e o custo de falhas é limitado.
  client ??= new Anthropic({ timeout: 25_000, maxRetries: 1 });
  return client;
}

export const MODEL = "claude-opus-5-5";
/** Fallback no servidor caso o modelo recuse por classificadores de segurança. */
export const FALLBACK = { betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[], fallbacks: "default" as const };

export function textOf(msg: Anthropic.Beta.BetaMessage): string {
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

/** Limite diário de chamadas à IA generativa por usuário (controle de custo). Padrão: 30. */
export const AI_DAILY_LIMIT = Math.max(0, Number(process.env.AI_DAILY_LIMIT ?? 30) || 0);

/** Consome 1 unidade da cota diária do usuário no banco. Retorna false se o limite foi atingido. */
export async function consumeQuota(): Promise<boolean> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("consume_ai_quota", { p_limit: AI_DAILY_LIMIT });
  if (error) { logEvent("error", "ai.quota_error", { code: error.code }); return false; }
  if (data !== true) logEvent("info", "ai.quota_reached", { limit: AI_DAILY_LIMIT });
  return data === true;
}

/** Registra consumo de tokens (somente contagens) para acompanhar custo por usuário/dia. */
export async function recordUsage(feature: "interpret" | "assistant", msg: Anthropic.Beta.BetaMessage, ms: number) {
  const input = (msg.usage.input_tokens ?? 0) + (msg.usage.cache_read_input_tokens ?? 0) + (msg.usage.cache_creation_input_tokens ?? 0);
  const output = msg.usage.output_tokens ?? 0;
  logEvent("info", "ai.call", { feature, model: msg.model, stop: msg.stop_reason ?? null, input, output, ms });
  try {
    const sb = await createClient();
    await sb.rpc("record_ai_tokens", { p_in: input, p_out: output });
  } catch { /* telemetria nunca derruba a resposta */ }
}

/** Log de falha da IA sem conteúdo (tipo/status do erro apenas). */
export function logAiFailure(feature: "interpret" | "assistant", e: unknown) {
  const k = e instanceof Anthropic.APIError ? { error: e.constructor.name, status: e.status } : errorKind(e);
  logEvent(k.status === 429 || (k.status ?? 0) >= 500 ? "warn" : "error", "ai.failure", { feature, ...k });
}
