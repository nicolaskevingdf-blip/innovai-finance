import { getWorkspace } from "@/lib/data/workspace";
import { loadLedger } from "@/lib/data/ledger";
import { loadInsights } from "@/lib/data/insights";
import { Card, CardHeader, Empty, Notice, PageHeader, Tabs } from "@/components/ui";
import { InsightCard } from "@/components/insight-card";
import { Assistant } from "@/components/assistant";
import { SUGGESTIONS } from "@/lib/ai/intents";
import { aiEnabled } from "@/lib/ai/claude";
import { hasFeature } from "@/lib/plans";
import { periodSummary } from "@/lib/finance/summary";

export const metadata = { title: "Inteligência" };

export default async function Page({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<{ nivel?: string; aba?: string }> }) {
  const [{ ws }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getWorkspace(ws);
  const L = await loadLedger(ws);
  const all = await loadInsights(ctx, L);
  const nivel = ["high", "attention", "recommendation", "info"].includes(sp.nivel ?? "") ? sp.nivel! : "all";
  const insights = nivel === "all" ? all : all.filter((i) => i.level === nivel);
  const kind = ctx.ws.kind === "business" ? "business" : "personal";
  const mode = aiEnabled() && hasFeature(ctx.sub, "ai") ? "claude" : "local";
  const week = periodSummary(kind, L.txs, L.categories, L.today, "week");
  const month = periodSummary(kind, L.txs, L.categories, L.today, "month");
  const count = (l: string) => all.filter((i) => i.level === l).length;
  const aba = sp.aba === "assistente" ? "assistente" : "insights";
  const q = (o: Record<string, string>) => "?" + new URLSearchParams({ ...(nivel !== "all" ? { nivel } : {}), ...o });
  return (
    <>
      <PageHeader title="Inteligência Innovai" subtitle={<span className={aba === "assistente" ? "hidden lg:inline" : ""}>Análises calculadas a partir dos seus dados reais — com contexto e próximo passo.</span>} />
      {/* Celular: alterna entre insights e assistente; desktop mostra os dois lado a lado */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1 lg:hidden">
        {(["insights", "assistente"] as const).map((k) => (
          <a key={k} href={q({ aba: k })} aria-current={aba === k ? "page" : undefined} className={`flex h-10 items-center justify-center gap-2 rounded-lg text-[14px] font-medium transition ${aba === k ? "bg-surface-2 text-fg" : "text-muted"}`}>
            {k === "insights" ? <>Insights {all.length > 0 && <span className="num rounded-full bg-lime-soft px-1.5 text-[11px] text-lime">{all.length}</span>}</> : "Assistente"}
          </a>
        ))}
      </div>
      {mode === "local" && <div className={`mb-4 ${aba === "assistente" ? "hidden lg:block" : ""}`}><Notice>O assistente está usando o <b>motor de cálculo local</b> (perguntas frequentes sobre gastos, contas, caixa e metas). A IA generativa para perguntas abertas fica disponível quando a chave do provedor de IA for configurada na plataforma.</Notice></div>}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className={`lg:col-span-3 ${aba === "assistente" ? "hidden lg:block" : ""}`}>
          <Tabs active={nivel} items={[
            { key: "all", label: "Todos", href: "?", count: all.length },
            { key: "high", label: "Prioridade alta", href: "?nivel=high", count: count("high") },
            { key: "attention", label: "Atenção", href: "?nivel=attention", count: count("attention") },
            { key: "recommendation", label: "Recomendações", href: "?nivel=recommendation", count: count("recommendation") },
            { key: "info", label: "Informativos", href: "?nivel=info", count: count("info") },
          ]} />
          <div className="space-y-3">
            {insights.length ? insights.map((i) => <InsightCard key={i.key} i={i} ws={ws} />) : <Card><Empty title="Tudo em ordem por aqui" text="Nenhum alerta neste nível. Novos insights aparecem conforme seus dados mudam." /></Card>}
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 md:gap-4">
            {[week, month].map((s) => (
              <Card key={s.title} className="p-5"><div className="eyebrow mb-2">{s.title}</div><ul className="space-y-2 text-[14px] leading-relaxed text-muted">{s.lines.map((l, i) => <li key={i}>{l}</li>)}</ul></Card>
            ))}
          </div>
        </div>
        <Card className={`flex h-[calc(100dvh-16rem-env(safe-area-inset-bottom)-env(safe-area-inset-top))] min-h-[360px] flex-col lg:sticky lg:top-8 lg:col-span-2 lg:h-[min(78dvh,720px)] ${aba === "insights" ? "hidden lg:flex" : ""}`}>
          <CardHeader title="Assistente financeiro" subtitle={<>Ambiente: {ctx.ws.name}{mode === "local" && <span className="text-faint"> · cálculo local</span>}</>} />
          <Assistant ws={ws} suggestions={SUGGESTIONS[kind]} mode={mode} />
        </Card>
      </div>
    </>
  );
}
