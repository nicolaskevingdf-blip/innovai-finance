import { addMonths, fmtDate, monthEnd, monthStart, parts, type ISODate } from "./dates";
import { formatBRL } from "./money";
import { summarize } from "./ledger";
import { budgetUsage, type GoalProjection } from "./planning";
import type { Category, Tx } from "./types";

export type InsightLevel = "info" | "attention" | "recommendation" | "high";

export interface Insight {
  key: string; // estável — permite dispensar
  title: string;
  description: string;
  level: InsightLevel;
  area: "orçamento" | "gastos" | "receitas" | "caixa" | "contas" | "metas" | "cartões" | "separação" | "dados";
  indicator?: string;
  recommendation?: string;
  action?: { label: string; href: string };
}

export interface InsightContext {
  kind: "personal" | "business";
  basePath: string;
  today: ISODate;
  txs: Tx[]; // ao menos 4 meses de histórico + pendências futuras
  categories: Category[];
  budgets: { categoryId: string; amount: number }[]; // mês corrente
  thresholds?: number[];
  goals: { id: string; name: string; projection: GoalProjection }[];
  balance: number;
  forecastBalance?: number;
  projectedLowest?: { date: ISODate; balance: number };
  minCash?: number | null;
  cards?: { name: string; usagePct: number }[];
  payablesNext7?: number;
  overdueExpenses?: number;
  overdueIncome?: number;
}

const pctFmt = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;

