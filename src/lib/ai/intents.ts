import { addDays, addMonths, daysInMonth, diffDays, fmtDate, fmtMonth, monthEnd, monthStart, parts, type ISODate } from "../finance/dates";
import { formatBRL, parseMoneyInput } from "../finance/money";
import { summarize } from "../finance/ledger";
import { personalSnapshot, businessSnapshot } from "../finance/snapshot";
import { forecastItems, projectCashflow } from "../finance/cashflow";
import type { Account, Card, Category, Tx } from "../finance/types";

export interface IntentData {
  kind: "personal" | "business";
  today: ISODate;
  accounts: Account[];
  categories: Category[];
  cards: Card[];
  txs: Tx[];
  balances: Map<string, number>;
  goals: { name: string; remaining: number; projectedDate: ISODate | null; monthlyNeeded: number | null; pct: number }[];
  minCash?: number | null;
  withdrawalLimit?: number | null;
}

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function period(q: string, today: ISODate): { from: ISODate; to: ISODate; label: string } {
  const ms = monthStart(today);
  const n = q.match(/ultimos?\s+(\d+|dois|tres|seis)\s+mes/);
  if (n) {
    const k = ({ dois: 2, tres: 3, seis: 6 } as Record<string, number>)[n[1]] ?? Number(n[1]);
    return { from: addMonths(ms, -(k - 1)), to: monthEnd(today), label: `nos últimos ${k} meses (incluindo o atual)` };
  }
  if (/mes passado|mes anterior/.test(q)) { const p = addMonths(ms, -1); return { from: p, to: monthEnd(p), label: `em ${fmtMonth(p, true)}` }; }
  if (/\bhoje\b/.test(q)) return { from: today, to: today, label: "hoje" };
  if (/semana/.test(q) && !/por semana/.test(q)) return { from: addDays(today, -6), to: today, label: "nos últimos 7 dias" };
  if (/\bano\b/.test(q)) return { from: `${today.slice(0, 4)}-01-01`, to: today, label: `em ${today.slice(0, 4)}` };
  return { from: ms, to: monthEnd(today), label: `em ${fmtMonth(ms, true)}` };
}

/**
 * Respostas determinísticas para as perguntas mais comuns. Todos os números vêm
 * do motor financeiro. Retorna null quando não reconhece a pergunta.
 */
