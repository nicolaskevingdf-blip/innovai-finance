"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { monthStart } from "@/lib/finance/dates";
import { check, db, fail, formObject, isoDate, money, optText, optUuid, positiveMoney, refresh, type ActionState } from "./_util";

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
