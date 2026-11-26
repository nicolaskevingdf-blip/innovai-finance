import { addDays, addMonths, fmtMonth, monthEnd, monthStart, type ISODate } from "./dates";
import { formatBRL } from "./money";
import { summarize } from "./ledger";
import type { Category, Tx } from "./types";

const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);
const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;

/** Resumo em linguagem natural, 100% calculado a partir dos lançamentos. */
export function periodSummary(kind: "personal" | "business", txs: Tx[], categories: Category[], today: ISODate, period: "week" | "month"): { title: string; lines: string[] } {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  let from: ISODate, to: ISODate, pFrom: ISODate, pTo: ISODate, title: string;
  if (period === "week") { to = today; from = addDays(today, -6); pTo = addDays(from, -1); pFrom = addDays(pTo, -6); title = "Últimos 7 dias"; }
  else { const prev = addMonths(monthStart(today), -1); from = prev; to = monthEnd(prev); pFrom = addMonths(prev, -1); pTo = monthEnd(pFrom); title = `Resumo de ${fmtMonth(prev, true)}`; }
  const cur = summarize(txs, from, to, { includePending: period === "month" });
  const prev = summarize(txs, pFrom, pTo, { includePending: period === "month" });
  const lines: string[] = [];
  if (!cur.count) return { title, lines: ["Não há lançamentos registrados neste período."] };
  const gi = pct(cur.income, prev.income), ge = pct(cur.expense, prev.expense);
  lines.push(`${kind === "business" ? "Faturamento registrado" : "Receitas"}: ${formatBRL(cur.income)}${gi !== null && prev.count ? ` (${signed(gi)} vs período anterior)` : ""}. Despesas: ${formatBRL(cur.expense)}${ge !== null && prev.count ? ` (${signed(ge)})` : ""}.`);
  if (gi !== null && ge !== null && prev.count && ge > gi + 5) lines.push(`As despesas cresceram mais rápido que ${kind === "business" ? "o faturamento" : "as receitas"}. O resultado registrado ficou em ${formatBRL(cur.net)}, contra ${formatBRL(prev.net)} no período anterior.`);
  else lines.push(`Resultado registrado: ${formatBRL(cur.net)}${prev.count ? ` (período anterior: ${formatBRL(prev.net)})` : ""}.`);
  const top = [...cur.byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length && cur.expense) lines.push(`Maiores despesas: ${top.map(([id, v]) => `${id ? names.get(id) : "sem categoria"} (${formatBRL(v)})`).join(", ")}.`);
  const movers = [...cur.byCategory.entries()].map(([id, v]) => ({ id, v, p: prev.byCategory.get(id) ?? 0 })).filter((m) => m.id && m.p >= 5000 && m.v > m.p * 1.2).sort((a, b) => b.v - b.p - (a.v - a.p)).slice(0, 2);
  for (const m of movers) lines.push(`${names.get(m.id!)} subiu ${pct(m.v, m.p)}% (${formatBRL(m.p)} → ${formatBRL(m.v)}).`);
  return { title, lines };
}
