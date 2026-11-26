import { describe, expect, it } from "vitest";
import { answerDeterministic, type IntentData } from "../../ai/intents";
import type { Tx } from "../types";

// Intl usa espaço não separável em "R$ 1,00"
const ask = (q: string, d: IntentData) => answerDeterministic(q, d)?.replace(/\u00a0/g, " ") ?? null;

const tx = (p: Partial<Tx>): Tx => ({ id: Math.random().toString(), type: "expense", status: "paid", amount: 1000, description: "x", categoryId: null, accountId: "a1", toAccountId: null, cardId: null, invoiceMonth: null, contactId: null, date: "2026-11-10", competenceDate: p.date ?? "2026-11-10", dueDate: null, paidAt: p.status === "pending" ? null : p.date ?? "2026-11-10", paymentMethod: null, installmentGroup: null, installmentNumber: null, installmentTotal: null, parentId: null, tags: [], ...p });

const base = (txs: Tx[], kind: "personal" | "business" = "personal"): IntentData => ({
  kind, today: "2026-11-20", txs, cards: [], goals: [],
  accounts: [{ id: "a1", name: "Banco", type: "checking", openingBalance: 0, archived: false }],
  categories: [{ id: "c1", name: "Alimentação", kind: "expense", grp: "variable", parentId: null, icon: null, color: null }, { id: "c2", name: "Mercado", kind: "expense", grp: "variable", parentId: "c1", icon: null, color: null }],
  balances: new Map([["a1", 100000]]),
});

describe("assistente determinístico", () => {
  it("soma categoria com subcategorias no mês", () => {
    const a = ask("Quanto gastei com alimentação este mês?", base([tx({ categoryId: "c1", amount: 3000 }), tx({ categoryId: "c2", amount: 2000 }), tx({ categoryId: "c2", amount: 9999, date: "2026-10-05" })]));
    expect(a).toContain("R$ 50,00");
    expect(a).toContain("2 lançamento");
  });
  it("informa quando não há dados", () => {
    expect(ask("Quanto gastei com alimentação este mês?", base([]))).toMatch(/Não encontrei/);
  });
  it("contas a pagar considera apenas cadastradas", () => {
    const a = ask("Quanto tenho de contas para pagar?", base([tx({ status: "pending", dueDate: "2026-11-25", amount: 45000, description: "Aluguel" })]));
    expect(a).toContain("R$ 450,00");
    expect(a).toContain("Aluguel");
  });
  it("não reconhece perguntas fora do domínio", () => {
    expect(ask("Qual a capital da França?", base([]))).toBeNull();
  });
  it("posso comprar usa disponível estimado", () => {
    const a = ask("Posso comprar algo de 300 reais?", base([tx({ status: "pending", dueDate: "2026-11-28", amount: 50000 })]));
    expect(a).toContain("R$ 500,00"); // disponível = 1000 - 500 comprometido
    expect(a).toContain("R$ 200,00"); // sobra após a compra
  });
});
