"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/finance/dates";
import { check, db, fail, formObject, isoDate, money, optText, optUuid, positiveMoney, refresh, type ActionState } from "./_util";

// ---------- Clientes e fornecedores ----------
export async function saveContact(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), id: optUuid, kind: z.enum(["client", "supplier"]), name: z.string().trim().min(1, "Informe o nome").max(100), phone: optText(30), email: z.string().email("E-mail inválido").optional().or(z.literal("").transform(() => null)), document: optText(20), notes: optText(1000) }).parse(formObject(fd));
    const sb = await createClient();
    const row = { kind: f.kind, name: f.name, phone: f.phone, email: f.email ?? null, document: f.document, notes: f.notes };
    if (f.id) check(await sb.from("contacts").update(row).eq("id", f.id).eq("workspace_id", f.ws).select("id").single());
    else check(await sb.from("contacts").insert({ ...row, workspace_id: f.ws }));
    refresh(f.ws);
    return { ok: true, message: f.kind === "client" ? "Cliente salvo." : "Fornecedor salvo." };
  } catch (e) { return fail(e); }
}

// ---------- Fechamento de caixa ----------
export async function closeCash(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), account_id: z.string().uuid("Escolha o caixa"), date: isoDate, opening_amount: money, cash_in: money, cash_out: money, counted_amount: money, sales_by_method: z.string().max(2000).optional(), justification: optText(500) }).parse(formObject(fd));
    const expected = f.opening_amount + f.cash_in - f.cash_out;
    if (f.counted_amount !== expected && !f.justification) return { error: "Há diferença entre o caixa esperado e o contado. Informe uma justificativa.", fieldErrors: { justification: "Obrigatório quando há diferença" } };
    const sb = await createClient();
    const { data: u } = await sb.auth.getUser();
    let sales: Record<string, number> = {};
    try { sales = JSON.parse(f.sales_by_method || "{}"); } catch { sales = {}; }
    check(await sb.from("cash_closings").insert({ workspace_id: f.ws, account_id: f.account_id, date: f.date, opening_amount: db(f.opening_amount), cash_in: db(f.cash_in), cash_out: db(f.cash_out), expected_amount: db(expected), counted_amount: db(f.counted_amount), sales_by_method: sales, justification: f.justification, closed_by: u.user!.id }));
    refresh(f.ws);
    const diff = f.counted_amount - expected;
    return { ok: true, message: diff === 0 ? "Caixa fechado sem diferenças." : `Caixa fechado com diferença registrada.` };
  } catch (e) { return fail(e); }
}


/**
 * Faturamento consolidado do dia por forma de pagamento.
 * Dinheiro/PIX/débito entram como recebidos; crédito e aplicativos ficam "a receber"
 * no prazo informado — diferenciando venda realizada de valor efetivamente recebido.
 */
export async function registerDailySales(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const o = formObject(fd);
    const f = z.object({ ws: z.string().uuid(), date: isoDate, cash_account: z.string().uuid("Escolha o caixa"), bank_account: z.string().uuid("Escolha a conta bancária"), category_id: optUuid, credit_days: z.coerce.number().int().min(0).max(120).default(30), app_days: z.coerce.number().int().min(0).max(120).default(30) }).parse(o);
    const methods = ["cash", "pix", "debit", "credit", "app", "other"] as const;
    const LABEL = { cash: "dinheiro", pix: "PIX", debit: "débito", credit: "crédito", app: "aplicativos", other: "outros" };
    const sb = await createClient();
    const uid = (await sb.auth.getUser()).data.user!.id;
    const rows: Record<string, unknown>[] = [];
    for (const m of methods) {
      const raw = o[`m_${m}`];
      if (!raw?.trim()) continue;
      const c = positiveMoney.parse(raw);
      const pending = m === "credit" || m === "app";
      const due = pending ? addDays(f.date, m === "credit" ? f.credit_days : f.app_days) : null;
      rows.push({ workspace_id: f.ws, type: "income", status: pending && due! > f.date ? "pending" : "paid", amount: db(c), description: `Vendas do dia — ${LABEL[m]}`, category_id: f.category_id ?? null, account_id: m === "cash" ? f.cash_account : f.bank_account, date: f.date, competence_date: f.date, due_date: pending && due! > f.date ? due : null, paid_at: pending && due! > f.date ? null : f.date, payment_method: m, tags: ["vendas-do-dia"], created_by: uid });
    }
    if (!rows.length) return { error: "Informe ao menos um valor." };
    check(await sb.from("transactions").insert(rows));
    refresh(f.ws);
    return { ok: true, message: `Faturamento do dia registrado (${rows.length} forma(s) de pagamento).` };
  } catch (e) { return fail(e); }
}
