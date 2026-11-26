import { describe, expect, it } from "vitest";
import { addMonths, fmtDateTime, monthEnd, todayISO, weekStart, isISODate } from "../dates";
import { parseMoneyInput, toCents, formatBRL } from "../money";
import { buildInvoices, cardLimit, invoiceDueDate, invoiceMonthFor, planCardPurchase, splitInstallments } from "../cards";
import { accountBalance, cashMovements, summarize } from "../ledger";
import { obligationStatus, obligationTotals, planSettlement } from "../obligations";
import { forecastItems, projectCashflow } from "../cashflow";
import { budgetUsage, goalProjection, monthsToPayoff, payoffOrder } from "../planning";
import { businessSnapshot, personalSnapshot } from "../snapshot";
import { generateInsights } from "../insights";
import { matchCategory, parseEntryText } from "../parser";
import type { Account, Card, Category, Tx } from "../types";

let seq = 0;
const tx = (p: Partial<Tx>): Tx => ({
  id: `t${++seq}`, type: "expense", status: "paid", amount: 1000, description: "x", categoryId: null, accountId: "a1", toAccountId: null,
  cardId: null, invoiceMonth: null, contactId: null, date: "2026-11-10", competenceDate: p.date ?? "2026-11-10", dueDate: null,
  paidAt: p.status === "pending" ? null : p.date ?? "2026-11-10", paymentMethod: null, installmentGroup: null, installmentNumber: null,
  installmentTotal: null, parentId: null, tags: [], ...p,
});
const acc: Account = { id: "a1", name: "Banco", type: "checking", openingBalance: 100000, archived: false };
const acc2: Account = { id: "a2", name: "Carteira", type: "wallet", openingBalance: 0, archived: false };
const card: Card = { id: "c1", name: "Visa", bank: null, limit: 500000, closingDay: 5, dueDay: 12 };

describe("datas", () => {
  it("addMonths preserva fim de mês", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonths("2026-03-10", -4)).toBe("2025-11-10");
  });
  it("monthEnd e weekStart", () => {
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
    expect(weekStart("2026-11-29")).toBe("2026-11-23"); // domingo -> segunda anterior
    expect(isISODate("2026-02-30")).toBe(false);
  });
});

