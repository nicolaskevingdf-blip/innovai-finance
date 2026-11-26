import "server-only";
import { createClient } from "../supabase/server";
import { isISODate } from "../finance/dates";
import { parseMoneyInput, toCents } from "../finance/money";

export interface TxFilters { q?: string; tipo?: string; categoria?: string; conta?: string; status?: string; de?: string; ate?: string; metodo?: string; min?: string; max?: string; contato?: string; cartao?: string; ordem?: string }

export interface TxRow {
  id: string; type: string; status: string; amount: number; description: string; date: string; dueDate: string | null; paidAt: string | null;
  competenceDate: string; categoryId: string | null; category: string | null; accountId: string | null; account: string | null; toAccount: string | null; cardId: string | null; card: string | null;
  invoiceMonth: string | null; contactId: string | null; contact: string | null; paymentMethod: string | null; notes: string | null; tags: string[];
  installment: string | null; installmentGroup: string | null; recurrenceId: string | null; parentId: string | null; source: string; attachments: { id: string; file_name: string; path: string }[];
}

const UUID = /^[0-9a-f-]{36}$/;

/** Consulta filtrada de movimentações. Filtros são validados antes de chegar ao banco. */
export async function queryTransactions(wsId: string, f: TxFilters, limit = 300) {
  const sb = await createClient();
  let q = sb.from("transactions")
    .select("*, categories(name), account:financial_accounts!transactions_account_id_fkey(name), to_account:financial_accounts!transactions_to_account_id_fkey(name), credit_cards(name), contacts(name), attachments(id,file_name,path)", { count: "exact" })
    .eq("workspace_id", wsId);
  if (f.q?.trim()) q = q.ilike("description", `%${f.q.trim().replace(/[%_,()]/g, " ").slice(0, 60)}%`);
  if (f.tipo && ["income", "expense", "transfer", "adjustment", "card_payment"].includes(f.tipo)) q = q.eq("type", f.tipo);
  if (f.status === "overdue") q = q.eq("status", "pending").lt("due_date", new Date().toISOString().slice(0, 10));
  else if (f.status && ["pending", "paid", "canceled"].includes(f.status)) q = q.eq("status", f.status);
  if (f.categoria && UUID.test(f.categoria)) {
    // inclui subcategorias
    const { data: kids } = await sb.from("categories").select("id").eq("workspace_id", wsId).eq("parent_id", f.categoria);
    q = q.in("category_id", [f.categoria, ...(kids ?? []).map((k) => k.id)]);
  }
  if (f.conta && UUID.test(f.conta)) q = q.or(`account_id.eq.${f.conta},to_account_id.eq.${f.conta}`);
  if (f.cartao && UUID.test(f.cartao)) q = q.eq("card_id", f.cartao);
  if (f.contato && UUID.test(f.contato)) q = q.eq("contact_id", f.contato);
  if (f.metodo && /^[a-z]+$/.test(f.metodo)) q = q.eq("payment_method", f.metodo);
  const dateCol = f.status === "pending" || f.status === "overdue" ? "due_date" : "date";
  if (f.de && isISODate(f.de)) q = q.gte(dateCol, f.de);
  if (f.ate && isISODate(f.ate)) q = q.lte(dateCol, f.ate);
  const min = f.min ? parseMoneyInput(f.min) : null, max = f.max ? parseMoneyInput(f.max) : null;
  if (min !== null) q = q.gte("amount", (min / 100).toFixed(2));
  if (max !== null) q = q.lte("amount", (max / 100).toFixed(2));
  q = dateCol === "due_date" ? q.order("due_date", { ascending: true }) : q.order("date", { ascending: false }).order("created_at", { ascending: false });
  const { data, count, error } = await q.limit(limit);
  if (error) throw new Error(error.message);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const rows: TxRow[] = (data ?? []).map((r: any) => ({
    id: r.id, type: r.type, status: r.status, amount: toCents(r.amount), description: r.description, date: r.date, dueDate: r.due_date, paidAt: r.paid_at, competenceDate: r.competence_date,
    categoryId: r.category_id, category: r.categories?.name ?? null, accountId: r.account_id, account: r.account?.name ?? null, toAccount: r.to_account?.name ?? null,
    cardId: r.card_id, card: r.credit_cards?.name ?? null, invoiceMonth: r.invoice_month, contactId: r.contact_id, contact: r.contacts?.name ?? null, paymentMethod: r.payment_method,
    notes: r.notes, tags: r.tags ?? [], installment: r.installment_total ? `${r.installment_number}/${r.installment_total}` : null, installmentGroup: r.installment_group,
    recurrenceId: r.recurrence_id, parentId: r.parent_id, source: r.source, attachments: r.attachments ?? [],
  }));
  return { rows, total: count ?? rows.length };
}
