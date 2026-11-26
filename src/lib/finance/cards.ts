import { addMonths, iso, monthStart, parts, type ISODate } from "./dates";
import type { Card, Tx } from "./types";

/**
 * Fatura a que pertence uma compra. Convenção: a fatura do mês M fecha no dia
 * `closingDay` de M. Compras feitas a partir do dia de fechamento entram na
 * fatura seguinte. Retorna o 1º dia do mês da fatura.
 */
export function invoiceMonthFor(purchase: ISODate, closingDay: number): ISODate {
  const { y, m, d } = parts(purchase);
  return d >= closingDay ? iso(y, m + 1, 1) : iso(y, m, 1);
}

/** Data de fechamento da fatura do mês informado. */
export function invoiceClosingDate(invoiceMonth: ISODate, closingDay: number): ISODate {
  const { y, m } = parts(invoiceMonth);
  return iso(y, m, closingDay);
}

/** Vencimento: se o dia de vencimento for depois do fechamento, vence no mesmo mês; senão, no mês seguinte. */
export function invoiceDueDate(invoiceMonth: ISODate, closingDay: number, dueDay: number): ISODate {
  const { y, m } = parts(invoiceMonth);
  return dueDay > closingDay ? iso(y, m, dueDay) : iso(y, m + 1, dueDay);
}

/** Divide o total em N parcelas; a diferença de centavos fica na primeira parcela. */
export function splitInstallments(totalCents: number, n: number): number[] {
  if (!Number.isInteger(n) || n < 1) throw new Error("Número de parcelas inválido");
  if (totalCents <= 0) throw new Error("Valor deve ser positivo");
  const base = Math.floor(totalCents / n);
  const rest = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + rest : base));
}

export interface InstallmentPlanItem {
  number: number;
  total: number;
  amount: number;
  invoiceMonth: ISODate;
  /** Data de referência da parcela (data da compra deslocada mês a mês). */
  date: ISODate;
}

export function planCardPurchase(params: { purchaseDate: ISODate; totalCents: number; installments: number; closingDay: number }): InstallmentPlanItem[] {
  const first = invoiceMonthFor(params.purchaseDate, params.closingDay);
  return splitInstallments(params.totalCents, params.installments).map((amount, i) => ({
    number: i + 1,
    total: params.installments,
    amount,
    invoiceMonth: addMonths(first, i),
    date: addMonths(params.purchaseDate, i),
  }));
}

export type InvoiceStatus = "open" | "closed" | "paid" | "partial" | "overdue" | "future";

export interface Invoice {
  month: ISODate;
  closingDate: ISODate;
  dueDate: ISODate;
  total: number;
  paid: number;
  remaining: number;
  status: InvoiceStatus;
  items: Tx[];
}

/** Monta as faturas de um cartão a partir das compras (expense com cardId) e pagamentos (card_payment). */
export function buildInvoices(card: Card, txs: Tx[], today: ISODate): Invoice[] {
  const byMonth = new Map<string, Invoice>();
  const get = (month: ISODate) => {
    let inv = byMonth.get(month);
    if (!inv) {
      inv = { month, closingDate: invoiceClosingDate(month, card.closingDay), dueDate: invoiceDueDate(month, card.closingDay, card.dueDay), total: 0, paid: 0, remaining: 0, status: "open", items: [] };
      byMonth.set(month, inv);
    }
    return inv;
  };
  for (const t of txs) {
    if (t.cardId !== card.id || t.status === "canceled" || !t.invoiceMonth) continue;
    if (t.type === "expense") {
      const inv = get(t.invoiceMonth);
      inv.total += t.amount;
      inv.items.push(t);
    } else if (t.type === "card_payment" && t.status === "paid") {
      get(t.invoiceMonth).paid += t.amount;
    } else if (t.type === "income") {
      // estornos não são permitidos como 'income' em cartão (constraint), ignorado
    }
  }
  const currentOpen = invoiceMonthFor(today, card.closingDay);
  for (const inv of byMonth.values()) {
    inv.remaining = Math.max(0, inv.total - inv.paid);
    if (inv.total > 0 && inv.remaining === 0) inv.status = "paid";
    else if (inv.month > currentOpen) inv.status = "future";
    else if (inv.month === currentOpen) inv.status = "open";
    else if (today > inv.dueDate) inv.status = inv.paid > 0 ? "partial" : "overdue";
    else inv.status = inv.paid > 0 ? "partial" : "closed";
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Limite: comprometido = todas as compras não canceladas − pagamentos realizados. */
export function cardLimit(card: Card, txs: Tx[]) {
  let purchases = 0, payments = 0;
  for (const t of txs) {
    if (t.cardId !== card.id || t.status === "canceled") continue;
    if (t.type === "expense") purchases += t.amount;
    if (t.type === "card_payment" && t.status === "paid") payments += t.amount;
  }
  const used = Math.max(0, purchases - payments);
  return { limit: card.limit, used, available: card.limit - used, usagePct: card.limit ? (used / card.limit) * 100 : 0 };
}

export const currentInvoiceMonth = (card: Card, today: ISODate) => invoiceMonthFor(today, card.closingDay);
export { monthStart };
