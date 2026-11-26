"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/finance/dates";
import { toCents } from "@/lib/finance/money";
import { check, db, fail, formObject, money, optText, optUuid, refresh, type ActionState } from "./_util";

export async function saveAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), id: optUuid, name: z.string().trim().min(1, "Informe o nome").max(60), type: z.enum(["checking", "savings", "wallet", "cash", "digital", "investment", "other"]), institution: optText(60), opening_balance: money.optional() }).parse(formObject(fd));
    const sb = await createClient();
    if (f.id) check(await sb.from("financial_accounts").update({ name: f.name, type: f.type, institution: f.institution }).eq("id", f.id).eq("workspace_id", f.ws).select("id").single());
    else check(await sb.from("financial_accounts").insert({ workspace_id: f.ws, name: f.name, type: f.type, institution: f.institution, opening_balance: db(f.opening_balance ?? 0) }));
    refresh(f.ws);
    return { ok: true, message: "Conta salva." };
  } catch (e) { return fail(e); }
}

/** Ajuste de saldo: registra a diferença como movimentação 'adjustment' (auditável, fora dos relatórios). */
export async function adjustBalance(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), account_id: z.string().uuid(), real_balance: money, reason: z.string().trim().min(3, "Explique o motivo do ajuste").max(140) }).parse(formObject(fd));
    const sb = await createClient();
    const { data: b } = await sb.from("account_balances").select("balance").eq("account_id", f.account_id).single();
    const diff = f.real_balance - toCents(b?.balance ?? 0);
    if (diff === 0) return { ok: true, message: "O saldo já está correto." };
    const today = todayISO();
    check(await sb.from("transactions").insert({ workspace_id: f.ws, type: "adjustment", status: "paid", amount: db(diff), description: `Ajuste de saldo: ${f.reason}`.slice(0, 140), account_id: f.account_id, date: today, competence_date: today, paid_at: today, created_by: (await sb.auth.getUser()).data.user!.id }));
    refresh(f.ws);
    return { ok: true, message: "Saldo ajustado. O ajuste fica registrado no histórico da conta." };
  } catch (e) { return fail(e); }
}

export async function archiveAccount(fd: FormData) {
  const f = z.object({ ws: z.string().uuid(), id: z.string().uuid(), archived: z.enum(["true", "false"]) }).parse(formObject(fd));
  const sb = await createClient();
  if (f.archived === "true") {
    // Validação no servidor: arquivar conta com saldo esconderia dinheiro do saldo total
    const { data: b } = await sb.from("account_balances").select("balance").eq("account_id", f.id).single();
    if (toCents(b?.balance ?? 0) !== 0) throw new Error("Zere o saldo da conta antes de arquivá-la.");
  }
  await sb.from("financial_accounts").update({ archived: f.archived === "true" }).eq("id", f.id).eq("workspace_id", f.ws);
  refresh(f.ws);
}
