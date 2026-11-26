import "server-only";
import { cache } from "react";
import { createClient } from "../supabase/server";
import { addMonths, monthStart, todayISO } from "../finance/dates";
import { toCents } from "../finance/money";
import { mapAccount, mapCard, mapCategory, mapTx } from "./mappers";
import type { Tx } from "../finance/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Busca paginada (PostgREST limita linhas por resposta). */
async function fetchAll(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>, page = 1000, max = 50000) {
  const rows: any[] = [];
  for (let from = 0; from < max; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return rows;
}

const TX_COLS = "id,type,status,amount,description,category_id,account_id,to_account_id,card_id,invoice_month,contact_id,date,competence_date,due_date,paid_at,payment_method,installment_group,installment_number,installment_total,parent_id,tags";

/**
 * Carrega o "livro" do ambiente para o motor financeiro:
 *  - movimentações dos últimos `months` meses (por competência ou pagamento)
 *  - TODAS as pendências (para compromissos/projeções)
 *  - TODAS as linhas de cartão não pagas integralmente (para limites e faturas)
 * Saldos vêm da view SQL (histórico completo).
 */
export const loadLedger = cache(async (wsId: string, months = 13) => {
  const sb = await createClient();
  const today = todayISO();
  const since = addMonths(monthStart(today), -months);
  const [accounts, categories, cards, recent, pending, cardRows, balances] = await Promise.all([
    sb.from("financial_accounts").select("*").eq("workspace_id", wsId).order("created_at"),
    sb.from("categories").select("*").eq("workspace_id", wsId).eq("archived", false).order("name"),
    sb.from("credit_cards").select("*").eq("workspace_id", wsId).eq("archived", false).order("created_at"),
    fetchAll((f, t) => sb.from("transactions").select(TX_COLS).eq("workspace_id", wsId).gte("competence_date", since).order("id").range(f, t)),
    fetchAll((f, t) => sb.from("transactions").select(TX_COLS).eq("workspace_id", wsId).eq("status", "pending").order("id").range(f, t)),
    fetchAll((f, t) => sb.from("transactions").select(TX_COLS).eq("workspace_id", wsId).not("card_id", "is", null).gte("invoice_month", addMonths(since, -24)).order("id").range(f, t)),
    sb.from("account_balances").select("account_id, balance").eq("workspace_id", wsId),
  ]);
  const byId = new Map<string, Tx>();
  for (const r of [...recent, ...pending, ...cardRows]) byId.set(r.id, mapTx(r));
  return {
    today,
    since,
    accounts: (accounts.data ?? []).map(mapAccount),
    categories: (categories.data ?? []).map(mapCategory),
    cards: (cards.data ?? []).map(mapCard),
    txs: [...byId.values()],
    balances: new Map((balances.data ?? []).map((b) => [b.account_id as string, toCents(b.balance)])),
  };
});

export type Ledger = Awaited<ReturnType<typeof loadLedger>>;
