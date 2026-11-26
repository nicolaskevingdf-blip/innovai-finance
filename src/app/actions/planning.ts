"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { addMonths } from "@/lib/finance/dates";
import { toCents } from "@/lib/finance/money";
import { check, db, fail, formObject, isoDate, money, optText, optUuid, positiveMoney, refresh, type ActionState } from "./_util";

// ---------- Categorias ----------
export async function saveCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), id: optUuid, name: z.string().trim().min(1, "Informe o nome").max(50), kind: z.enum(["income", "expense"]), grp: z.enum(["revenue", "cost", "fixed", "variable", "investment", "withdrawal", "personal", "other"]), parent_id: optUuid, icon: optText(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("").transform(() => undefined)) }).parse(formObject(fd));
    const sb = await createClient();
    const row = { name: f.name, kind: f.kind, grp: f.grp, parent_id: f.parent_id ?? null, icon: f.icon, color: f.color ?? null };
    if (f.id) check(await sb.from("categories").update(row).eq("id", f.id).eq("workspace_id", f.ws).select("id").single());
    else check(await sb.from("categories").insert({ ...row, workspace_id: f.ws }));
    refresh(f.ws);
    return { ok: true, message: "Categoria salva." };
  } catch (e) { return fail(e); }
}

/** Exclui se não houver uso; caso contrário arquiva (preserva o histórico). */
export async function removeCategory(fd: FormData) {
  const f = z.object({ ws: z.string().uuid(), id: z.string().uuid() }).parse(formObject(fd));
  const sb = await createClient();
  const { count } = await sb.from("transactions").select("id", { count: "exact", head: true }).eq("category_id", f.id);
  const { count: kids } = await sb.from("categories").select("id", { count: "exact", head: true }).eq("parent_id", f.id);
  if ((count ?? 0) > 0 || (kids ?? 0) > 0) await sb.from("categories").update({ archived: true }).eq("id", f.id).eq("workspace_id", f.ws);
  else await sb.from("categories").delete().eq("id", f.id).eq("workspace_id", f.ws);
  refresh(f.ws);
}

// ---------- Planejamento ----------
export async function saveBudgets(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const o = formObject(fd);
    const ws = z.string().uuid().parse(o.ws);
    const month = isoDate.parse(o.month);
    const sb = await createClient();
    const upserts: Record<string, unknown>[] = [], deletes: string[] = [];
    for (const [k, v] of Object.entries(o)) {
      if (!k.startsWith("b_")) continue;
      const cat = z.string().uuid().parse(k.slice(2));
      if (!v.trim()) { deletes.push(cat); continue; }
      const c = money.parse(v);
      if (c < 0) return { error: "Orçamentos não podem ser negativos." };
      upserts.push({ workspace_id: ws, category_id: cat, month, amount: db(c) });
    }
    if (upserts.length) check(await sb.from("budgets").upsert(upserts, { onConflict: "workspace_id,category_id,month" }));
    if (deletes.length) await sb.from("budgets").delete().eq("workspace_id", ws).eq("month", month).in("category_id", deletes);
    const income = o.expected_income ? money.parse(o.expected_income) : 0, savings = o.savings_target ? money.parse(o.savings_target) : 0;
    check(await sb.from("income_plans").upsert({ workspace_id: ws, month, expected_income: db(income), savings_target: db(savings) }));
    refresh(ws);
    return { ok: true, message: "Planejamento salvo." };
  } catch (e) { return fail(e); }
}

export async function copyBudgets(fd: FormData) {
  const f = z.object({ ws: z.string().uuid(), month: isoDate }).parse(formObject(fd));
  const sb = await createClient();
  const prev = addMonths(f.month, -1);
  const { data } = await sb.from("budgets").select("category_id, amount").eq("workspace_id", f.ws).eq("month", prev);
  if (data?.length) await sb.from("budgets").upsert(data.map((b) => ({ ...b, workspace_id: f.ws, month: f.month })), { onConflict: "workspace_id,category_id,month" });
  refresh(f.ws);
}

// ---------- Metas ----------
export async function saveGoal(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), id: optUuid, name: z.string().trim().min(1, "Informe o nome").max(80), kind: z.string().max(30).default("custom"), target_amount: positiveMoney, target_date: isoDate.optional().or(z.literal("").transform(() => undefined)), initial: money.optional() }).parse(formObject(fd));
    const sb = await createClient();
    const row = { name: f.name, kind: f.kind, target_amount: db(f.target_amount), target_date: f.target_date ?? null };
    if (f.id) check(await sb.from("goals").update(row).eq("id", f.id).eq("workspace_id", f.ws).select("id").single());
    else {
      const g = check(await sb.from("goals").insert({ ...row, workspace_id: f.ws }).select("id").single());
      if (f.initial && f.initial > 0) check(await sb.from("goal_contributions").insert({ workspace_id: f.ws, goal_id: g.id, amount: db(f.initial), note: "Valor inicial" }));
    }
    refresh(f.ws);
    return { ok: true, message: "Meta salva." };
  } catch (e) { return fail(e); }
}

