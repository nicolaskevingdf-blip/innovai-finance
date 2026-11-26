import "server-only";
import { cache } from "react";
import { createClient } from "../supabase/server";
import { addDays, monthStart } from "../finance/dates";
import { toCents } from "../finance/money";
import { generateInsights } from "../finance/insights";
import { goalProjection } from "../finance/planning";
import { cardLimit } from "../finance/cards";
import { forecastItems, projectCashflow } from "../finance/cashflow";
import { obligationTotals } from "../finance/obligations";
import { personalSnapshot } from "../finance/snapshot";
import type { Ledger } from "./ledger";
import type { WorkspaceCtx } from "./workspace";

export const loadGoals = cache(async (wsId: string, today: string) => {
  const sb = await createClient();
  const [{ data: goals }, { data: contribs }] = await Promise.all([
    sb.from("goals").select("*").eq("workspace_id", wsId).eq("archived", false).order("created_at"),
    sb.from("goal_contributions").select("*").eq("workspace_id", wsId).order("date", { ascending: false }),
  ]);
  return (goals ?? []).map((g) => {
    const cs = (contribs ?? []).filter((c) => c.goal_id === g.id).map((c) => ({ id: c.id as string, amount: toCents(c.amount), date: c.date as string, note: c.note as string | null }));
    return { id: g.id as string, name: g.name as string, kind: g.kind as string, target: toCents(g.target_amount), targetDate: g.target_date as string | null, contributions: cs, projection: goalProjection({ target: toCents(g.target_amount), contributions: cs, targetDate: g.target_date, today }) };
  });
});

export const loadInsights = cache(async (ctx: WorkspaceCtx, L: Ledger) => {
  const sb = await createClient();
  const [{ data: budgets }, { data: dismissed }, goals] = await Promise.all([
    sb.from("budgets").select("category_id, amount").eq("workspace_id", ctx.ws.id).eq("month", monthStart(L.today)),
    sb.from("insight_dismissals").select("insight_key").eq("workspace_id", ctx.ws.id).eq("user_id", ctx.userId),
    loadGoals(ctx.ws.id, L.today),
  ]);
  const settings = ctx.ws.settings as { budget_thresholds?: number[]; min_cash?: number; insight_frequency?: string };
  const balance = [...L.balances.values()].reduce((a, b) => a + b, 0);
  const items = forecastItems(L.txs, L.cards, L.today, addDays(L.today, 60));
  const proj = projectCashflow({ startBalance: balance, items, from: L.today, to: addDays(L.today, 60), granularity: "month", minCash: settings.min_cash });
  const pay = obligationTotals(L.txs, "expense", L.today), rec = obligationTotals(L.txs, "income", L.today);
  const kind = ctx.ws.kind === "business" ? "business" : "personal";
  const snap = kind === "personal" ? personalSnapshot({ accounts: L.accounts, txs: L.txs, cards: L.cards, today: L.today, balances: L.balances }) : null;
  const all = generateInsights({
    kind, basePath: ctx.base, today: L.today, txs: L.txs, categories: L.categories,
    budgets: (budgets ?? []).map((b) => ({ categoryId: b.category_id, amount: toCents(b.amount) })),
    thresholds: settings.budget_thresholds, goals: goals.map((g) => ({ id: g.id, name: g.name, projection: g.projection })),
    balance, forecastBalance: snap?.forecastBalance, projectedLowest: proj.lowest, minCash: settings.min_cash ?? null,
    cards: L.cards.map((c) => ({ name: c.name, usagePct: cardLimit(c, L.txs).usagePct })),
    payablesNext7: pay.next7 + pay.overdue + pay.dueToday, overdueExpenses: pay.overdue, overdueIncome: rec.overdue,
  });
  const hidden = new Set((dismissed ?? []).map((d) => d.insight_key));
  let visible = all.filter((i) => !hidden.has(i.key));
  if (settings.insight_frequency === "important") visible = visible.filter((i) => i.level === "high" || i.level === "attention");
  if (settings.insight_frequency === "off") visible = visible.filter((i) => i.level === "high");
  return visible;
});
