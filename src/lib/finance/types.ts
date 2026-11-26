import type { ISODate } from "./dates";

/** refund = estorno: reduz despesa (em conta devolve saldo; no cartão abate a fatura). Nunca é receita. */
export type TxType = "income" | "expense" | "transfer" | "adjustment" | "card_payment" | "refund";
export type TxStatus = "pending" | "paid" | "canceled";
export type PaymentMethod = "cash" | "pix" | "debit" | "credit" | "boleto" | "transfer" | "app" | "other";
export type CategoryGroup = "revenue" | "cost" | "fixed" | "variable" | "investment" | "withdrawal" | "personal" | "other";

/** Forma normalizada de uma movimentação usada pelo motor financeiro (valores em centavos). */
export interface Tx {
  id: string;
  type: TxType;
  status: TxStatus;
  amount: number; // centavos; positivo exceto 'adjustment'
  description: string;
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  cardId: string | null;
  invoiceMonth: ISODate | null;
  contactId: string | null;
  date: ISODate;
  competenceDate: ISODate;
  dueDate: ISODate | null;
  paidAt: ISODate | null;
  paymentMethod: PaymentMethod | null;
  installmentGroup: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  parentId: string | null;
  tags: string[];
}

export interface Category {
  id: string;
  name: string;
  kind: "income" | "expense";
  grp: CategoryGroup;
  parentId: string | null;
  icon: string | null;
  color: string | null;
}

export interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "wallet" | "cash" | "digital" | "investment" | "other";
  openingBalance: number;
  archived: boolean;
  institution?: string | null;
}

export interface Card {
  id: string;
  name: string;
  bank: string | null;
  limit: number;
  closingDay: number;
  dueDay: number;
}
