"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { addMonths, addDays } from "@/lib/finance/dates";
import { invoiceMonthFor, planCardPurchase, splitInstallments } from "@/lib/finance/cards";
import { planSettlement } from "@/lib/finance/obligations";
import { toCents } from "@/lib/finance/money";
import { check, db, fail, formObject, isoDate, optText, optUuid, positiveMoney, refresh, PM, type ActionState } from "./_util";

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
      const amounts = f.recurrence ? Array(occurrences).fill(f.amount) : splitInstallments(f.amount, occurrences);
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
    const patch: Record<string, unknown> = { description: f.description, amount: db(f.amount), category_id: f.category_id ?? null, notes: f.notes, tags: (f.tags ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) };
    // Só altera campos presentes no formulário (evita apagar dados que a tela não exibe)
    if (fd.has("contact_id")) patch.contact_id = f.contact_id ?? null;
    if (fd.has("payment_method")) patch.payment_method = f.payment_method ?? null;
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

/**
 * Exclui um lançamento (ou o grupo de parcelas / as próximas ocorrências).
 * Também remove os estornos vinculados e os documentos anexados no armazenamento.
 */
export async function deleteTransaction(fd: FormData) {
  const f = z.object({ ws: z.string().uuid(), id: z.string().uuid(), scope: z.enum(["one", "group", "future"]).default("one") }).parse(formObject(fd));
  const sb = await createClient();
  const { data: t } = await sb.from("transactions").select("installment_group, recurrence_id, date").eq("id", f.id).eq("workspace_id", f.ws).single();
  if (!t) return;
  let sel = sb.from("transactions").select("id").eq("workspace_id", f.ws);
  if (f.scope === "group" && t.installment_group) sel = sel.eq("installment_group", t.installment_group);
  else if (f.scope === "future" && t.recurrence_id) sel = sel.eq("recurrence_id", t.recurrence_id).gte("date", t.date).eq("status", "pending");
  else sel = sel.eq("id", f.id);
  const ids = ((await sel).data ?? []).map((r) => r.id as string);
  if (!ids.length) return;
  const refunds = ((await sb.from("transactions").select("id").eq("workspace_id", f.ws).eq("type", "refund").in("parent_id", ids)).data ?? []).map((r) => r.id as string);
  const all = [...ids, ...refunds];
  const { data: files } = await sb.from("attachments").select("path").eq("workspace_id", f.ws).in("transaction_id", all);
  const { error } = await sb.from("transactions").delete().eq("workspace_id", f.ws).in("id", all);
  if (error) throw new Error("Não foi possível excluir: verifique suas permissões.");
  if (files?.length) await sb.storage.from("documents").remove(files.map((x) => x.path));
  refresh(f.ws);
}

/**
 * Estorno de uma despesa (em conta ou no cartão). Valida no servidor que o total
 * estornado não ultrapassa o valor original. No cartão, o crédito entra na fatura aberta.
 */
export async function createRefund(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), id: z.string().uuid(), amount: positiveMoney, date: isoDate }).parse(formObject(fd));
    const sb = await createClient();
    const t = check(await sb.from("transactions").select("*").eq("id", f.id).eq("workspace_id", f.ws).single());
    if (t.type !== "expense" || t.status !== "paid") return { error: "Só é possível estornar despesas já pagas ou compras no cartão." };
    const { data: prev } = await sb.from("transactions").select("amount").eq("workspace_id", f.ws).eq("type", "refund").eq("parent_id", t.id).neq("status", "canceled");
    const already = (prev ?? []).reduce((s, r) => s + toCents(r.amount), 0);
    const available = toCents(t.amount) - already;
    if (f.amount > available) return { error: `O estorno não pode ultrapassar ${(available / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (valor ainda não estornado).` };
    const row: Record<string, unknown> = { workspace_id: f.ws, type: "refund", status: "paid", amount: db(f.amount), description: `Estorno: ${t.description}`.slice(0, 140), category_id: t.category_id, contact_id: t.contact_id, parent_id: t.id, date: f.date, tags: t.tags, created_by: (await sb.auth.getUser()).data.user!.id };
    if (t.card_id) {
      const card = check(await sb.from("credit_cards").select("closing_day").eq("id", t.card_id).single());
      const inv = invoiceMonthFor(f.date, card.closing_day);
      Object.assign(row, { card_id: t.card_id, account_id: null, invoice_month: inv, competence_date: inv, payment_method: "credit" });
    } else {
      Object.assign(row, { account_id: t.account_id, competence_date: f.date, paid_at: f.date, payment_method: t.payment_method });
    }
    check(await sb.from("transactions").insert(row));
    refresh(f.ws);
    return { ok: true, message: t.card_id ? "Estorno registrado como crédito na fatura." : "Estorno registrado. O valor voltou para a conta." };
  } catch (e) { return fail(e); }
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
