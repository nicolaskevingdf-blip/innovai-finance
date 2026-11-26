import { addMonths, diffDays, monthsBetween, type ISODate } from "./dates";

export type BudgetLevel = "ok" | "info" | "attention" | "high" | "over";

/** Limiares padrão 50/75/90% — personalizáveis por ambiente. */
export const DEFAULT_THRESHOLDS = [50, 75, 90] as const;

export function budgetUsage(spent: number, budget: number, thresholds: readonly number[] = DEFAULT_THRESHOLDS) {
  const [t1, t2, t3] = [...thresholds].sort((a, b) => a - b);
  if (budget <= 0) return { pct: null as number | null, level: "ok" as BudgetLevel, remaining: -spent, crossed: null as number | null };
  const p = (spent / budget) * 100;
  let level: BudgetLevel = "ok";
  let crossed: number | null = null;
  if (p > 100) { level = "over"; crossed = 100; }
  else if (p >= t3) { level = "high"; crossed = t3; }
  else if (p >= t2) { level = "attention"; crossed = t2; }
  else if (p >= t1) { level = "info"; crossed = t1; }
  return { pct: p, level, remaining: budget - spent, crossed };
}

/**
 * Estimativa de gasto do mês por ritmo atual (linear). É uma ESTIMATIVA e deve
 * ser apresentada como tal. Retorna null se houver poucos dias de dados.
 */
export function monthPaceEstimate(spentSoFar: number, dayOfMonth: number, daysInMonth: number): number | null {
  if (dayOfMonth < 5) return null;
  return Math.round((spentSoFar / dayOfMonth) * daysInMonth);
}

export function average(xs: number[]): number | null {
  if (!xs.length) return null;
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
}

export interface GoalProjection {
  saved: number;
  remaining: number;
  pct: number;
  monthsLeft: number | null;
  monthlyNeeded: number | null;
  avgMonthlyContribution: number | null;
  projectedDate: ISODate | null;
  onTrack: boolean | null;
}

/** Projeção de meta baseada nos aportes reais (média dos últimos meses com aporte). */
export function goalProjection(params: { target: number; contributions: { amount: number; date: ISODate }[]; targetDate: ISODate | null; today: ISODate }): GoalProjection {
  const saved = params.contributions.reduce((a, c) => a + c.amount, 0);
  const remaining = Math.max(0, params.target - saved);
  const pct = Math.min(100, (saved / params.target) * 100);
  let monthsLeft: number | null = null, monthlyNeeded: number | null = null;
  if (params.targetDate) {
    monthsLeft = Math.max(0, monthsBetween(params.today, params.targetDate) + (diffDays(params.today, params.targetDate) >= 0 ? 0 : -1));
    monthlyNeeded = remaining === 0 ? 0 : monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;
  }
  // média mensal dos aportes nos últimos 6 meses
  const since = addMonths(params.today, -6);
  const recent = params.contributions.filter((c) => c.date >= since && c.date <= params.today);
  let avg: number | null = null;
  if (recent.length >= 2) {
    const first = recent.reduce((m, c) => (c.date < m ? c.date : m), recent[0].date);
    const span = Math.max(1, monthsBetween(first, params.today) + 1);
    avg = Math.round(recent.reduce((a, c) => a + c.amount, 0) / span);
  }
  let projectedDate: ISODate | null = null;
  if (remaining === 0) projectedDate = params.today;
  else if (avg && avg > 0) projectedDate = addMonths(params.today, Math.ceil(remaining / avg));
  const onTrack = remaining === 0 ? true : monthlyNeeded !== null && avg !== null ? avg >= monthlyNeeded : null;
  return { saved, remaining, pct, monthsLeft, monthlyNeeded, avgMonthlyContribution: avg, projectedDate, onTrack };
}

export interface DebtInput { id: string; creditor: string; total: number; paid: number; monthlyRate: number | null; installment: number | null }

/** Estratégias de quitação. Avalanche exige taxas conhecidas; dívidas sem taxa ficam ao fim com aviso. */
export function payoffOrder(debts: DebtInput[], strategy: "avalanche" | "snowball") {
  const open = debts.filter((d) => d.total - d.paid > 0);
  if (strategy === "snowball") return [...open].sort((a, b) => a.total - a.paid - (b.total - b.paid));
  return [...open].sort((a, b) => (b.monthlyRate ?? -1) - (a.monthlyRate ?? -1));
}

/**
 * Meses para quitar com parcela fixa e juros mensais (sistema Price aproximado).
 * Sem taxa conhecida: divisão simples. Retorna null se a parcela não cobre os juros.
 */
export function monthsToPayoff(balance: number, payment: number, monthlyRatePct: number | null): number | null {
  if (balance <= 0) return 0;
  if (payment <= 0) return null;
  const r = (monthlyRatePct ?? 0) / 100;
  if (r === 0) return Math.ceil(balance / payment);
  if (payment <= balance * r) return null;
  return Math.ceil(-Math.log(1 - (r * balance) / payment) / Math.log(1 + r));
}
