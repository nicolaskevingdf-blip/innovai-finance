import Link from "next/link";
import { CreditCard, Receipt, ArrowDownLeft } from "lucide-react";
import { Badge, Money } from "@/components/ui";
import { fmtDayMonth, type ISODate } from "@/lib/finance/dates";
import { addMonths, monthEnd, monthStart, fmtMonth } from "@/lib/finance/dates";
import { summarize } from "@/lib/finance/ledger";
import { createClient } from "@/lib/supabase/server";
import type { Tx } from "@/lib/finance/types";

export function monthlySeries(txs: Tx[], today: ISODate, n = 6) {
  return Array.from({ length: n }, (_, i) => {
    const m = addMonths(monthStart(today), -(n - 1 - i));
    const s = summarize(txs, m, monthEnd(m), { includePending: false });
    return { label: fmtMonth(m), income: s.income, expense: s.expense };
  });
}

export function UpcomingList({ items, base, empty }: { items: { date: string; label: string; amount: number; kind: string; overdue: boolean }[]; base: string; empty: string }) {
  if (!items.length) return <p className="px-4 pb-5 pt-3 text-[14px] text-muted sm:px-5">{empty}</p>;
  return (
    <ul className="px-2 pb-2 pt-2">
      {items.slice(0, 6).map((u, i) => {
        const Icon = u.kind === "card" ? CreditCard : u.kind === "income" ? ArrowDownLeft : Receipt;
        return (
          <li key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted"><Icon size={16} /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px]">{u.label}</div>
              <div className="text-[12px] text-faint">{u.overdue ? <Badge tone="neg">Vencida · {fmtDayMonth(u.date)}</Badge> : fmtDayMonth(u.date)}</div>
            </div>
            <Money c={u.kind === "income" ? u.amount : -u.amount} className={u.kind === "income" ? "shrink-0 text-lime text-[14px]" : "shrink-0 text-[14px]"} />
          </li>
        );
      })}
      <li className="px-3 pt-1"><Link href={`${base}/movimentacoes?status=pending`} className="text-[13px] text-muted hover:text-fg">Ver todas as pendências →</Link></li>
    </ul>
  );
}

/** Primeiro nome do usuário para a saudação (perfil do Supabase). */
export async function firstName(userId: string) {
  const sb = await createClient();
  const { data } = await sb.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return data?.full_name?.trim().split(/\s+/)[0] ?? null;
}

export function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(now));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