export async function addContribution(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), goal_id: z.string().uuid(), amount: money.refine((c) => c !== 0, "Informe um valor"), date: isoDate, note: optText(140), withdraw: z.string().optional() }).parse(formObject(fd));
    const sb = await createClient();
    check(await sb.from("goal_contributions").insert({ workspace_id: f.ws, goal_id: f.goal_id, amount: db(f.withdraw === "on" ? -Math.abs(f.amount) : Math.abs(f.amount)), date: f.date, note: f.note }));
    refresh(f.ws);
    return { ok: true, message: f.withdraw === "on" ? "Resgate registrado." : "Aporte registrado." };
  } catch (e) { return fail(e); }
}

export async function archiveGoal(fd: FormData) {
  const f = z.object({ ws: z.string().uuid(), id: z.string().uuid() }).parse(formObject(fd));
  const sb = await createClient();
  await sb.from("goals").update({ archived: true }).eq("id", f.id).eq("workspace_id", f.ws);
  refresh(f.ws);
}

// ---------- Dívidas ----------
export async function saveDebt(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), id: optUuid, creditor: z.string().trim().min(1, "Informe o credor").max(80), description: optText(140), total_amount: positiveMoney, monthly_interest_rate: z.string().optional(), installments_total: z.coerce.number().int().min(1).max(600).optional().or(z.literal("").transform(() => undefined)), installment_amount: money.optional().or(z.literal("").transform(() => undefined)), due_day: z.coerce.number().int().min(1).max(31).optional().or(z.literal("").transform(() => undefined)), start_date: isoDate, status: z.enum(["active", "renegotiating", "paid", "canceled"]).default("active") }).parse(formObject(fd));
    const rate = f.monthly_interest_rate?.trim() ? Number(f.monthly_interest_rate.replace(",", ".")) : null;
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) return { error: "Taxa de juros inválida (% ao mês)." };
    const sb = await createClient();
    const row = { creditor: f.creditor, description: f.description, total_amount: db(f.total_amount), monthly_interest_rate: rate, installments_total: f.installments_total ?? null, installment_amount: f.installment_amount ? db(f.installment_amount) : null, due_day: f.due_day ?? null, start_date: f.start_date, status: f.status };
    if (f.id) check(await sb.from("debts").update(row).eq("id", f.id).eq("workspace_id", f.ws).select("id").single());
    else check(await sb.from("debts").insert({ ...row, workspace_id: f.ws }));
    refresh(f.ws);
    return { ok: true, message: "Dívida salva." };
  } catch (e) { return fail(e); }
}

export async function addDebtPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), debt_id: z.string().uuid(), amount: positiveMoney, date: isoDate, account_id: optUuid, register_expense: z.string().optional() }).parse(formObject(fd));
    const sb = await createClient();
    const debt = check(await sb.from("debts").select("creditor, total_amount").eq("id", f.debt_id).single());
    check(await sb.from("debt_payments").insert({ workspace_id: f.ws, debt_id: f.debt_id, amount: db(f.amount), date: f.date }));
    if (f.register_expense === "on" && f.account_id) {
      const { data: cat } = await sb.from("categories").select("id").eq("workspace_id", f.ws).eq("name", "Dívidas").maybeSingle();
      check(await sb.from("transactions").insert({ workspace_id: f.ws, type: "expense", status: "paid", amount: db(f.amount), description: `Pagamento dívida ${debt.creditor}`.slice(0, 140), account_id: f.account_id, category_id: cat?.id ?? null, date: f.date, competence_date: f.date, paid_at: f.date, created_by: (await sb.auth.getUser()).data.user!.id }));
    }
    const { data: pays } = await sb.from("debt_payments").select("amount").eq("debt_id", f.debt_id);
    const paid = (pays ?? []).reduce((s, p) => s + toCents(p.amount), 0);
    if (paid >= toCents(debt.total_amount)) await sb.from("debts").update({ status: "paid" }).eq("id", f.debt_id);
    refresh(f.ws);
    return { ok: true, message: "Pagamento registrado." };
  } catch (e) { return fail(e); }
}

// ---------- Patrimônio ----------
export async function saveAsset(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), id: optUuid, side: z.enum(["asset", "liability"]), type: z.enum(["property", "vehicle", "investment", "good", "account", "other", "loan", "financing"]), name: z.string().trim().min(1, "Informe o nome").max(80), value: money.refine((c) => c >= 0, "Valor inválido"), date: isoDate, notes: optText(300) }).parse(formObject(fd));
    const sb = await createClient();
    let id = f.id;
    if (id) check(await sb.from("assets").update({ name: f.name, type: f.type, notes: f.notes }).eq("id", id).eq("workspace_id", f.ws).select("id").single());
    else id = check(await sb.from("assets").insert({ workspace_id: f.ws, side: f.side, type: f.type, name: f.name, notes: f.notes }).select("id").single()).id;
    check(await sb.from("asset_values").upsert({ workspace_id: f.ws, asset_id: id, value: db(f.value), date: f.date }, { onConflict: "asset_id,date" }));
    refresh(f.ws);
    return { ok: true, message: "Registro salvo. O valor informado entra no histórico patrimonial." };
  } catch (e) { return fail(e); }
}

export async function archiveAsset(fd: FormData) {
  const f = z.object({ ws: z.string().uuid(), id: z.string().uuid() }).parse(formObject(fd));
  const sb = await createClient();
  await sb.from("assets").update({ archived: true }).eq("id", f.id).eq("workspace_id", f.ws);
  refresh(f.ws);
}
