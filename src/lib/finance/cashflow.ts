import { addDays, monthStart, weekStart, type ISODate } from "./dates";
import { buildInvoices } from "./cards";
import type { Card, Tx } from "./types";

export interface FlowItem {
  date: ISODate;
  amount: number; // + entrada, − saída
  label: string;
  kind: "receivable" | "payable" | "card_invoice";
  overdue?: boolean;
}

/**
 * Itens previstos a partir de dados REAIS cadastrados: contas pendentes e faturas
 * de cartão em aberto. Nada é inventado. Pendências vencidas entram como "hoje".
 */
export function forecastItems(txs: Tx[], cards: Card[], today: ISODate, until: ISODate): FlowItem[] {
  const items: FlowItem[] = [];
  for (const t of txs) {
    if (t.status !== "pending" || t.cardId) continue;
    if (t.type !== "income" && t.type !== "expense") continue; // pendências sem conta definida também contam
    const due = t.dueDate ?? t.date;
    if (due > until) continue;
    const overdue = due < today;
    items.push({ date: overdue ? today : due, amount: t.type === "income" ? t.amount : -t.amount, label: t.description, kind: t.type === "income" ? "receivable" : "payable", overdue });
  }
  for (const card of cards) {
    for (const inv of buildInvoices(card, txs, today)) {
      if (inv.remaining <= 0 || inv.dueDate > until) continue;
      const overdue = inv.dueDate < today;
      items.push({ date: overdue ? today : inv.dueDate, amount: -inv.remaining, label: `Fatura ${card.name}`, kind: "card_invoice", overdue });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

export type Granularity = "day" | "week" | "month";

export interface FlowBucket {
  start: ISODate;
  opening: number;
  inflow: number;
  outflow: number;
  closing: number;
  belowMin: boolean;
}

export function projectCashflow(params: { startBalance: number; items: FlowItem[]; from: ISODate; to: ISODate; granularity: Granularity; minCash?: number }): { buckets: FlowBucket[]; lowest: { date: ISODate; balance: number }; riskStart: ISODate | null } {
  const { from, to, granularity } = params;
  const keyOf = (d: ISODate) => (granularity === "day" ? d : granularity === "week" ? weekStart(d) : monthStart(d));
  const buckets = new Map<string, FlowBucket>();
  // cria buckets contínuos
  let cursor = from;
  while (cursor <= to) {
    const k = keyOf(cursor);
    if (!buckets.has(k)) buckets.set(k, { start: k < from ? from : k, opening: 0, inflow: 0, outflow: 0, closing: 0, belowMin: false });
    cursor = addDays(cursor, 1);
  }
  for (const it of params.items) {
    if (it.date < from || it.date > to) continue;
    const b = buckets.get(keyOf(it.date));
    if (!b) continue;
    if (it.amount >= 0) b.inflow += it.amount;
    else b.outflow += -it.amount;
  }
  // saldo diário para encontrar o menor ponto real (não só no fim do bucket)
  const daily = new Map<string, number>();
  for (const it of params.items) if (it.date >= from && it.date <= to) daily.set(it.date, (daily.get(it.date) ?? 0) + it.amount);
  let bal = params.startBalance, lowest = { date: from, balance: params.startBalance }, riskStart: ISODate | null = null;
  const min = params.minCash;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    bal += daily.get(d) ?? 0;
    if (bal < lowest.balance) lowest = { date: d, balance: bal };
    if (min !== undefined && riskStart === null && bal < min) riskStart = d;
  }
  let running = params.startBalance;
  const out = [...buckets.values()];
  for (const b of out) {
    b.opening = running;
    b.closing = running + b.inflow - b.outflow;
    running = b.closing;
    b.belowMin = min !== undefined && b.closing < min;
  }
  return { buckets: out, lowest, riskStart };
}
