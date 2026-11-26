import { TxRowItem } from "./tx-row";
import { Empty } from "./ui";
import { fmtDate } from "@/lib/finance/dates";
import { formatBRL } from "@/lib/finance/money";
import type { TxRow } from "@/lib/data/tx-query";
import type { FormRefs } from "./tx-form";

const WD = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function TxList({ rows, refs, groupBy = "date", emptyText }: { rows: TxRow[]; refs: FormRefs; groupBy?: "date" | "due"; emptyText?: string }) {
  if (!rows.length) return <Empty title="Nenhuma movimentação encontrada" text={emptyText ?? "Ajuste os filtros ou registre um novo lançamento."} />;
  const groups = new Map<string, TxRow[]>();
  for (const r of rows) {
    const k = groupBy === "due" ? r.dueDate ?? r.date : r.date;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  return (
    <div className="px-2 py-2">
      {[...groups.entries()].map(([d, items]) => {
        const net = items.reduce((s, r) => s + (r.status === "canceled" ? 0 : r.type === "income" ? r.amount : r.type === "expense" || r.type === "card_payment" ? -r.amount : 0), 0);
        const [y, m, day] = d.split("-").map(Number);
        return (
          <section key={d} className="mb-1">
            <div className="flex items-center justify-between px-3 pb-1 pt-3 text-[12.5px] text-faint">
              <span>{d === refs.today ? "Hoje" : `${fmtDate(d)} · ${WD[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]}`}</span>
              <span className="num">{net !== 0 ? formatBRL(net, { signed: true }) : ""}</span>
            </div>
            {items.map((r) => <TxRowItem key={r.id} r={r} refs={refs} showDue={groupBy !== "due"} />)}
          </section>
        );
      })}
    </div>
  );
}