export function generateInsights(c: InsightContext): Insight[] {
  const out: Insight[] = [];
  const cats = new Map(c.categories.map((x) => [x.id, x]));
  const ms = monthStart(c.today), me = monthEnd(c.today);
  const ym = ms.slice(0, 7);
  const cur = summarize(c.txs, ms, me, { includePending: false });
  const prevMonths = [1, 2, 3].map((i) => {
    const f = addMonths(ms, -i);
    return summarize(c.txs, f, monthEnd(f), { includePending: false });
  });
  const monthsWithData = prevMonths.filter((m) => m.count > 0).length;

  // 1. Orçamentos
  for (const b of c.budgets) {
    const spent = summarize(c.txs, ms, me, { includePending: true }).byCategory.get(b.categoryId) ?? 0;
    const u = budgetUsage(spent, b.amount, c.thresholds);
    if (u.level === "ok" || u.pct === null) continue;
    const name = cats.get(b.categoryId)?.name ?? "categoria";
    out.push({
      key: `budget:${b.categoryId}:${ym}:${u.crossed}`,
      title: u.level === "over" ? `Orçamento de ${name} ultrapassado` : `Você utilizou ${pctFmt(u.pct)} do orçamento de ${name}`,
      description: `Gasto registrado no mês: ${formatBRL(spent)} de ${formatBRL(b.amount)} planejados (inclui lançamentos pendentes).`,
      level: u.level === "over" ? "high" : u.level === "high" ? "attention" : "info",
      area: "orçamento",
      indicator: pctFmt(u.pct),
      recommendation: u.level === "over" ? "Revise os próximos gastos desta categoria ou ajuste o planejamento." : undefined,
      action: { label: "Ver planejamento", href: `${c.basePath}/planejamento` },
    });
  }

  // 2. Categorias acima da média dos 3 meses anteriores
  if (monthsWithData >= 2) {
    const ids = new Set<string | null>();
    prevMonths.forEach((m) => m.byCategory.forEach((_, k) => ids.add(k)));
    for (const id of ids) {
      if (!id) continue;
      const cat = cats.get(id);
      if (!cat || cat.kind !== "expense") continue;
      const avg = prevMonths.reduce((s, m) => s + (m.byCategory.get(id) ?? 0), 0) / monthsWithData;
      const now = cur.byCategory.get(id) ?? 0;
      if (avg < 5000 || now <= avg * 1.2) continue; // ignora valores irrelevantes (< R$ 50)
      const inc = ((now - avg) / avg) * 100;
      out.push({
        key: `catspike:${id}:${ym}`,
        title: `Gastos com ${cat.name} acima da média`,
        description: `Neste mês: ${formatBRL(now)}. Média dos ${monthsWithData} meses anteriores: ${formatBRL(Math.round(avg))} (+${pctFmt(inc)}).`,
        level: inc > 50 ? "attention" : "info",
        area: "gastos",
        indicator: `+${pctFmt(inc)}`,
        action: { label: "Ver movimentações", href: `${c.basePath}/movimentacoes?categoria=${id}` },
      });
    }
  }

  // 3. Despesas crescendo mais que receitas (último mês completo vs anterior)
  const [m1, m2] = prevMonths;
  if (m1.count > 0 && m2.count > 0 && m2.income > 0 && m2.expense > 0) {
    const gi = ((m1.income - m2.income) / m2.income) * 100;
    const ge = ((m1.expense - m2.expense) / m2.expense) * 100;
    if (ge > gi + 5 && ge > 0) {
      out.push({
        key: `growth:${ym}`,
        title: c.kind === "business" ? "Despesas cresceram mais rápido que as receitas" : "Seus gastos cresceram mais que sua renda",
        description: `No último mês fechado, as receitas variaram ${gi >= 0 ? "+" : ""}${pctFmt(gi)} e as despesas ${ge >= 0 ? "+" : ""}${pctFmt(ge)} em relação ao mês anterior.`,
        level: "attention",
        area: "gastos",
        recommendation: "Identifique quais categorias puxaram o aumento nos relatórios.",
        action: { label: "Abrir relatórios", href: `${c.basePath}/relatorios` },
      });
    }
    if (c.kind === "business") {
      const avgRev = prevMonths.filter((m) => m.count).reduce((s, m) => s + m.income, 0) / monthsWithData;
      const { d } = parts(c.today);
      if (d >= 20 && avgRev > 0 && cur.income > avgRev * 1.1) {
        out.push({ key: `revabove:${ym}`, title: "Faturamento recebido acima da média", description: `Recebido no mês até agora: ${formatBRL(cur.income)}. Média recente: ${formatBRL(Math.round(avgRev))}.`, level: "info", area: "receitas" });
      }
    }
  }

  // 4. Vencidos
  if ((c.overdueExpenses ?? 0) > 0)
    out.push({ key: `overdue:exp:${c.today}`, title: "Você tem contas vencidas", description: `Total em aberto vencido: ${formatBRL(c.overdueExpenses!)}.`, level: "high", area: "contas", recommendation: "Regularize ou atualize o status para manter as projeções corretas.", action: { label: "Ver contas", href: c.kind === "business" ? `${c.basePath}/financeiro?aba=pagar` : `${c.basePath}/movimentacoes?status=pending` } });
  if (c.kind === "business" && (c.overdueIncome ?? 0) > 0)
    out.push({ key: `overdue:inc:${c.today}`, title: "Recebimentos em atraso", description: `${formatBRL(c.overdueIncome!)} registrados como a receber já passaram do vencimento.`, level: "attention", area: "receitas", action: { label: "Contas a receber", href: `${c.basePath}/financeiro?aba=receber` } });

  // 5. Concentração de pagamentos
  if ((c.payablesNext7 ?? 0) > 0 && c.balance > 0 && c.payablesNext7! > c.balance * 0.4)
    out.push({ key: `concentration:${c.today}`, title: "Concentração de pagamentos nos próximos 7 dias", description: `${formatBRL(c.payablesNext7!)} vencem na próxima semana — ${pctFmt((c.payablesNext7! / c.balance) * 100)} do saldo atual.`, level: "attention", area: "caixa", action: { label: "Fluxo de caixa", href: `${c.basePath}/fluxo` } });

  // 6. Caixa projetado
  if (c.projectedLowest && c.minCash != null && c.projectedLowest.balance < c.minCash)
    out.push({ key: `lowcash:${c.projectedLowest.date}`, title: "Caixa projetado abaixo do limite de segurança", description: `Considerando contas a pagar e a receber cadastradas, o saldo pode chegar a ${formatBRL(c.projectedLowest.balance)} em ${fmtDate(c.projectedLowest.date)} (limite: ${formatBRL(c.minCash)}).`, level: "high", area: "caixa", recommendation: "Antecipe recebimentos, renegocie vencimentos ou reduza saídas no período.", action: { label: "Ver projeção", href: `${c.basePath}/fluxo` } });
  if (c.kind === "personal" && c.forecastBalance !== undefined && c.forecastBalance < 0)
    out.push({ key: `forecastneg:${ym}`, title: "Seu saldo previsto pode ficar negativo", description: `Com as contas e faturas registradas até o fim do mês, o saldo previsto é ${formatBRL(c.forecastBalance)}.`, level: "high", area: "caixa", action: { label: "Ver compromissos", href: `${c.basePath}/movimentacoes?status=pending` } });

  // 7. Metas
  for (const g of c.goals) {
    const p = g.projection;
    if (p.remaining > 0 && p.pct >= 90) out.push({ key: `goalnear:${g.id}`, title: `Você está próximo de atingir "${g.name}"`, description: `Faltam ${formatBRL(p.remaining)} (${pctFmt(p.pct)} concluído).`, level: "info", area: "metas", action: { label: "Ver metas", href: `${c.basePath}/metas` } });
    else if (p.onTrack === false && p.monthlyNeeded) out.push({ key: `goalbehind:${g.id}:${ym}`, title: `Meta "${g.name}" abaixo do ritmo necessário`, description: `Aporte médio recente: ${formatBRL(p.avgMonthlyContribution ?? 0)}/mês. Necessário: ${formatBRL(p.monthlyNeeded)}/mês para cumprir o prazo.`, level: "recommendation", area: "metas", action: { label: "Ver metas", href: `${c.basePath}/metas` } });
  }

  // 8. Cartões
  for (const card of c.cards ?? []) if (card.usagePct >= 80) out.push({ key: `card:${card.name}:${ym}`, title: `Limite do cartão ${card.name} em ${pctFmt(card.usagePct)}`, description: "O limite comprometido inclui parcelas futuras já registradas.", level: "attention", area: "cartões", action: { label: "Ver cartões", href: `${c.basePath}/cartoes` } });

  // 9. Separação PF/PJ
  if (c.kind === "business") {
    const personal = c.txs.filter((t) => t.type === "expense" && t.status !== "canceled" && t.competenceDate >= ms && t.competenceDate <= me && t.categoryId && cats.get(t.categoryId)?.grp === "personal");
    if (personal.length) {
      const total = personal.reduce((s, t) => s + t.amount, 0);
      out.push({ key: `mixing:${ym}`, title: "Despesas pessoais pagas pela empresa", description: `${personal.length} lançamento(s) somando ${formatBRL(total)} neste mês. Isso dificulta enxergar o resultado real do negócio.`, level: "recommendation", area: "separação", recommendation: "Registre como retirada/pró-labore e defina um limite mensal de retiradas.", action: { label: "Configurar limites", href: `${c.basePath}/configuracoes` } });
    }
  }

  // 10. Despesa fora do padrão (> 3x a mediana da categoria, com ao menos 5 amostras)
  const byCat = new Map<string, number[]>();
  for (const t of c.txs) if (t.type === "expense" && t.status === "paid" && t.categoryId && t.competenceDate < ms) (byCat.get(t.categoryId) ?? byCat.set(t.categoryId, []).get(t.categoryId)!).push(t.amount);
  for (const t of c.txs) {
    if (t.type !== "expense" || t.status === "canceled" || !t.categoryId || t.competenceDate < ms || t.competenceDate > me) continue;
    const hist = byCat.get(t.categoryId);
    if (!hist || hist.length < 5) continue;
    const sorted = [...hist].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (median > 0 && t.amount > median * 3 && t.amount >= 10000)
      out.push({ key: `unusual:${t.id}`, title: "Despesa fora do padrão", description: `"${t.description}" (${formatBRL(t.amount)}) é ${Math.round(t.amount / median)}x maior que o valor típico em ${cats.get(t.categoryId)?.name}.`, level: "info", area: "gastos", action: { label: "Revisar", href: `${c.basePath}/movimentacoes?q=${encodeURIComponent(t.description)}` } });
  }

  if (monthsWithData === 0 && cur.count < 5)
    out.push({ key: `fewdata:${ym}`, title: "Ainda há poucos dados para análises comparativas", description: "Comparações com a média e tendências aparecem após cerca de dois meses de lançamentos. Os alertas de contas, orçamento e caixa já funcionam.", level: "info", area: "dados" });

  const rank: Record<InsightLevel, number> = { high: 0, attention: 1, recommendation: 2, info: 3 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
