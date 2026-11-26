import { addDays, type ISODate } from "./dates";
import type { Tx } from "./types";

export type ObligationStatus = "pending" | "overdue" | "due_today" | "scheduled" | "partial" | "paid" | "canceled";

export const OBLIGATION_LABEL: Record<ObligationStatus, string> = {
  pending: "Pendente",
  overdue: "Vencida",
  due_today: "Vence hoje",
  scheduled: "Programada",
  partial: "Parcialmente paga",
  paid: "Paga",
  canceled: "Cancelada",
};

/**
 * Status de uma conta a pagar/receber.
 * - Pagamento parcial divide o lançamento: a parte paga vira um lançamento 'paid'
 *   e o saldo restante permanece 'pending' com parentId apontando para o original.
 * - "Programada" = pendente com vencimento futuro e tag "programada".
 */
export function obligationStatus(t: Pick<Tx, "status" | "dueDate" | "date" | "tags">, today: ISODate, hasPaidSiblings = false): ObligationStatus {
  if (t.status === "canceled") return "canceled";
  if (t.status === "paid") return "paid";
  const due = t.dueDate ?? t.date;
  if (due < today) return "overdue";
  if (due === today) return "due_today";
  if (hasPaidSiblings || t.tags.includes("parcial")) return "partial";
  if (t.tags.includes("programada")) return "scheduled";
  return "pending";
}

/** Calcula o efeito de um pagamento (parcial ou total) — validações determinísticas. */
export function planSettlement(openAmount: number, payAmount: number) {
  if (!Number.isInteger(payAmount) || payAmount <= 0) throw new Error("Valor do pagamento deve ser positivo");
  if (payAmount > openAmount) throw new Error("Pagamento maior que o valor em aberto");
  return { paid: payAmount, remaining: openAmount - payAmount, isPartial: payAmount < openAmount };
}

export interface ObligationTotals {
  open: number;
  overdue: number;
  dueToday: number;
  next7: number;
  next30: number;
  count: number;
}

export function obligationTotals(txs: Tx[], kind: "income" | "expense", today: ISODate): ObligationTotals {
  const r: ObligationTotals = { open: 0, overdue: 0, dueToday: 0, next7: 0, next30: 0, count: 0 };
  const d7 = addDays(today, 7), d30 = addDays(today, 30);
  for (const t of txs) {
    if (t.type !== kind || t.status !== "pending" || t.cardId) continue;
    const due = t.dueDate ?? t.date;
    r.open += t.amount;
    r.count++;
    if (due < today) r.overdue += t.amount;
    else if (due === today) r.dueToday += t.amount;
    if (due >= today && due <= d7) r.next7 += t.amount;
    if (due >= today && due <= d30) r.next30 += t.amount;
  }
  return r;
}
