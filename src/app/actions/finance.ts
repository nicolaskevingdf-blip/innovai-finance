"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { addMonths, addDays, todayISO, monthStart } from "@/lib/finance/dates";
import { planCardPurchase } from "@/lib/finance/cards";
import { planSettlement } from "@/lib/finance/obligations";
import { toCents } from "@/lib/finance/money";
import { check, db, fail, formObject, isoDate, money, optText, optUuid, positiveMoney, type ActionState } from "./_util";

const refresh = (ws: string) => revalidatePath(`/w/${ws}`, "layout");
const PM = z.enum(["cash", "pix", "debit", "credit", "boleto", "transfer", "app", "other"]).optional().or(z.literal("").transform(() => undefined));

const TxForm = z.object({
  ws: z.string().uuid(),
  type: z.enum(["income", "expense", "transfer"]),
  amount: positiveMoney,
  description: z.string().trim().min(1, "Informe uma descrição").max(140),
  date: isoDate,
  status: z.enum(["paid", "pending"]).default("paid"),
  due_date: isoDate.optional().or(z.literal("").transform(() => undefined)),
  category_id: optUuid,
  account_id: optUuid,
  to_account_id: optUuid,
  card_id: optUuid,
  contact_id: optUuid,
  payment_method: PM,
  installments: z.coerce.number().int().min(1).max(72).default(1),
  recurrence: z.enum(["", "weekly", "monthly", "yearly"]).default(""),
  recurrence_count: z.coerce.number().int().min(2).max(60).default(12),
  notes: optText(1000),
  tags: z.string().max(300).optional(),
  source: z.enum(["manual", "ai_text", "voice"]).default("manual"),
});

export async function createTransaction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = TxForm.parse(formObject(fd));
    const sb = await createClient();
    const { data: u } = await sb.auth.getUser();
    const tags = (f.tags ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10);
    const base = { workspace_id: f.ws, description: f.description, category_id: f.category_id ?? null, contact_id: f.contact_id ?? null, payment_method: f.payment_method ?? null, notes: f.notes, tags, source: f.source, created_by: u.user!.id };
    const rows: Record<string, unknown>[] = [];

    if (f.type === "transfer") {
      if (!f.account_id || !f.to_account_id) return { error: "Escolha a conta de origem e a de destino." };
      if (f.account_id === f.to_account_id) return { error: "Origem e destino devem ser contas diferentes." };
      rows.push({ ...base, type: "transfer", status: "paid", amount: db(f.amount), account_id: f.account_id, to_account_id: f.to_account_id, date: f.date, competence_date: f.date, paid_at: f.date, category_id: null });
    } else if (f.type === "expense" && f.card_id) {
      // Compra no cartão: gera as parcelas nas faturas correspondentes
      const { data: card } = await sb.from("credit_cards").select("closing_day").eq("id", f.card_id).eq("workspace_id", f.ws).single();
      if (!card) return { error: "Cartão não encontrado." };
      const plan = planCardPurchase({ purchaseDate: f.date, totalCents: f.amount, installments: f.installments, closingDay: card.closing_day });
      const group = plan.length > 1 ? crypto.randomUUID() : null;
      for (const p of plan)
        rows.push({ ...base, type: "expense", status: "paid", amount: db(p.amount), card_id: f.card_id, account_id: null, invoice_month: p.invoiceMonth, date: p.date, competence_date: p.invoiceMonth, payment_method: "credit",
          description: plan.length > 1 ? `${f.description} (${p.number}/${p.total})` : f.description,
          installment_group: group, installment_number: group ? p.number : null, installment_total: group ? p.total : null });
    } else {
      if (f.status === "paid" && !f.account_id) return { error: "Escolha a conta para um lançamento já pago/recebido." };
      const occurrences = f.recurrence ? f.recurrence_count : f.installments;
      const step = (d: string, i: number) => f.recurrence === "weekly" ? addDays(d, 7 * i) : f.recurrence === "yearly" ? addMonths(d, 12 * i) : addMonths(d, i);
      let recurrenceId: string | null = null;
      if (f.recurrence) {
        const r = check(await sb.from("recurrences").insert({ workspace_id: f.ws, frequency: f.recurrence, start_date: f.date, generated_until: step(f.date, occurrences - 1) }).select("id").single());
        recurrenceId = r.id;
      }
      const amounts = f.recurrence ? Array(occurrences).fill(f.amount) : (await import("@/lib/finance/cards")).splitInstallments(f.amount, occurrences);
      const group = !f.recurrence && occurrences > 1 ? crypto.randomUUID() : null;
      const due0 = f.due_date ?? f.date;
      for (let i = 0; i < occurrences; i++) {
        const date = step(f.date, i), due = step(due0, i);
        // Apenas a primeira ocorrência herda o status "pago"; as futuras ficam pendentes
        const status = i === 0 ? f.status : "pending";
        rows.push({ ...base, type: f.type, status, amount: db(amounts[i]), account_id: f.account_id ?? null, date, competence_date: date, due_date: status === "pending" ? due : null, paid_at: status === "paid" ? date : null,
          description: group ? `${f.description} (${i + 1}/${occurrences})` : f.description, installment_group: group, installment_number: group ? i + 1 : null, installment_total: group ? occurrences : null,
          recurrence_id: recurrenceId, source: recurrenceId && i > 0 ? "recurrence" : f.source });
      }
    }
    check(await sb.from("transactions").insert(rows));
    refresh(f.ws);
    return { ok: true, message: rows.length > 1 ? `${rows.length} lançamentos registrados.` : "Lançamento registrado." };
  } catch (e) { return fail(e); }
}

