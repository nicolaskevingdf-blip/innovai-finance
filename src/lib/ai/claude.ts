import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "../supabase/server";

/**
 * A IA generativa é OPCIONAL. Sem ANTHROPIC_API_KEY, a plataforma usa o
 * interpretador determinístico e o motor de regras — e informa isso na interface.
 */
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
export function claude() {
  if (!aiEnabled()) return null;
  client ??= new Anthropic();
  return client;
}

export const MODEL = "claude-opus-5-5";
/** Fallback no servidor caso o modelo recuse por classificadores de segurança. */
export const FALLBACK = { betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[], fallbacks: "default" as const };

export function textOf(msg: Anthropic.Beta.BetaMessage): string {
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}

/** Limite diário de chamadas à IA generativa por usuário (controle de custo). Padrão: 60. */
export const AI_DAILY_LIMIT = Math.max(0, Number(process.env.AI_DAILY_LIMIT ?? 60) || 0);

/** Consome 1 unidade da cota diária do usuário no banco. Retorna false se o limite foi atingido. */
export async function consumeQuota(): Promise<boolean> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("consume_ai_quota", { p_limit: AI_DAILY_LIMIT });
  if (error) { console.error("consumeQuota", error.code); return false; }
  return data === true;
}
