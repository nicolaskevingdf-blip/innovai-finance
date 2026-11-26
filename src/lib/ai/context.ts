import "server-only";
import { addDays, addMonths, fmtMonth, monthEnd, monthStart } from "../finance/dates";
import { summarize } from "../finance/ledger";
import { businessSnapshot, personalSnapshot } from "../finance/snapshot";
import { cardLimit, buildInvoices } from "../finance/cards";
import { forecastItems, projectCashflow } from "../finance/cashflow";
import { fromCents } from "../finance/money";
import type { Ledger } from "../data/ledger";

/**
 * Contexto financeiro AGREGADO e calculado de forma determinística a partir do
 * ambiente ativo. É a única fonte de números da IA. Não inclui dados de outros ambientes.
 */
export function buildFinancialContext(kind: "personal" | "business", L: Ledger, extra: { goals?: { name: string; target: number; saved: number; targetDate: string | null; monthlyNeeded: number | null }[]; budgets?: { category: string; amount: number; spent: number }[]; minCash?: number | null; withdrawalLimit?: number | null }) {
  const R = fromCents;
  const cats = new Map(L.categories.map((c) => [c.id, c.name]));
  const months = Array.from({ length: 6 }, (_, i) => addMonths(monthStart(L.today), -i));
  const monthly = months.map((m) => {
    const s = summarize(L.txs, m, monthEnd(m), { includePending: m === monthStart(L.today) ? false : false });
    const top = [...s.byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, v]) => ({ categoria: id ? cats.get(id) ?? "?" : "Sem categoria", valor: R(v) }));
    return { mes: fmtMonth(m, true), inicio: m, receitas: R(s.income), despesas: R(s.expense), resultado: R(s.net), lancamentos: s.count, despesas_por_categoria: top, parcial: m === monthStart(L.today) };
  });
  const items = forecastItems(L.txs, L.cards, L.today, addDays(L.today, 90));
  const total = [...L.balances.values()].reduce((a, b) => a + b, 0);
  const proj = (d: number) => { const r = projectCashflow({ startBalance: total, items, from: L.today, to: addDays(L.today, d), granularity: "month", minCash: extra.minCash ?? undefined }); return { saldo_final: R(r.buckets.at(-1)?.closing ?? total), menor_saldo: R(r.lowest.balance), data_menor_saldo: r.lowest.date }; };
  const base = {
    data_de_hoje: L.today,
    tipo_ambiente: kind === "personal" ? "pessoal" : "empresarial",
    historico_disponivel_desde: L.since,
    contas: L.accounts.filter((a) => !a.archived).map((a) => ({ nome: a.name, tipo: a.type, saldo: R(L.balances.get(a.id) ?? 0) })),
    meses: monthly,
    projecao_com_lancamentos_cadastrados: { em_30_dias: proj(30), em_60_dias: proj(60), em_90_dias: proj(90) },
    proximos_vencimentos: items.slice(0, 25).map((i) => ({ data: i.date, descricao: i.label, valor: R(i.amount), vencido: !!i.overdue })),
    cartoes: L.cards.map((c) => { const l = cardLimit(c, L.txs); const inv = buildInvoices(c, L.txs, L.today).filter((i) => i.remaining > 0).slice(0, 3); return { nome: c.name, limite: R(c.limit), usado: R(l.used), disponivel: R(l.available), faturas_em_aberto: inv.map((i) => ({ mes: i.month, vencimento: i.dueDate, valor: R(i.remaining) })) }; }),
    metas: (extra.goals ?? []).map((g) => ({ nome: g.name, objetivo: R(g.target), acumulado: R(g.saved), prazo: g.targetDate, aporte_mensal_necessario: g.monthlyNeeded === null ? null : R(g.monthlyNeeded) })),
    orcamentos_do_mes: (extra.budgets ?? []).map((b) => ({ categoria: b.category, planejado: R(b.amount), gasto: R(b.spent) })),
  };
  if (kind === "personal") {
    const s = personalSnapshot({ accounts: L.accounts, txs: L.txs, cards: L.cards, today: L.today, balances: L.balances });
    return { ...base, indicadores: { saldo_total: R(s.totalBalance), saldo_bancario: R(s.bankBalance), comprometido_ate_fim_do_mes: R(s.committed), receitas_previstas_ate_fim_do_mes: R(s.expectedIncome), saldo_previsto_fim_do_mes: R(s.forecastBalance), saldo_disponivel_estimado: R(s.availableEstimate) } };
  }
  const b = businessSnapshot({ accounts: L.accounts, txs: L.txs, categories: L.categories, today: L.today, balances: L.balances });
  return { ...base, indicadores_mes_atual: { saldo: R(b.balance), faturamento_registrado: R(b.revenue), recebido: R(b.received), pago: R(b.paidOut), custos: R(b.costs), despesas: R(b.expenses), investimentos: R(b.investments), retiradas: R(b.withdrawals), resultado_estimado_competencia: R(b.estimatedResult), resultado_de_caixa_registrado: R(b.cashResult), a_pagar_total: R(b.payables.open), a_pagar_vencido: R(b.payables.overdue), a_pagar_30_dias: R(b.payables.next30), a_receber_total: R(b.receivables.open), a_receber_vencido: R(b.receivables.overdue), a_receber_30_dias: R(b.receivables.next30), capital_de_giro_estimado_30d: R(b.workingCapital30), caixa_minimo_definido: extra.minCash == null ? null : R(extra.minCash), limite_de_retirada_definido: extra.withdrawalLimit == null ? null : R(extra.withdrawalLimit) }, mes_anterior: { faturamento: R(b.prev.revenue), custos_e_despesas: R(b.prev.expenses), resultado_estimado: R(b.prev.estimatedResult) } };
}
export type FinancialContext = ReturnType<typeof buildFinancialContext>;
