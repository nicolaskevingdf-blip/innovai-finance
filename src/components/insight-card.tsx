import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, ArrowRight, Info, Lightbulb, X, Zap } from "lucide-react";
import type { Insight } from "@/lib/finance/insights";
import { dismissInsight } from "@/app/actions/workspace";

const LEVEL = {
  high: { label: "Prioridade alta", icon: Zap, c: "text-neg", bg: "bg-neg-soft" },
  attention: { label: "Atenção", icon: AlertTriangle, c: "text-warn", bg: "bg-warn-soft" },
  recommendation: { label: "Recomendação", icon: Lightbulb, c: "text-lime", bg: "bg-lime-soft" },
  info: { label: "Informativo", icon: Info, c: "text-info", bg: "bg-info-soft" },
};

export function InsightCard({ i, ws, compact }: { i: Insight; ws: string; compact?: boolean }) {
  const L = LEVEL[i.level];
  return (
    <article className={clsx("card relative animate-fade-up", compact ? "p-4" : "p-5")}>
      <div className="flex items-start gap-3">
        <span className={clsx("flex size-9 shrink-0 items-center justify-center rounded-xl", L.bg, L.c)}><L.icon size={17} /></span>
        <div className="min-w-0 flex-1 pr-6">
          <div className="mb-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px]"><span className={L.c}>{L.label}</span><span className="text-faint">· {i.area}</span></div>
          <h3 className="text-[14.5px] font-semibold leading-snug">{i.title}</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{i.description}</p>
          {i.recommendation && !compact && <p className="mt-2 text-[13.5px] text-fg/90">→ {i.recommendation}</p>}
          {i.action && <Link href={i.action.href} className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-medium text-lime">{i.action.label} <ArrowRight size={14} /></Link>}
        </div>
      </div>
      <form action={dismissInsight} className="absolute right-2.5 top-2.5">
        <input type="hidden" name="ws" value={ws} /><input type="hidden" name="key" value={i.key} />
        <button className="btn-ghost size-8 rounded-lg p-0" aria-label="Dispensar"><X size={15} /></button>
      </form>
    </article>
  );
}
