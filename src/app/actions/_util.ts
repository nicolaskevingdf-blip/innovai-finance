import "server-only";
import { z } from "zod";
import { parseMoneyInput } from "@/lib/finance/money";
import { isISODate } from "@/lib/finance/dates";

export type ActionState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string>; data?: unknown } | null;

export const money = z.string().transform((s, ctx) => {
  const c = parseMoneyInput(s);
  if (c === null) { ctx.addIssue({ code: "custom", message: "Valor inválido" }); return z.NEVER; }
  return c;
});
export const positiveMoney = money.refine((c) => c > 0, "Informe um valor maior que zero");
export const isoDate = z.string().refine(isISODate, "Data inválida");
export const optUuid = z.string().uuid().optional().or(z.literal("").transform(() => undefined));
export const optText = (max = 500) => z.string().max(max).optional().transform((s) => (s && s.trim() ? s.trim() : null));

export function formObject(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  fd.forEach((v, k) => { if (typeof v === "string") o[k] = v; });
  return o;
}

export function fail(e: unknown): ActionState {
  if (e instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const i of e.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return { error: Object.values(fieldErrors)[0] ?? "Dados inválidos", fieldErrors };
  }
  const msg = e instanceof Error ? e.message : String(e);
  // Mensagens de RLS não devem expor detalhes internos
  if (/row-level security/i.test(msg)) return { error: "Você não tem permissão para esta ação neste ambiente." };
  if (/violates foreign key|restrict/i.test(msg)) return { error: "Este item está em uso por outros registros e não pode ser excluído. Arquive-o." };
  if (/duplicate key/i.test(msg)) return { error: "Já existe um registro com esses dados." };
  return { error: msg.length < 160 ? msg : "Não foi possível concluir a operação." };
}

/** Converte centavos para o formato numérico aceito pelo Postgres. */
export const db = (c: number) => (c / 100).toFixed(2);

export function check<T>(r: { data: T; error: { message: string } | null }): Exclude<T, null> {
  if (r.error) throw new Error(r.error.message);
  return r.data as Exclude<T, null>;
}