export function answerDeterministic(question: string, d: IntentData): string | null {
  const q = strip(question);
  const P = period(q, d.today);
  const catByName = d.categories.filter((c) => q.includes(strip(c.name))).sort((a, b) => b.name.length - a.name.length)[0];
  const total = [...d.balances.values()].reduce((a, b) => a + b, 0);

  // Gasto com categoria específica
  if (catByName && /(gast|despes|paguei|pagamos|quanto)/.test(q)) {
    const ids = new Set([catByName.id, ...d.categories.filter((c) => c.parentId === catByName.id).map((c) => c.id)]);
    let v = 0, n = 0;
    for (const t of d.txs) if (t.type === catByName.kind && t.status !== "canceled" && t.categoryId && ids.has(t.categoryId) && t.competenceDate >= P.from && t.competenceDate <= P.to) { v += t.amount; n++; }
    if (!n) return `Não encontrei lançamentos em ${catByName.name} ${P.label}.`;
    return `${catByName.kind === "income" ? "Você recebeu" : "Você gastou"} ${formatBRL(v)} com ${catByName.name} ${P.label}, em ${n} lançamento(s) (inclui pendentes e compras no cartão pela fatura).`;
  }
  // Onde estou gastando mais / maior despesa
  if (/(gastando mais|maior(es)? despesa|maior gasto|mais gast|principais gastos)/.test(q)) {
    const s = summarize(d.txs, P.from, P.to, { includePending: true });
    if (!s.expense) return `Ainda não há despesas registradas ${P.label}.`;
    const names = new Map(d.categories.map((c) => [c.id, c.name]));
    const top = [...s.byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    return `Maiores despesas ${P.label}:\n` + top.map(([id, v], i) => `${i + 1}. ${id ? names.get(id) ?? "—" : "Sem categoria"}: ${formatBRL(v)} (${Math.round((v / s.expense) * 100)}%)`).join("\n") + `\nTotal: ${formatBRL(s.expense)}.`;
  }
  // Contas a pagar / receber
  if (/(para pagar|a pagar|contas pendentes|tenho de contas|temos para pagar|vencimentos?)/.test(q)) {
    const items = forecastItems(d.txs, d.cards, d.today, addDays(d.today, 30)).filter((i) => i.amount < 0);
    if (!items.length) return "Não há contas a pagar registradas para os próximos 30 dias.";
    const tot = items.reduce((s, i) => s - i.amount, 0), over = items.filter((i) => i.overdue).reduce((s, i) => s - i.amount, 0);
    return `Nos próximos 30 dias há ${formatBRL(tot)} a pagar em ${items.length} compromisso(s)${over ? `, incluindo ${formatBRL(over)} já vencidos` : ""}.\nPróximos: ` + items.slice(0, 4).map((i) => `${i.label} (${fmtDate(i.date)}, ${formatBRL(-i.amount)})`).join("; ") + ".";
  }
  if (/(a receber|para receber|recebimentos)/.test(q)) {
    const items = forecastItems(d.txs, [], d.today, addDays(d.today, 90)).filter((i) => i.amount > 0);
    if (!items.length) return "Não há valores a receber registrados.";
    const tot = items.reduce((s, i) => s + i.amount, 0), over = items.filter((i) => i.overdue).reduce((s, i) => s + i.amount, 0);
    return `Há ${formatBRL(tot)} a receber registrados para os próximos 90 dias${over ? ` — ${formatBRL(over)} já vencidos` : ""}.`;
  }
  // Faturamento
  if (/(faturamos|faturamento|faturei|vendemos|vendas)/.test(q)) {
    const s = summarize(d.txs, P.from, P.to, { includePending: true, kind: "income" });
    const r = summarize(d.txs, P.from, P.to, { includePending: false, kind: "income" });
    return `Faturamento registrado ${P.label}: ${formatBRL(s.income)}. Desse total, ${formatBRL(r.income)} já foram recebidos.`;
  }
  // Fluxo de caixa / projeção
  if (/(fluxo de caixa|caixa projetado|projecao|vai sobrar|saldo previsto|final do mes)/.test(q)) {
    const items = forecastItems(d.txs, d.cards, d.today, monthEnd(addMonths(d.today, 2)));
    const r = projectCashflow({ startBalance: total, items, from: d.today, to: monthEnd(d.today), granularity: "month", minCash: d.minCash ?? undefined });
    const r90 = projectCashflow({ startBalance: total, items, from: d.today, to: addDays(d.today, 90), granularity: "month", minCash: d.minCash ?? undefined });
    return `Saldo atual: ${formatBRL(total)}. Considerando apenas contas e recebimentos cadastrados, o saldo estimado para o fim do mês é ${formatBRL(r.buckets.at(-1)!.closing)}. Nos próximos 90 dias, o menor saldo projetado é ${formatBRL(r90.lowest.balance)} em ${fmtDate(r90.lowest.date)}${d.minCash != null && r90.riskStart ? ` — abaixo do caixa mínimo de ${formatBRL(d.minCash)} a partir de ${fmtDate(r90.riskStart)}` : ""}. É uma estimativa: lançamentos não cadastrados não entram no cálculo.`;
  }
  // Posso comprar X?
  const buy = q.match(/posso (comprar|gastar|pagar)[^\d]*(\d[\d.,]*)/) ?? q.match(/(comprar|gastar)[^\d]*(\d[\d.,]*)/);
  if (buy) {
    const v = parseMoneyInput(buy[2]);
    if (v) {
      if (d.kind === "personal") {
        const s = personalSnapshot({ accounts: d.accounts, txs: d.txs, cards: d.cards, today: d.today, balances: d.balances });
        const after = s.availableEstimate - v;
        return `Seu saldo disponível estimado hoje é ${formatBRL(s.availableEstimate)} (saldo de ${formatBRL(s.totalBalance)} menos ${formatBRL(s.committed)} já comprometidos até o fim do mês). Após um gasto de ${formatBRL(v)}, sobrariam ${formatBRL(after)}. ${after < 0 ? "O valor ultrapassa o disponível estimado." : "Cabe no disponível estimado, mas considere metas e gastos ainda não registrados."}`;
      }
      const items = forecastItems(d.txs, d.cards, d.today, addDays(d.today, 60));
      const r = projectCashflow({ startBalance: total - v, items, from: d.today, to: addDays(d.today, 60), granularity: "month", minCash: d.minCash ?? undefined });
      return `Se a empresa gastar ${formatBRL(v)} hoje, o menor saldo projetado nos próximos 60 dias seria ${formatBRL(r.lowest.balance)} em ${fmtDate(r.lowest.date)}${d.minCash != null ? ` (caixa mínimo definido: ${formatBRL(d.minCash)})` : " — defina um caixa mínimo nas configurações para uma avaliação mais segura"}. Base: contas a pagar e a receber cadastradas.`;
    }
  }
  // Quanto devo gastar por semana
  if (/por semana|por dia/.test(q) && d.kind === "personal") {
    const s = personalSnapshot({ accounts: d.accounts, txs: d.txs, cards: d.cards, today: d.today, balances: d.balances });
    const { y, m, d: day } = parts(d.today);
    const daysLeft = daysInMonth(y, m) - day + 1;
    const perDay = Math.max(0, Math.floor(s.availableEstimate / daysLeft));
    if (s.availableEstimate <= 0) return `Seu disponível estimado é ${formatBRL(s.availableEstimate)}: os compromissos até o fim do mês já consomem o saldo. O ideal é evitar novos gastos até entrar mais dinheiro.`;
    const weekly = Math.min(s.availableEstimate, perDay * 7);
    return daysLeft < 7
      ? `Restam ${daysLeft} dias no mês e seu disponível estimado é ${formatBRL(s.availableEstimate)} — cerca de ${formatBRL(perDay)} por dia até o fim do mês, sem considerar novas receitas nem metas de economia.`
      : `Restam ${daysLeft} dias no mês e seu disponível estimado é ${formatBRL(s.availableEstimate)}. Isso dá até ${formatBRL(weekly)} por semana (${formatBRL(perDay)} por dia), sem considerar novas receitas nem metas de economia.`;
  }
  // Retiradas
  if (/(retirar|retirada|pro.labore)/.test(q) && d.kind === "business") {
    const b = businessSnapshot({ accounts: d.accounts, txs: d.txs, categories: d.categories, today: d.today, balances: d.balances });
    const min = d.minCash ?? 0;
    const room = Math.max(0, b.workingCapital30 - min);
    return `Premissas: saldo atual ${formatBRL(b.balance)}, a receber em 30 dias ${formatBRL(b.receivables.next30 + b.receivables.overdue)}, a pagar em 30 dias ${formatBRL(b.payables.next30 + b.payables.overdue)}${d.minCash != null ? `, caixa mínimo ${formatBRL(min)}` : " (caixa mínimo não definido)"}. Sobra estimada após compromissos: ${formatBRL(room)}. Retiradas já registradas no mês: ${formatBRL(b.withdrawals)}${d.withdrawalLimit != null ? ` de um limite de ${formatBRL(d.withdrawalLimit)}` : ""}. Esta é uma estimativa de caixa, não um cálculo contábil de lucro distribuível.`;
  }
  // Comparação com mês passado
  if (/(comparad|comparacao|mes passado|em relacao)/.test(q)) {
    const ms = monthStart(d.today), pm = addMonths(ms, -1);
    const day = parts(d.today).d;
    const cur = summarize(d.txs, ms, d.today, { includePending: true });
    const prev = summarize(d.txs, pm, addDays(pm, Math.min(day, daysInMonth(parts(pm).y, parts(pm).m)) - 1), { includePending: true });
    if (!prev.count) return "Não há lançamentos no mês anterior para comparar.";
    const v = (a: number, b: number) => (b ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%` : "—");
    return `Comparando até o dia ${day}: receitas ${formatBRL(cur.income)} (${v(cur.income, prev.income)} vs mês anterior) e despesas ${formatBRL(cur.expense)} (${v(cur.expense, prev.expense)}). Resultado: ${formatBRL(cur.net)} vs ${formatBRL(prev.net)}.`;
  }
  // Metas
  if (/(meta|objetivo)/.test(q)) {
    if (!d.goals.length) return "Você ainda não tem metas cadastradas.";
    return d.goals.map((g) => `• ${g.name}: ${Math.round(g.pct)}% concluída, faltam ${formatBRL(g.remaining)}. ${g.projectedDate ? `No ritmo atual de aportes, conclusão estimada em ${fmtMonth(g.projectedDate, true)}.` : "Ainda não há aportes suficientes para projetar a conclusão."}${g.monthlyNeeded ? ` Para cumprir o prazo: ${formatBRL(g.monthlyNeeded)}/mês.` : ""}`).join("\n");
  }
  // Economizar / sobrou menos
  if (/(economizar|sobrou menos|por que sobrou|quanto consigo guardar)/.test(q)) {
    const m = [1, 2, 3].map((i) => { const f = addMonths(monthStart(d.today), -i); return summarize(d.txs, f, monthEnd(f)); }).filter((s) => s.count);
    if (m.length < 2) return "Ainda não há meses completos suficientes para estimar sua capacidade de economia. Continue registrando por pelo menos dois meses.";
    const avg = Math.round(m.reduce((s, x) => s + x.net, 0) / m.length);
    return `Nos últimos ${m.length} meses fechados, sua sobra média (receitas − despesas registradas) foi de ${formatBRL(avg)} por mês. ${avg > 0 ? "Esse é um ponto de partida realista para definir um valor de economia mensal." : "As despesas superaram as receitas no período; revise as maiores categorias em Relatórios."}`;
  }
  // Saldo
  if (/\bsaldo\b|quanto (eu )?tenho|dinheiro em conta/.test(q)) {
    const lines = d.accounts.filter((a) => !a.archived).map((a) => `• ${a.name}: ${formatBRL(d.balances.get(a.id) ?? 0)}`);
    return `Saldo total: ${formatBRL(total)}.\n${lines.join("\n")}`;
  }
  // Funcionário / equipamento (empresa)
  if (/(contratar|equipamento|investir em)/.test(q) && d.kind === "business") {
    const b = businessSnapshot({ accounts: d.accounts, txs: d.txs, categories: d.categories, today: d.today, balances: d.balances });
    return `Para avaliar com segurança, informe o custo mensal (ou o valor) na pergunta, por exemplo: "posso gastar 3500 por mês?". Referências atuais: resultado estimado do mês ${formatBRL(b.estimatedResult)}, mês anterior ${formatBRL(b.prev.estimatedResult)}, capital de giro estimado em 30 dias ${formatBRL(b.workingCapital30)}.`;
  }
  if (/(cobrir as despesas|ponto de equilibrio|precisamos faturar)/.test(q) && d.kind === "business") {
    const b = businessSnapshot({ accounts: d.accounts, txs: d.txs, categories: d.categories, today: d.today, balances: d.balances });
    const pm = addMonths(monthStart(d.today), -1);
    const prevB = businessSnapshot({ accounts: d.accounts, txs: d.txs, categories: d.categories, today: d.today, from: pm, to: monthEnd(pm), balances: d.balances });
    const need = prevB.costs + prevB.expenses;
    return `No mês anterior, custos e despesas registrados somaram ${formatBRL(need)}. Esse é o faturamento mínimo aproximado para cobrir essa estrutura (sem considerar retiradas nem impostos não lançados). Faturamento registrado neste mês até agora: ${formatBRL(b.revenue)} (${diffDays(monthStart(d.today), d.today) + 1} dias).`;
  }
  return null;
}

export const SUGGESTIONS = {
  personal: ["Quanto gastei com alimentação este mês?", "Onde estou gastando mais?", "Quanto tenho de contas para pagar?", "Quanto devo gastar por semana?", "Posso comprar algo de 800 reais?", "Quando atingirei minha meta?", "Como estou em relação ao mês passado?"],
  business: ["Quanto faturamos neste mês?", "Qual nossa maior despesa?", "Quanto temos para pagar?", "Quanto temos para receber?", "Como está nosso fluxo de caixa?", "Quanto podemos retirar?", "Quanto precisamos faturar para cobrir as despesas?"],
};