export async function updateTransaction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), id: z.string().uuid(), description: z.string().trim().min(1).max(140), amount: positiveMoney, date: isoDate, due_date: isoDate.optional().or(z.literal("").transform(() => undefined)), category_id: optUuid, account_id: optUuid, contact_id: optUuid, payment_method: PM, notes: optText(1000), tags: z.string().max(300).optional() }).parse(formObject(fd));
    const sb = await createClient();
    const cur = check(await sb.from("transactions").select("type, card_id, status").eq("id", f.id).eq("workspace_id", f.ws).single());
    const patch: Record<string, unknown> = { description: f.description, amount: db(f.amount), category_id: f.category_id ?? null, contact_id: f.contact_id ?? null, payment_method: f.payment_method ?? null, notes: f.notes, tags: (f.tags ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) };
    if (!cur.card_id) {
      patch.date = f.date; patch.competence_date = f.date;
      if (cur.status === "pending") patch.due_date = f.due_date ?? f.date;
      if (cur.status === "paid") patch.paid_at = f.date;
      if (cur.type !== "transfer" && f.account_id) patch.account_id = f.account_id;
    }
    check(await sb.from("transactions").update(patch).eq("id", f.id).eq("workspace_id", f.ws).select("id").single());
    refresh(f.ws);
    return { ok: true, message: "Lançamento atualizado." };
  } catch (e) { return fail(e); }
}

export async function deleteTransaction(fd: FormData) {
  const f = z.object({ ws: z.string().uuid(), id: z.string().uuid(), scope: z.enum(["one", "group", "future"]).default("one") }).parse(formObject(fd));
  const sb = await createClient();
  const { data: t } = await sb.from("transactions").select("installment_group, recurrence_id, date").eq("id", f.id).eq("workspace_id", f.ws).single();
  let q = sb.from("transactions").delete().eq("workspace_id", f.ws);
  if (f.scope === "group" && t?.installment_group) q = q.eq("installment_group", t.installment_group);
  else if (f.scope === "future" && t?.recurrence_id) q = q.eq("recurrence_id", t.recurrence_id).gte("date", t.date).eq("status", "pending");
  else q = q.eq("id", f.id);
  await q;
  refresh(f.ws);
}

/** Baixa total ou parcial de uma conta pendente. Parcial: divide o lançamento preservando histórico. */
export async function settleTransaction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), id: z.string().uuid(), amount: positiveMoney, date: isoDate, account_id: z.string().uuid("Escolha a conta"), payment_method: PM }).parse(formObject(fd));
    const sb = await createClient();
    const t = check(await sb.from("transactions").select("*").eq("id", f.id).eq("workspace_id", f.ws).single());
    if (t.status !== "pending") return { error: "Este lançamento não está pendente." };
    if (t.card_id) return { error: "Compras no cartão são quitadas pelo pagamento da fatura." };
    const s = planSettlement(toCents(t.amount), f.amount);
    if (s.isPartial) {
      check(await sb.from("transactions").insert({ workspace_id: f.ws, type: t.type, status: "paid", amount: db(s.paid), description: `${t.description} (pagamento parcial)`.slice(0, 140), category_id: t.category_id, account_id: f.account_id, contact_id: t.contact_id, date: f.date, competence_date: t.competence_date, paid_at: f.date, payment_method: f.payment_method ?? t.payment_method, parent_id: t.parent_id ?? t.id, tags: t.tags, created_by: (await sb.auth.getUser()).data.user!.id }));
      const tags = Array.from(new Set([...(t.tags ?? []), "parcial"]));
      check(await sb.from("transactions").update({ amount: db(s.remaining), tags }).eq("id", t.id).select("id").single());
    } else {
      check(await sb.from("transactions").update({ status: "paid", paid_at: f.date, account_id: f.account_id, payment_method: f.payment_method ?? t.payment_method }).eq("id", t.id).select("id").single());
    }
    refresh(f.ws);
    return { ok: true, message: s.isPartial ? "Pagamento parcial registrado. O saldo restante continua em aberto." : t.type === "income" ? "Recebimento registrado." : "Pagamento registrado." };
  } catch (e) { return fail(e); }
}

