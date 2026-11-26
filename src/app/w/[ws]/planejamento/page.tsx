import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getWorkspace } from "@/lib/data/workspace";
import { loadLedger } from "@/lib/data/ledger";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, Empty, Money, Notice, PageHeader, Progress, Stat } from "@/components/ui";
import { Sheet } from "@/components/client";
import { addMonths, daysInMonth, fmtMonth, monthEnd, monthStart, parts, cap } from "@/lib/finance/dates";
import { summarize } from "@/lib/finance/ledger";
import { average, budgetUsage, DEFAULT_THRESHOLDS, monthPaceEstimate } from "@/lib/finance/planning";
import { toCents } from "@/lib/finance/money";
import { copyBudgets } from "@/app/actions/planning";
import { BudgetForm } from "./form";

export const metadata = { title: "Planejamento" };

export default async function Page({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<{ mes?: string }> }) {
  const [{ ws }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getWorkspace(ws);
  const L = await loadLedger(ws);
  const month = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? `${sp.mes}-01` : monthStart(L.today);
  const sb = await createClient();
  const [{ data: budgets }, { data: plan }] = await Promise.all([
    sb.from("budgets").select("category_id, amount").eq("workspace_id", ws).eq("month", month),
    sb.from("income_plans").select("*").eq("workspace_id", ws).eq("month", month).maybeSingle(),
  ]);
  const thresholds = ((ctx.ws.settings as { budget_thresholds?: number[] }).budget_thresholds ?? [...DEFAULT_THRESHOLDS]);
  const s = summarize(L.txs, month, monthEnd(month), { includePending: true });
  const realized = summarize(L.txs, month, monthEnd(month));
  const parents = L.categories.filter((c) => c.kind === "expense" && !c.parentId);
  const spentOf = (id: string, sum = s) => [id, ...L.categories.filter((c) => c.parentId === id).map((c) => c.id)].reduce((t, k) => t + (sum.byCategory.get(k) ?? 0), 0);
  const prev3 = [1, 2, 3].map((i) => { const m = addMonths(month, -i); return summarize(L.txs, m, monthEnd(m)); });
  const hasHistory = prev3.filter((p) => p.count).length >= 2;
  const bmap = new Map((budgets ?? []).map((b) => [b.category_id, toCents(b.amount)]));
  const rows = parents.map((c) => ({ id: c.id, name: c.name, amount: bmap.get(c.id) ?? null, spent: spentOf(c.id), avg: hasHistory ? average(prev3.map((p) => [c.id, ...L.categories.filter((k) => k.parentId === c.id).map((k) => k.id)].reduce((t, k) => t + (p.byCategory.get(k) ?? 0), 0))) : null }));
  const budgeted = rows.filter((r) => r.amount !== null);
  const totalBudget = budgeted.reduce((t, r) => t + (r.amount ?? 0), 0);
  const income = toCents(plan?.expected_income), savings = toCents(plan?.savings_target);
  const isCurrent = month === monthStart(L.today);
  const { d } = parts(L.today);
  const pace = isCurrent ? monthPaceEstimate(realized.expense, d, daysInMonth(parts(month).y, parts(month).m)) : null;
  const ym = (m: string) => m.slice(0, 7);
  const tone = (lvl: string) => (lvl === "over" ? "neg" : lvl === "high" || lvl === "attention" ? "warn" : "lime") as "neg" | "warn" | "lime";

  return (
    <>
      <PageHeader title="Planejamento" subtitle={`Alertas em ${thresholds.join("%, ")}% e ao ultrapassar — ajuste em Configurações.`}
        actions={<div className="flex items-center gap-1">
          <Link href={`?mes=${ym(addMonths(month, -1))}`} className="btn-secondary btn-sm px-2" aria-label="Mês anterior"><ChevronLeft size={16} /></Link>
          <span className="min-w-36 text-center text-[14px] font-medium">{cap(fmtMonth(month, true))}</span>
          <Link href={`?mes=${ym(addMonths(month, 1))}`} className="btn-secondary btn-sm px-2" aria-label="Próximo mês"><ChevronRight size={16} /></Link>
        </div>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
            <Stat label="Renda prevista" value={income} />
            <Stat label="Receitas registradas" value={s.income} tone="lime" help="Inclui receitas pendentes do mês." />
            <Stat label="Orçamento total" value={totalBudget} />
            <Stat label="Gasto registrado" value={s.expense} help="Inclui despesas pendentes do mês e compras no cartão da fatura do mês." />
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <div className="flex justify-between text-[13px] text-muted"><span>Planejado x realizado</span><span className="num">{totalBudget ? `${Math.round((s.expense / totalBudget) * 100)}%` : "—"}</span></div>
            <Progress className="mt-2" pct={totalBudget ? (s.expense / totalBudget) * 100 : 0} tone={totalBudget && s.expense > totalBudget ? "neg" : "lime"} />
            {savings > 0 && <p className="mt-3 text-[13px] text-muted">Meta de economia: <Money c={savings} /> · Sobra registrada até agora: <Money c={s.income - s.expense} tone="auto" /> {s.income - s.expense >= savings ? <Badge tone="lime">no caminho</Badge> : <Badge tone="warn">abaixo da meta</Badge>}</p>}
          </div>
        </Card>
        <Card className="p-5">
          <Stat label="Projeção de gastos no mês" value={pace ?? 0} estimate help="Estimativa linear: gasto efetivado até hoje dividido pelos dias corridos, multiplicado pelos dias do mês. Não considera contas específicas." />
          <p className="mt-3 text-[13px] leading-relaxed text-muted">{pace === null ? (isCurrent ? "Disponível a partir do 5º dia do mês." : "Projeção disponível apenas para o mês atual.") : totalBudget ? (pace > totalBudget ? "No ritmo atual, os gastos devem passar do orçamento total." : "No ritmo atual, os gastos cabem no orçamento total.") : "Defina limites por categoria para comparar."}</p>
          {ctx.canWrite && <div className="mt-4 flex flex-col gap-2">
            <Sheet title={`Planejar ${fmtMonth(month, true)}`} wide trigger={<button className="btn-primary w-full">{budgeted.length ? "Editar planejamento" : "Criar planejamento"}</button>}>
              <BudgetForm ws={ws} month={month} rows={rows} income={income} savings={savings} />
            </Sheet>
            {!budgeted.length && <form action={copyBudgets}><input type="hidden" name="ws" value={ws} /><input type="hidden" name="month" value={month} /><button className="btn-ghost btn-sm w-full">Copiar limites do mês anterior</button></form>}
          </div>}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Orçamento por categoria" subtitle="Gasto registrado (inclui subcategorias e pendentes)" />
        {budgeted.length ? (
          <div className="grid gap-x-8 px-5 pb-5 pt-2 md:grid-cols-2">
            {budgeted.sort((a, b) => b.spent / (b.amount || 1) - a.spent / (a.amount || 1)).map((r) => {
              const u = budgetUsage(r.spent, r.amount ?? 0, thresholds);
              return (
                <div key={r.id} className="border-t border-line py-3.5 md:[&:nth-child(-n+2)]:border-t-0 first:border-t-0">
                  <div className="flex items-center justify-between gap-3 text-[14px]">
                    <Link href={`${ctx.base}/movimentacoes?categoria=${r.id}&de=${month}&ate=${monthEnd(month)}`} className="truncate hover:underline">{r.name}</Link>
                    <span className="num shrink-0 text-muted"><Money c={r.spent} className="text-fg" /> / <Money c={r.amount ?? 0} /></span>
                  </div>
                  <Progress className="mt-2" pct={u.pct} tone={tone(u.level)} />
                  <div className="mt-1 flex justify-between text-[12px] text-faint"><span>{u.pct !== null ? `${Math.round(u.pct)}%` : ""}</span><span>{u.remaining >= 0 ? <>Resta <Money c={u.remaining} /></> : <span className="text-neg">Excedeu <Money c={-u.remaining} /></span>}</span></div>
                </div>
              );
            })}
          </div>
        ) : <Empty title="Nenhum limite definido para este mês" text="Defina quanto pretende gastar em cada categoria e receba alertas antes de estourar." />}
        {rows.some((r) => r.amount === null && r.spent > 0) && budgeted.length > 0 && (
          <div className="px-5 pb-5"><Notice>Categorias com gastos sem limite: {rows.filter((r) => r.amount === null && r.spent > 0).map((r) => r.name).join(", ")}.</Notice></div>
        )}
      </Card>
    </>
  );
}