describe("dinheiro", () => {
  it("converte entradas brasileiras", () => {
    expect(parseMoneyInput("1.234,56")).toBe(123456);
    expect(parseMoneyInput("R$ 85")).toBe(8500);
    expect(parseMoneyInput("85,9")).toBe(8590);
    expect(parseMoneyInput("abc")).toBeNull();
    expect(toCents("0.1") + toCents("0.2")).toBe(30);
    expect(formatBRL(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });
});

describe("cartão de crédito", () => {
  it("define a fatura pela data de fechamento", () => {
    expect(invoiceMonthFor("2026-11-04", 5)).toBe("2026-11-01");
    expect(invoiceMonthFor("2026-11-05", 5)).toBe("2026-12-01");
    expect(invoiceMonthFor("2026-12-20", 5)).toBe("2027-01-01");
  });
  it("vencimento antes do fechamento cai no mês seguinte", () => {
    expect(invoiceDueDate("2026-11-01", 5, 12)).toBe("2026-11-12");
    expect(invoiceDueDate("2026-11-01", 25, 5)).toBe("2026-12-05");
  });
  it("parcelas somam exatamente o total", () => {
    const p = splitInstallments(10000, 3);
    expect(p).toEqual([3334, 3333, 3333]);
    expect(p.reduce((a, b) => a + b)).toBe(10000);
    expect(() => splitInstallments(100, 0)).toThrow();
  });
  it("gera parcelas em faturas consecutivas", () => {
    const plan = planCardPurchase({ purchaseDate: "2026-11-20", totalCents: 120000, installments: 12, closingDay: 5 });
    expect(plan[0].invoiceMonth).toBe("2026-12-01");
    expect(plan[11].invoiceMonth).toBe("2027-11-01");
    expect(plan.every((x) => x.amount === 10000)).toBe(true);
  });
  it("não duplica: compra no cartão não mexe no saldo; pagamento da fatura sim, e não é despesa", () => {
    const purchase = tx({ cardId: "c1", accountId: null, invoiceMonth: "2026-12-01", competenceDate: "2026-12-01", amount: 30000 });
    const payment = tx({ type: "card_payment", cardId: "c1", invoiceMonth: "2026-12-01", amount: 30000, date: "2026-12-12", competenceDate: "2026-12-12" });
    const txs = [purchase, payment];
    expect(accountBalance(acc, txs)).toBe(100000 - 30000);
    const dec = summarize(txs, "2026-12-01", "2026-12-31");
    expect(dec.expense).toBe(30000); // apenas a compra, uma vez
    const inv = buildInvoices(card, txs, "2026-12-13");
    expect(inv[0]).toMatchObject({ total: 30000, paid: 30000, remaining: 0, status: "paid" });
    expect(cardLimit(card, txs).used).toBe(0);
  });
  it("limite considera parcelas futuras", () => {
    const plan = planCardPurchase({ purchaseDate: "2026-11-20", totalCents: 60000, installments: 6, closingDay: 5 });
    const txs = plan.map((p) => tx({ cardId: "c1", accountId: null, invoiceMonth: p.invoiceMonth, competenceDate: p.invoiceMonth, amount: p.amount }));
    const l = cardLimit(card, txs);
    expect(l.used).toBe(60000);
    expect(l.available).toBe(440000);
    const invs = buildInvoices(card, txs, "2026-11-21");
    expect(invs).toHaveLength(6);
    expect(invs[0].status).toBe("open");
    expect(invs[1].status).toBe("future");
  });
  it("fatura vencida sem pagamento", () => {
    const t = tx({ cardId: "c1", accountId: null, invoiceMonth: "2026-10-01", competenceDate: "2026-10-01", amount: 5000 });
    expect(buildInvoices(card, [t], "2026-10-20")[0].status).toBe("overdue");
    expect(buildInvoices(card, [t], "2026-10-08")[0].status).toBe("closed");
  });
});

describe("saldos e transferências", () => {
  it("transferência não é receita nem despesa e não duplica saldo", () => {
    const txs = [
      tx({ type: "income", amount: 50000 }),
      tx({ type: "transfer", accountId: "a1", toAccountId: "a2", amount: 20000 }),
      tx({ type: "expense", amount: 5000, status: "pending" }),
      tx({ type: "adjustment", amount: -1000 }),
    ];
    expect(accountBalance(acc, txs)).toBe(100000 + 50000 - 20000 - 1000);
    expect(accountBalance(acc2, txs)).toBe(20000);
    const s = summarize(txs, "2026-11-01", "2026-11-30");
    expect(s.income).toBe(50000);
    expect(s.expense).toBe(0);
    expect(summarize(txs, "2026-11-01", "2026-11-30", { includePending: true }).expense).toBe(5000);
  });
  it("movimentos de caixa por data de pagamento", () => {
    const txs = [tx({ type: "income", amount: 1000, date: "2026-11-02" }), tx({ type: "income", amount: 999, status: "pending", date: "2026-11-03" })];
    expect(cashMovements(txs, "2026-11-01", "2026-11-30")).toEqual({ inflow: 1000, outflow: 0, net: 1000 });
  });
});

describe("contas a pagar/receber", () => {
  it("status por vencimento", () => {
    const t = tx({ status: "pending", dueDate: "2026-11-10" });
    expect(obligationStatus(t, "2026-11-11")).toBe("overdue");
    expect(obligationStatus(t, "2026-11-10")).toBe("due_today");
    expect(obligationStatus(t, "2026-11-01")).toBe("pending");
    expect(obligationStatus(t, "2026-11-01", true)).toBe("partial");
  });
  it("pagamento parcial", () => {
    expect(planSettlement(10000, 4000)).toEqual({ paid: 4000, remaining: 6000, isPartial: true });
    expect(() => planSettlement(10000, 10001)).toThrow();
    expect(() => planSettlement(10000, 0)).toThrow();
  });
  it("totais", () => {
    const txs = [tx({ status: "pending", dueDate: "2026-11-01", amount: 100 }), tx({ status: "pending", dueDate: "2026-11-15", amount: 200 }), tx({ status: "pending", dueDate: "2027-01-15", amount: 400 })];
    const r = obligationTotals(txs, "expense", "2026-11-10");
    expect(r).toMatchObject({ open: 700, overdue: 100, next7: 200, next30: 200, count: 3 });
  });
});

describe("fluxo de caixa", () => {
  it("projeta com dados cadastrados e identifica risco", () => {
    const txs = [
      tx({ type: "expense", status: "pending", dueDate: "2026-11-12", amount: 80000 }),
      tx({ type: "income", status: "pending", dueDate: "2026-11-20", amount: 50000 }),
      tx({ type: "expense", status: "pending", dueDate: "2026-11-01", amount: 1000 }), // vencida => hoje
      tx({ cardId: "c1", accountId: null, invoiceMonth: "2026-12-01", competenceDate: "2026-12-01", amount: 10000 }),
    ];
    const items = forecastItems(txs, [card], "2026-11-10", "2026-12-31");
    expect(items.map((i) => i.amount)).toEqual([-1000, -80000, 50000, -10000]);
    expect(items[0].overdue).toBe(true);
    const r = projectCashflow({ startBalance: 100000, items, from: "2026-11-10", to: "2026-12-31", granularity: "month", minCash: 30000 });
    expect(r.buckets).toHaveLength(2);
    expect(r.buckets[0]).toMatchObject({ opening: 100000, inflow: 50000, outflow: 81000, closing: 69000 });
    expect(r.lowest).toEqual({ date: "2026-11-12", balance: 19000 });
    expect(r.riskStart).toBe("2026-11-12");
    expect(r.buckets[1].closing).toBe(59000);
  });
});

describe("planejamento, metas e dívidas", () => {
  it("níveis de orçamento", () => {
    expect(budgetUsage(4000, 10000).level).toBe("ok");
    expect(budgetUsage(5000, 10000).level).toBe("info");
    expect(budgetUsage(8500, 10000).level).toBe("attention");
    expect(budgetUsage(9000, 10000).level).toBe("high");
    expect(budgetUsage(10001, 10000).level).toBe("over");
    expect(budgetUsage(6000, 10000, [60, 80, 95]).level).toBe("info");
  });
  it("projeção de meta", () => {
    const p = goalProjection({ target: 1200000, contributions: [{ amount: 100000, date: "2026-09-05" }, { amount: 100000, date: "2026-10-05" }, { amount: 100000, date: "2026-11-05" }], targetDate: "2027-11-26", today: "2026-11-26" });
    expect(p.saved).toBe(300000);
    expect(p.monthsLeft).toBe(12);
    expect(p.monthlyNeeded).toBe(75000);
    expect(p.avgMonthlyContribution).toBe(100000);
    expect(p.onTrack).toBe(true);
    expect(p.projectedDate).toBe("2027-08-26");
  });
  it("quitação", () => {
    expect(monthsToPayoff(100000, 10000, null)).toBe(10);
    expect(monthsToPayoff(100000, 1000, 2)).toBeNull(); // parcela não cobre juros
    expect(monthsToPayoff(100000, 10000, 2)).toBe(12);
    const order = payoffOrder([{ id: "a", creditor: "A", total: 1000, paid: 0, monthlyRate: 2, installment: null }, { id: "b", creditor: "B", total: 500, paid: 0, monthlyRate: 8, installment: null }], "avalanche");
    expect(order[0].id).toBe("b");
  });
});

describe("snapshots", () => {
  it("pessoal diferencia saldo, comprometido e disponível", () => {
    const txs = [
      tx({ type: "income", amount: 300000, date: "2026-11-05" }),
      tx({ type: "expense", amount: 50000, status: "pending", dueDate: "2026-11-28" }),
      tx({ type: "income", amount: 20000, status: "pending", dueDate: "2026-11-29" }),
      tx({ cardId: "c1", accountId: null, invoiceMonth: "2026-11-01", competenceDate: "2026-11-01", amount: 7000 }),
    ];
    const s = personalSnapshot({ accounts: [acc, acc2], txs, cards: [card], today: "2026-11-10" });
    expect(s.totalBalance).toBe(400000);
    expect(s.bankBalance).toBe(400000);
    expect(s.committed).toBe(57000); // conta pendente + fatura (vence 12/11)
    expect(s.availableEstimate).toBe(343000);
    expect(s.forecastBalance).toBe(363000);
    expect(s.monthExpense).toBe(7000);
  });
  it("empresarial separa faturamento, recebido, custos, retiradas", () => {
    const cats: Category[] = [
      { id: "rev", name: "Vendas", kind: "income", grp: "revenue", parentId: null, icon: null, color: null },
      { id: "cmv", name: "Mercadorias", kind: "expense", grp: "cost", parentId: null, icon: null, color: null },
      { id: "alug", name: "Aluguel", kind: "expense", grp: "fixed", parentId: null, icon: null, color: null },
      { id: "ret", name: "Retirada", kind: "expense", grp: "withdrawal", parentId: null, icon: null, color: null },
    ];
    const txs = [
      tx({ type: "income", categoryId: "rev", amount: 100000 }),
      tx({ type: "income", categoryId: "rev", amount: 50000, status: "pending", dueDate: "2026-11-25" }),
      tx({ categoryId: "cmv", amount: 40000 }),
      tx({ categoryId: "alug", amount: 20000 }),
      tx({ categoryId: "ret", amount: 30000 }),
    ];
    const b = businessSnapshot({ accounts: [acc], txs, categories: cats, today: "2026-11-15" });
    expect(b.revenue).toBe(150000);
    expect(b.received).toBe(100000);
    expect(b.costs).toBe(40000);
    expect(b.expenses).toBe(20000);
    expect(b.withdrawals).toBe(30000);
    expect(b.estimatedResult).toBe(90000);
    expect(b.cashResult).toBe(100000 - 90000);
    expect(b.balance).toBe(100000 + 100000 - 90000);
  });
});

describe("insights", () => {
  it("gera alertas apenas a partir de dados reais", () => {
    const cats: Category[] = [{ id: "lazer", name: "Lazer", kind: "expense", grp: "variable", parentId: null, icon: null, color: null }];
    const txs = [tx({ categoryId: "lazer", amount: 8500, date: "2026-11-03" })];
    const ins = generateInsights({ kind: "personal", basePath: "/w/x", today: "2026-11-10", txs, categories: cats, budgets: [{ categoryId: "lazer", amount: 10000 }], goals: [], balance: 100000 });
    expect(ins.find((i) => i.key.startsWith("budget:"))?.title).toContain("85%");
    expect(ins.some((i) => i.area === "dados")).toBe(true);
    const none = generateInsights({ kind: "personal", basePath: "/w/x", today: "2026-11-10", txs: [], categories: [], budgets: [], goals: [], balance: 0 });
    expect(none.every((i) => i.area === "dados")).toBe(true);
  });
});

describe("parser de texto", () => {
  const today = "2026-11-26";
  it("exemplo do briefing", () => {
    const p = parseEntryText("Gastei 85 reais abastecendo minha moto hoje.", today);
    expect(p).toMatchObject({ type: "expense", amount: 8500, date: today, categoryHint: "Combustível", description: "Abastecimento da moto", confidence: "high" });
  });
  it("receitas, datas e parcelas", () => {
    expect(parseEntryText("recebi 1.250,50 de salário ontem", today)).toMatchObject({ type: "income", amount: 125050, date: "2026-11-25", categoryHint: "Salário" });
    expect(parseEntryText("comprei um tênis de 600 em 3x no crédito", today)).toMatchObject({ type: "expense", amount: 60000, installments: 3, paymentMethod: "credit", categoryHint: "Compras" });
    expect(parseEntryText("paguei a internet dia 10", today)).toMatchObject({ date: "2026-11-10", categoryHint: "Contas", missing: ["amount"] });
    expect(parseEntryText("vendi 2 mil no pix", today)).toMatchObject({ type: "income", amount: 200000, paymentMethod: "pix" });
    expect(parseEntryText("paguei 1.450 de aluguel dia 10", today)).toMatchObject({ amount: 145000, date: "2026-11-10", description: "Aluguel" });
    expect(parseEntryText("recebi 5200 de salário dia 5", today).description).toBe("Salário");
  });
  it("associa categoria existente", () => {
    const cats = [{ id: "1", name: "Combustivel", kind: "expense" }, { id: "2", name: "Lazer", kind: "expense" }];
    expect(matchCategory("Combustível", "expense", cats)?.id).toBe("1");
  });
});

describe("estornos", () => {
  it("estorno no cartão abate fatura e libera limite, sem mexer no saldo bancário", () => {
    const compra = tx({ cardId: "c1", accountId: null, invoiceMonth: "2026-12-01", competenceDate: "2026-12-01", amount: 50000, categoryId: "roupa" });
    const estorno = tx({ type: "refund", cardId: "c1", accountId: null, invoiceMonth: "2026-12-01", competenceDate: "2026-12-01", amount: 20000, categoryId: "roupa", parentId: compra.id });
    const txs = [compra, estorno];
    expect(accountBalance(acc, txs)).toBe(100000);
    const inv = buildInvoices(card, txs, "2026-11-20");
    expect(inv[0].total).toBe(30000);
    expect(cardLimit(card, txs).used).toBe(30000);
    const s = summarize(txs, "2026-12-01", "2026-12-31");
    expect(s.income).toBe(0); // estorno nunca vira receita
    expect(s.expense).toBe(30000);
    expect(s.byCategory.get("roupa")).toBe(30000);
  });
  it("estorno em conta devolve saldo e reduz a despesa da categoria", () => {
    const compra = tx({ amount: 10000, categoryId: "merc", date: "2026-11-05" });
    const estorno = tx({ type: "refund", amount: 4000, categoryId: "merc", date: "2026-11-07" });
    const txs = [compra, estorno];
    expect(accountBalance(acc, txs)).toBe(100000 - 10000 + 4000);
    const s = summarize(txs, "2026-11-01", "2026-11-30");
    expect(s).toMatchObject({ income: 0, expense: 6000 });
    expect(cashMovements(txs, "2026-11-01", "2026-11-30")).toEqual({ inflow: 0, outflow: 6000, net: -6000 });
  });
  it("estorno total zera a fatura e conta como paga", () => {
    const compra = tx({ cardId: "c1", accountId: null, invoiceMonth: "2026-12-01", competenceDate: "2026-12-01", amount: 9900 });
    const estorno = tx({ type: "refund", cardId: "c1", accountId: null, invoiceMonth: "2026-12-01", competenceDate: "2026-12-01", amount: 9900 });
    const inv = buildInvoices(card, [compra, estorno], "2026-11-20")[0];
    expect(inv.total).toBe(0);
    expect(inv.remaining).toBe(0);
  });
  it("estorno entra nos grupos gerenciais (resultado empresarial)", () => {
    const cats: Category[] = [{ id: "ins", name: "Insumos", kind: "expense", grp: "cost", parentId: null, icon: null, color: null }];
    const txs = [tx({ categoryId: "ins", amount: 30000 }), tx({ type: "refund", categoryId: "ins", amount: 5000 })];
    const b = businessSnapshot({ accounts: [acc], txs, categories: cats, today: "2026-11-15" });
    expect(b.costs).toBe(25000);
    expect(b.revenue).toBe(0);
  });
});

describe("integridade de cálculo", () => {
  it("editar/excluir: o saldo é sempre recalculado a partir dos lançamentos (sem saldo acumulado armazenado)", () => {
    const a = tx({ type: "income", amount: 5000 }), b2 = tx({ amount: 2000 });
    expect(accountBalance(acc, [a, b2])).toBe(103000);
    expect(accountBalance(acc, [a])).toBe(105000); // após excluir a despesa
    expect(accountBalance(acc, [{ ...a, amount: 7000 }, b2])).toBe(105000); // após editar a receita
  });
  it("cancelado não afeta saldo nem relatórios", () => {
    const t = tx({ status: "canceled", amount: 999999 });
    expect(accountBalance(acc, [t])).toBe(100000);
    expect(summarize([t], "2026-11-01", "2026-11-30", { includePending: true }).expense).toBe(0);
  });
  it("datas não sofrem deslocamento de fuso", () => {
    expect(todayISO("America/Sao_Paulo", new Date("2026-11-27T02:30:00Z"))).toBe("2026-11-26"); // 23h30 em Brasília
    expect(fmtDateTime("2026-11-27T00:40:00Z")).toBe("26/11/2026 21:40");
  });
});

describe("upload: tipo real do arquivo", () => {
  it("reconhece assinaturas válidas e rejeita disfarces", async () => {
    const { sniffType } = await import("../../files");
    const b = (...x: number[]) => new Uint8Array([...x, ...Array(16).fill(0)]);
    expect(sniffType(b(0x25, 0x50, 0x44, 0x46))).toBe("application/pdf");
    expect(sniffType(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffType(b(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffType(new TextEncoder().encode("<html><script>alert(1)</script>"))).toBeNull(); // HTML disfarçado de PDF
    expect(sniffType(new TextEncoder().encode("MZ\x90\x00executavel......"))).toBeNull();
  });
});

describe("fluxos por conta (fonte única para telas e relatórios)", () => {
  it("considera transferências, fatura e estornos", async () => {
    const { accountFlows } = await import("../ledger");
    const txs = [
      tx({ type: "income", amount: 10000 }), tx({ amount: 3000 }), tx({ type: "refund", amount: 1000 }),
      tx({ type: "card_payment", cardId: "c1", invoiceMonth: "2026-11-01", amount: 2000 }),
      tx({ type: "transfer", accountId: "a1", toAccountId: "a2", amount: 500 }), tx({ type: "transfer", accountId: "a2", toAccountId: "a1", amount: 200 }),
      tx({ amount: 777, status: "pending" }),
    ];
    expect(accountFlows(txs, "a1", "2026-11-01", "2026-11-30")).toEqual({ income: 10000, expense: 4000, transferIn: 200, transferOut: 500 });
  });
});
