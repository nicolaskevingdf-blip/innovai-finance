import clsx from "clsx";
import { fmtDateTime } from "@/lib/finance/dates";
import type { HistoryEntry } from "@/lib/history";

/** Lista do histórico de alterações (antes → depois). Sem estado: serve no servidor e no cliente. */
export function HistoryList({ entries, compact }: { entries: HistoryEntry[]; compact?: boolean }) {
  if (!entries.length) return <p className="text-[13.5px] text-faint">Nenhum registro de alteração.</p>;
  return (
    <ol className="space-y-3">
      {entries.map((e) => (
        <li key={e.id} className="card px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="text-[14px] font-medium">{e.title}</span>
            <span className="text-[12px] text-faint">{fmtDateTime(e.at)}</span>
          </div>
          <div className="text-[12.5px] text-muted">por {e.who}</div>
          {e.changes.length > 0 && (
            <dl className={clsx("mt-2 space-y-1 border-t border-line pt-2 text-[13px]", compact && "max-h-56 overflow-y-auto")}>
              {e.changes.map((c) => (
                <div key={c.field} className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-2">
                  <dt className="truncate text-faint">{c.label}</dt>
                  <dd className="min-w-0 break-words">
                    {c.from && c.to ? <><span className="text-muted line-through decoration-neg/60">{c.from}</span> <span className="text-faint">→</span> <span>{c.to}</span></> : <span className={c.from ? "text-muted" : ""}>{c.to || c.from}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </li>
      ))}
    </ol>
  );
}