export async function cancelTransaction(fd: FormData) {
  const f = z.object({ ws: z.string().uuid(), id: z.string().uuid() }).parse(formObject(fd));
  const sb = await createClient();
  await sb.from("transactions").update({ status: "canceled" }).eq("id", f.id).eq("workspace_id", f.ws).eq("status", "pending");
  refresh(f.ws);
}

// ---------- Contas ----------
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
  await sb.from("financial_accounts").update({ archived: f.archived === "true" }).eq("id", f.id).eq("workspace_id", f.ws);
  refresh(f.ws);
}

// ---------- Cartões ----------
export async function saveCard(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), id: optUuid, name: z.string().trim().min(1, "Informe o nome").max(60), bank: optText(60), limit_amount: money, closing_day: z.coerce.number().int().min(1, "Dia entre 1 e 28").max(28, "Dia entre 1 e 28"), due_day: z.coerce.number().int().min(1, "Dia entre 1 e 28").max(28, "Dia entre 1 e 28") }).parse(formObject(fd));
    const sb = await createClient();
    const row = { name: f.name, bank: f.bank, limit_amount: db(f.limit_amount), closing_day: f.closing_day, due_day: f.due_day };
    if (f.id) check(await sb.from("credit_cards").update(row).eq("id", f.id).eq("workspace_id", f.ws).select("id").single());
    else check(await sb.from("credit_cards").insert({ ...row, workspace_id: f.ws }));
    refresh(f.ws);
    return { ok: true, message: "Cartão salvo." };
  } catch (e) { return fail(e); }
}

/** Pagamento de fatura: sai da conta, abate o cartão. Não é despesa (as compras já foram contabilizadas). */
export async function payInvoice(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), card_id: z.string().uuid(), invoice_month: isoDate, amount: positiveMoney, account_id: z.string().uuid("Escolha a conta"), date: isoDate }).parse(formObject(fd));
    if (f.invoice_month !== monthStart(f.invoice_month)) return { error: "Fatura inválida." };
    const sb = await createClient();
    const { data: card } = await sb.from("credit_cards").select("name").eq("id", f.card_id).single();
    check(await sb.from("transactions").insert({ workspace_id: f.ws, type: "card_payment", status: "paid", amount: db(f.amount), description: `Pagamento fatura ${card?.name ?? ""}`.trim(), account_id: f.account_id, card_id: f.card_id, invoice_month: f.invoice_month, date: f.date, competence_date: f.date, paid_at: f.date, created_by: (await sb.auth.getUser()).data.user!.id }));
    refresh(f.ws);
    return { ok: true, message: "Pagamento da fatura registrado." };
  } catch (e) { return fail(e); }
}

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

// ---------- Documentos ----------
const MAX_FILE = 10 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic"];

export async function uploadAttachment(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ws = z.string().uuid().parse(fd.get("ws"));
    const txId = z.string().uuid().optional().or(z.literal("").transform(() => undefined)).parse(fd.get("transaction_id") ?? "");
    const kind = z.enum(["invoice", "boleto", "receipt", "proof", "contract", "bill", "purchase", "other"]).parse(fd.get("kind") ?? "other");
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Selecione um arquivo." };
    if (file.size > MAX_FILE) return { error: "Arquivo maior que 10 MB." };
    if (!ALLOWED.includes(file.type)) return { error: "Formato não suportado. Envie PDF ou imagem." };
    const sb = await createClient();
    const { data: u } = await sb.auth.getUser();
    const safe = file.name.normalize("NFD").replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${ws}/${crypto.randomUUID()}-${safe}`;
    const up = await sb.storage.from("documents").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) throw new Error(up.error.message);
    const ins = await sb.from("attachments").insert({ workspace_id: ws, transaction_id: txId ?? null, kind, path, file_name: file.name.slice(0, 200), mime_type: file.type, size_bytes: file.size, uploaded_by: u.user!.id });
    if (ins.error) { await sb.storage.from("documents").remove([path]); throw new Error(ins.error.message); }
    refresh(ws);
    return { ok: true, message: "Documento anexado." };
  } catch (e) { return fail(e); }
}

export async function deleteAttachment(fd: FormData) {
  const f = z.object({ ws: z.string().uuid(), id: z.string().uuid() }).parse(formObject(fd));
  const sb = await createClient();
  const { data } = await sb.from("attachments").select("path").eq("id", f.id).eq("workspace_id", f.ws).single();
  if (data) {
    await sb.storage.from("documents").remove([data.path]);
    await sb.from("attachments").delete().eq("id", f.id);
  }
  refresh(f.ws);
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
