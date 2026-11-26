import { Flag, Plus } from "lucide-react";
import { getWorkspace } from "@/lib/data/workspace";
import { loadLedger } from "@/lib/data/ledger";
import { loadGoals } from "@/lib/data/insights";
import { Badge, Card, Empty, Money, Notice, PageHeader, Progress } from "@/components/ui";
import { ConfirmSubmit, Sheet } from "@/components/client";
import { addMonths, fmtDate, fmtMonth, monthEnd, monthStart, cap } from "@/lib/finance/dates";
import { summarize } from "@/lib/finance/ledger";
import { formatBRL } from "@/lib/finance/money";
import { archiveGoal } from "@/app/actions/finance";
import { ContributionForm, GoalForm } from "./forms";

export const metadata = { title: "Metas" };

export default async function Page({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const ctx = await getWorkspace(ws);
  const L = await loadLedger(ws);
  const goals = await loadGoals(ws, L.today);
  const closed = [1, 2, 3].map((i) => { const m = addMonths(monthStart(L.today), -i); return summarize(L.txs, m, monthEnd(m)); }).filter((s) => s.count);
  const avgSurplus = closed.length >= 2 ? Math.round(closed.reduce((t, s) => t + s.net, 0) / closed.length) : null;
  const needed = goals.reduce((t, g) => t + (g.projection.monthlyNeeded ?? 0), 0);
  return (
    <>
      <PageHeader title="Metas" subtitle="Objetivos com aportes, progresso e projeção de conclusão baseada nos seus aportes reais."
        actions={ctx.canWrite && <Sheet title="Nova meta" trigger={<button className="btn-primary btn-sm"><Plus size={16} /> Nova meta</button>}><GoalForm ws={ws} /></Sheet>} />
      {avgSurplus !== null && goals.length > 0 && (
        <div className="mb-4"><Notice tone={avgSurplus >= needed ? "lime" : "warn"}>
          Nos últimos {closed.length} meses fechados, sua sobra média foi de <b>{formatBRL(avgSurplus)}</b>/mês. Suas metas com prazo pedem <b>{formatBRL(needed)}</b>/mês no total.
          {avgSurplus < needed ? " Considere revisar prazos ou reduzir gastos nas maiores categorias." : " Sua sobra média cobre os aportes necessários."}
        </Notice></div>
      )}
      {goals.length === 0 ? <Card><Empty icon={<Flag size={18} />} title="Nenhuma meta ainda" text="Crie uma meta para acompanhar quanto falta e quando você deve chegar lá." /></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => {
            const p = g.projection;
            return (
              <Card key={g.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h3 className="truncate text-[16px] font-semibold">{g.name}</h3><p className="text-[13px] text-faint">{g.targetDate ? `Prazo: ${fmtDate(g.targetDate)}` : "Sem prazo definido"}</p></div>
                  {p.remaining === 0 ? <Badge tone="lime">Concluída</Badge> : p.onTrack === true ? <Badge tone="lime">No ritmo</Badge> : p.onTrack === false ? <Badge tone="warn">Abaixo do ritmo</Badge> : null}
                </div>
                <div className="mt-4 flex items-end justify-between"><Money c={p.saved} className="text-[24px] font-semibold" /><span className="num text-[13px] text-muted">de {formatBRL(g.target)}</span></div>
                <Progress className="mt-2" pct={p.pct} />
                <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
                  <div><div className="text-faint">Falta</div><Money c={p.remaining} /></div>
                  <div><div className="text-faint">Necessário por mês</div>{p.monthlyNeeded !== null ? <Money c={p.monthlyNeeded} /> : <span className="text-muted">defina um prazo</span>}</div>
                  <div><div className="text-faint">Aporte médio recente</div>{p.avgMonthlyContribution !== null ? <Money c={p.avgMonthlyContribution} /> : <span className="text-muted">poucos aportes</span>}</div>
                  <div><div className="text-faint">Conclusão projetada</div><span>{p.projectedDate ? cap(fmtMonth(p.projectedDate, true)) : "—"}</span></div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {ctx.canWrite && <Sheet title={`Aporte em ${g.name}`} trigger={<button className="btn-primary btn-sm">Registrar aporte</button>}>
                    <ContributionForm ws={ws} goalId={g.id} today={L.today} />
                    <div className="mt-5 border-t border-line pt-4"><div className="eyebrow mb-2">Histórico</div>
                      {g.contributions.length ? g.contributions.slice(0, 20).map((c) => <div key={c.id} className="flex justify-between py-1.5 text-[13.5px]"><span className="text-muted">{fmtDate(c.date)}{c.note ? ` · ${c.note}` : ""}</span><Money c={c.amount} tone="auto" /></div>) : <p className="text-[13px] text-muted">Sem aportes.</p>}
                    </div>
                  </Sheet>}
                  {ctx.canWrite && <Sheet title="Editar meta" trigger={<button className="btn-secondary btn-sm">Editar</button>}><GoalForm ws={ws} g={g} /></Sheet>}
                  {ctx.canWrite && <form action={archiveGoal}><input type="hidden" name="ws" value={ws} /><input type="hidden" name="id" value={g.id} /><ConfirmSubmit message="Arquivar esta meta?" className="btn-ghost btn-sm">Arquivar</ConfirmSubmit></form>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-[12.5px] text-faint">Aportes em metas são controles de reserva: registre também a transferência para a conta onde o dinheiro está guardado, se aplicável.</p>
    </>
  );
}
