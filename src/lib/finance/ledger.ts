import { type ISODate } from "./dates";
import type { Account, Category, CategoryGroup, Tx } from "./types";

/** Efeito de uma movimentação no saldo de uma conta (centavos). Espelha a view SQL account_balances. */
export function balanceEffect(t: Tx, accountId: string): number {
  if (t.status !== "paid") return 0;
  switch (t.type) {
    case "income":
      return t.accountId === accountId ? t.amount : 0;
    case "expense":
      return t.accountId === accountId ? -t.amount : 0; // compras no cartão têm accountId nulo
    case "card_payment":
      return t.accountId === accountId ? -t.amount : 0;
    case "adjustment":
      return t.accountId === accountId ? t.amount : 0;
    case "transfer":
      return (t.accountId === accountId ? -t.amount : 0) + (t.toAccountId === accountId ? t.amount : 0);
  }
}

export function accountBalance(acc: Account, txs: Tx[], until?: ISODate): number {
  let b = acc.openingBalance;
  for (const t of txs) {
    if (until && (t.paidAt ?? t.date) > until) continue;
    b += balanceEffect(t, acc.id);
  }
  return b;
}

/** Receita/despesa "real" para relatórios: exclui transferências, ajustes e pagamentos de fatura. */
export const isReportable = (t: Tx) => (t.type === "income" || t.type === "expense") && t.status !== "canceled";

export interface PeriodSummary {
  income: number;
  expense: number;
  net: number;
  byCategory: Map<string | null, number>;
  count: number;
}

/**
 * Resumo por competência: compras no cartão contam no mês da fatura (competenceDate),
 * contas em conta contam pela data. Inclui pendentes quando includePending = true.
 */
export function summarize(txs: Tx[], from: ISODate, to: ISODate, opts: { includePending?: boolean; kind?: "income" | "expense" } = {}): PeriodSummary {
  const out: PeriodSummary = { income: 0, expense: 0, net: 0, byCategory: new Map(), count: 0 };
  for (const t of txs) {
    if (!isReportable(t)) continue;
    if (!opts.includePending && t.status !== "paid") continue;
    if (t.competenceDate < from || t.competenceDate > to) continue;
    if (opts.kind && t.type !== opts.kind) continue;
    if (t.type === "income") out.income += t.amount;
    else out.expense += t.amount;
    if (t.type === "expense" || opts.kind === "income") {
      out.byCategory.set(t.categoryId, (out.byCategory.get(t.categoryId) ?? 0) + t.amount);
    }
    out.count++;
  }
  out.net = out.income - out.expense;
  return out;
}

/** Totais por grupo gerencial (custos, despesas fixas, variáveis, investimentos, retiradas). */
export function totalsByGroup(txs: Tx[], categories: Map<string, Category>, from: ISODate, to: ISODate, includePending = true) {
  const g: Record<CategoryGroup | "uncategorized", number> = { revenue: 0, cost: 0, fixed: 0, variable: 0, investment: 0, withdrawal: 0, personal: 0, other: 0, uncategorized: 0 };
  for (const t of txs) {
    if (t.type !== "expense" || t.status === "canceled") continue;
    if (!includePending && t.status !== "paid") continue;
    if (t.competenceDate < from || t.competenceDate > to) continue;
    const c = t.categoryId ? categories.get(t.categoryId) : undefined;
    g[c?.grp ?? "uncategorized"] += t.amount;
  }
  return g;
}

/** Fluxo de caixa realizado: entradas e saídas que mexeram em saldo, por data de pagamento. */
export function cashMovements(txs: Tx[], from: ISODate, to: ISODate) {
  let inflow = 0, outflow = 0;
  for (const t of txs) {
    if (t.status !== "paid" || !t.paidAt || t.paidAt < from || t.paidAt > to) continue;
    if (t.type === "income" && t.accountId) inflow += t.amount;
    else if (t.type === "expense" && t.accountId) outflow += t.amount;
    else if (t.type === "card_payment") outflow += t.amount;
  }
  return { inflow, outflow, net: inflow - outflow };
}
