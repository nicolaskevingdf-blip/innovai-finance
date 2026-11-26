import Link from "next/link";
import { CreditCard, Receipt, ArrowDownLeft } from "lucide-react";
import { Badge, Money } from "@/components/ui";
import { fmtDayMonth, type ISODate } from "@/lib/finance/dates";
import { addMonths, monthEnd, monthStart, fmtMonth } from "@/lib/finance/dates";
import { summarize } from "@/lib/finance/ledger";
import type { Tx } from "@/lib/finance/types";

export function monthlySeries(txs: Tx[], today: ISODate, n = 6) {
  return Array.from({ length: n }, (_, i) => {
    const m = addMonths(monthStart(today), -(n - 1 - i));
    const s = summarize(txs, m, monthEnd(m), { includePending: false });
    return { label: fmtMonth(m), income: s.income, expense: s.expense };
  });
}

export function UpcomingList({ items, base, empty }: { items: { date: string; label: string; amount: number; kind: string; overdue: boolean }[]; base: string; empty: string }) {
  if (!items.length) return <p className="px-5 pb-5 pt-3 text-[14px] text-muted">{empty}</p>;
  return (
    <ul className="px-2 pb-2 pt-2">
      {items.slice(0, 6).map((u, i) => {
        const Icon = u.kind === "card" ? CreditCard : u.kind === "income" ? ArrowDownLeft : Receipt;
        return (
          <li key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-surface-3 text-muted"><Icon size={16} /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px]">{u.label}</div>
              <div className="text-[12px] text-faint">{u.overdue ? <Badge tone="neg">Vencida · {fmtDayMonth(u.date)}</Badge> : fmtDayMonth(u.date)}</div>
            </div>
            <Money c={u.kind === "income" ? u.amount : -u.amount} className={u.kind === "income" ? "text-lime text-[14px]" : "text-[14px]"} />
          </li>
        );
      })}
      <li className="px-3 pt-1"><Link href={`${base}/movimentacoes?status=pending`} className="text-[13px] text-muted hover:text-fg">Ver todas as pendências →</Link></li>
    </ul>
  );
}
