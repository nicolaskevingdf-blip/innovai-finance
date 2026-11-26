import { addDays, addMonths, monthEnd, monthStart, type ISODate } from "./dates";
import { accountBalance, cashMovements, summarize, totalsByGroup } from "./ledger";
import { buildInvoices } from "./cards";
import { obligationTotals } from "./obligations";
import type { Account, Card, Category, Tx } from "./types";

const BANK_TYPES = new Set(["checking", "savings", "digital"]);

export interface PersonalSnapshot {
  /** Soma de todas as contas ativas (inclui carteira, dinheiro, investimentos). */
  totalBalance: number;
  /** Apenas contas bancárias (corrente, poupança, digital). */
  bankBalance: number;
  balances: { account: Account; balance: number }[];
  monthIncome: number;
  monthExpense: number;
  monthNet: number;
  /** Despesas pendentes + faturas em aberto com vencimento até o fim do mês (inclui vencidas). */
  committed: number;
  /** Receitas pendentes previstas até o fim do mês. */
  expectedIncome: number;
  /** Saldo total + receitas previstas − compromissos, no fim do mês. */
  forecastBalance: number;
  /** Saldo total − compromissos (não conta com receitas ainda não recebidas). */
  availableEstimate: number;
  upcoming: { date: ISODate; label: string; amount: number; kind: "bill" | "card" | "income"; overdue: boolean }[];
}

export function personalSnapshot(p: { accounts: Account[]; txs: Tx[]; cards: Card[]; today: ISODate; balances?: Map<string, number> }): PersonalSnapshot {
  const active = p.accounts.filter((a) => !a.archived);
  const balances = active.map((account) => ({ account, balance: p.balances?.get(account.id) ?? accountBalance(account, p.txs) }));
  const totalBalance = balances.reduce((s, b) => s + b.balance, 0);
  const bankBalance = balances.filter((b) => BANK_TYPES.has(b.account.type)).reduce((s, b) => s + b.balance, 0);
  const ms = monthStart(p.today), me = monthEnd(p.today);
  const month = summarize(p.txs, ms, me);
  let committed = 0, expectedIncome = 0;
  const upcoming: PersonalSnapshot["upcoming"] = [];
  const horizon = addDays(p.today, 15);
  for (const t of p.txs) {
    if (t.status !== "pending" || t.cardId) continue;
    const due = t.dueDate ?? t.date;
    if (t.type === "expense" && due <= me) committed += t.amount;
    if (t.type === "income" && due <= me) expectedIncome += t.amount;
    if ((t.type === "expense" || t.type === "income") && due <= horizon)
      upcoming.push({ date: due, label: t.description, amount: t.amount, kind: t.type === "income" ? "income" : "bill", overdue: due < p.today });
  }
  for (const card of p.cards) {
    for (const inv of buildInvoices(card, p.txs, p.today)) {
      if (inv.remaining <= 0) continue;
      if (inv.dueDate <= me) committed += inv.remaining;
      if (inv.dueDate <= horizon) upcoming.push({ date: inv.dueDate, label: `Fatura ${card.name}`, amount: inv.remaining, kind: "card", overdue: inv.dueDate < p.today });
    }
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  return {
    totalBalance, bankBalance, balances,
    monthIncome: month.income, monthExpense: month.expense, monthNet: month.net,
    committed, expectedIncome,
    forecastBalance: totalBalance + expectedIncome - committed,
    availableEstimate: totalBalance - committed,
    upcoming,
  };
}

export interface BusinessSnapshot {
  balance: number;
  /** Vendas/serviços registrados no período (competência), recebidos ou não. */
  revenue: number;
  /** Valores efetivamente recebidos no período. */
  received: number;
  /** Valores efetivamente pagos no período (inclui faturas). */
  paidOut: number;
  costs: number;
  expenses: number;
  investments: number;
  withdrawals: number;
  /** Faturamento − custos − despesas (competência). Exclui retiradas e investimentos. */
  estimatedResult: number;
  /** Recebido − pago no período (regime de caixa). */
  cashResult: number;
  payables: ReturnType<typeof obligationTotals>;
  receivables: ReturnType<typeof obligationTotals>;
  /** Saldo + a receber em 30 dias − a pagar em 30 dias (inclui vencidos). */
  workingCapital30: number;
  prev: { revenue: number; expenses: number; estimatedResult: number };
}

export function businessSnapshot(p: { accounts: Account[]; txs: Tx[]; categories: Category[]; today: ISODate; from?: ISODate; to?: ISODate; balances?: Map<string, number> }): BusinessSnapshot {
  const from = p.from ?? monthStart(p.today), to = p.to ?? monthEnd(p.today);
  const cats = new Map(p.categories.map((c) => [c.id, c]));
  const balance = p.accounts.filter((a) => !a.archived).reduce((s, a) => s + (p.balances?.get(a.id) ?? accountBalance(a, p.txs)), 0);
  const calc = (f: ISODate, t: ISODate) => {
    const s = summarize(p.txs, f, t, { includePending: true });
    const g = totalsByGroup(p.txs, cats, f, t, true);
    const expenses = g.fixed + g.variable + g.other + g.personal + g.uncategorized;
    return { revenue: s.income, costs: g.cost, expenses, investments: g.investment, withdrawals: g.withdrawal, estimatedResult: s.income - g.cost - expenses };
  };
  const cur = calc(from, to);
  const prevFrom = addMonths(from, -1), prevTo = monthEnd(prevFrom);
  const prev = calc(prevFrom, prevTo);
  const cash = cashMovements(p.txs, from, to);
  const payables = obligationTotals(p.txs, "expense", p.today);
  const receivables = obligationTotals(p.txs, "income", p.today);
  return {
    balance, ...cur, received: cash.inflow, paidOut: cash.outflow, cashResult: cash.net,
    payables, receivables,
    workingCapital30: balance + receivables.next30 + receivables.overdue - payables.next30 - payables.overdue,
    prev: { revenue: prev.revenue, expenses: prev.costs + prev.expenses, estimatedResult: prev.estimatedResult },
  };
}
