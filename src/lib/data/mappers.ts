import { toCents } from "../finance/money";
import type { Account, Card, Category, Tx } from "../finance/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const mapTx = (r: any): Tx => ({
  id: r.id, type: r.type, status: r.status, amount: toCents(r.amount), description: r.description,
  categoryId: r.category_id, accountId: r.account_id, toAccountId: r.to_account_id, cardId: r.card_id,
  invoiceMonth: r.invoice_month, contactId: r.contact_id, date: r.date, competenceDate: r.competence_date,
  dueDate: r.due_date, paidAt: r.paid_at, paymentMethod: r.payment_method, installmentGroup: r.installment_group,
  installmentNumber: r.installment_number, installmentTotal: r.installment_total, parentId: r.parent_id, tags: r.tags ?? [],
});
export const mapAccount = (r: any): Account => ({ id: r.id, name: r.name, type: r.type, openingBalance: toCents(r.opening_balance), archived: r.archived });
export const mapCategory = (r: any): Category => ({ id: r.id, name: r.name, kind: r.kind, grp: r.grp, parentId: r.parent_id, icon: r.icon, color: r.color });
export const mapCard = (r: any): Card => ({ id: r.id, name: r.name, bank: r.bank, limit: toCents(r.limit_amount), closingDay: r.closing_day, dueDay: r.due_day });
