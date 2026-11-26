import { getWorkspace } from "@/lib/data/workspace";
import { loadLedger } from "@/lib/data/ledger";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, Empty, Money, PageHeader } from "@/components/ui";
import { MonthlyBars } from "@/components/charts";
import { addDays, addMonths, diffDays, fmtDate, fmtMonth, isISODate, monthEnd, monthsBetween, monthStart } from "@/lib/finance/dates";
import { cashMovements, summarize, totalsByGroup } from "@/lib/finance/ledger";
import { buildInvoices } from "@/lib/finance/cards";
import { obligationTotals } from "@/lib/finance/obligations";
import { toCents } from "@/lib/finance/money";
import type { Tx } from "@/lib/finance/types";
import { PrintButton } from "./print";

export const metadata = { title: "Relatórios" };

function Delta({ cur, prev, inverse }: { cur: number; prev: number; inverse?: boolean }) {
  if (!prev) return <span className="text-faint">—</span>;
  const p = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  const good = inverse ? p <= 0 : p >= 0;
  return <span className={p === 0 ? "text-faint" : good ? "text-lime" : "text-neg"}>{p > 0 ? "+" : ""}{p}%</span>;
}

export default async function Page({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<{ de?: string; ate?: string; p?: string }> }) {
  const [{ ws }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getWorkspace(ws);
  const L = await loadLedger(ws, 25);
  const preset = sp.p ?? (sp.de ? "custom" : "month");
  let from = monthStart(L.today), to = monthEnd(L.today);
  if (preset === "last") { from = addMonths(monthStart(L.today), -1); to = monthEnd(from); }
  if (preset === "3m") { from = addMonths(monthStart(L.today), -2); }
  if (preset === "12m") { from = addMonths(monthStart(L.today), -11); }
  if (preset === "year") { from = `${L.today.slice(0, 4)}-01-01`; to = `${L.today.slice(0, 4)}-12-31`; }
  if (preset === "custom" && isISODate(sp.de) && isISODate(sp.ate) && sp.de <= sp.ate) { from = sp.de; to = sp.ate; }
  const len = diffDays(from, to);
  // Períodos em meses cheios comparam com os meses cheios anteriores; demais, com o mesmo número de dias.
  const fullMonths = from === monthStart(from) && to === monthEnd(to);
  const nMonths = monthsBetween(from, to) + 1;
  const pTo = fullMonths ? monthEnd(addMonths(from, -1)) : addDays(from, -1);
  const pFrom = fullMonths ? addMonths(from, -nMonths) : addDays(pTo, -len);
  const cur = summarize(L.txs, from, to, { includePending: true });
  const prev = summarize(L.txs, pFrom, pTo, { includePending: true });
  const names = new Map(L.categories.map((c) => [c.id, c]));
  const kind = ctx.ws.kind;
  const parentOf = (id: string | null) => { const c = id ? names.get(id) : null; return c?.parentId ?? id; };
  const roll = (m: Map<string | null, number>, k: "income" | "expense") => {
    const out = new Map<string | null, number>();
    for (const [id, v] of m) { const c = id ? names.get(id) : null; if (c && c.kind !== k) continue; const p = parentOf(id); out.set(p, (out.get(p) ?? 0) + v); }
    return out;
  };
  const expCur = roll(summarize(L.txs, from, to, { includePending: true, kind: "expense" }).byCategory, "expense");
  const expPrev = roll(summarize(L.txs, pFrom, pTo, { includePending: true, kind: "expense" }).byCategory, "expense");
  const incCur = roll(summarize(L.txs, from, to, { includePending: true, kind: "income" }).byCategory, "income");
  const incPrev = roll(summarize(L.txs, pFrom, pTo, { includePending: true, kind: "income" }).byCategory, "income");
  const months = Math.min(12, Math.max(6, Math.round(len / 30) + 1));
  const series = Array.from({ length: months }, (_, i) => { const m = addMonths(monthStart(to), -(months - 1 - i)); const s = summarize(L.txs, m, monthEnd(m), { includePending: true }); return { label: fmtMonth(m), income: s.income, expense: s.expense }; });
  const exportUrl = `/api/exportar/movimentacoes?ws=${ws}&de=${from}&ate=${to}`;
  const presets = [["month", "Este mês"], ["last", "Mês passado"], ["3m", "3 meses"], ["12m", "12 meses"], ["year", "Ano atual"]];

  const CatTable = ({ title, curM, prevM, total, inverse }: { title: string; curM: Map<string | null, number>; prevM: Map<string | null, number>; total: number; inverse?: boolean }) => {
    const rows = [...new Set([...curM.keys(), ...prevM.keys()])].map((id) => ({ id, name: id ? names.get(id)?.name ?? "—" : "Sem categoria", v: curM.get(id) ?? 0, p: prevM.get(id) ?? 0 })).filter((r) => r.v || r.p).sort((a, b) => b.v - a.v);
    return (
      <Card>
        <CardHeader title={title} subtitle="Inclui lançamentos pendentes do período; compras no cartão pelo mês da fatura" />
        {rows.length ? (
          <div className="overflow-x-auto px-2 pb-3 pt-2">
            <table className="w-full text-[13.5px]">
              <thead><tr className="text-left text-[12px] text-faint"><th className="px-3 py-2 font-normal">Categoria</th><th className="px-3 py-2 text-right font-normal">Valor</th><th className="px-3 py-2 text-right font-normal">%</th><th className="px-3 py-2 text-right font-normal">Anterior</th><th className="px-3 py-2 text-right font-normal">Var.</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id ?? "none"} className="border-t border-line">
                  <td className="px-3 py-2.5"><div>{r.name}</div><div className="mt-1 h-1 rounded-full bg-surface-3"><div className="h-1 rounded-full bg-lime/70" style={{ width: `${total ? Math.min(100, (r.v / total) * 100) : 0}%` }} /></div></td>
                  <td className="num px-3 py-2.5 text-right"><Money c={r.v} /></td>
                  <td className="num px-3 py-2.5 text-right text-muted">{total ? Math.round((r.v / total) * 100) : 0}%</td>
                  <td className="num px-3 py-2.5 text-right text-muted"><Money c={r.p} /></td>
                  <td className="num px-3 py-2.5 text-right"><Delta cur={r.v} prev={r.p} inverse={inverse} /></td>
                </tr>))}</tbody>
            </table>
          </div>
        ) : <Empty title="Sem lançamentos no período" />}
      </Card>
    );
  };

  let business: React.ReactNode = null, personal: React.ReactNode = null;
  if (kind === "business") {
    const g = totalsByGroup(L.txs, names, from, to), gp = totalsByGroup(L.txs, names, pFrom, pTo);
    const exp = (x: typeof g) => x.fixed + x.variable + x.other + x.personal + x.uncategorized;
    const cash = cashMovements(L.txs, from, to);
    const line = (label: string, c: number, p: number, opts: { strong?: boolean; neg?: boolean; inverse?: boolean } = {}) => (
      <tr className="border-t border-line"><td className={`px-4 py-2.5 ${opts.strong ? "font-semibold" : "text-muted"}`}>{label}</td><td className={`num px-4 py-2.5 text-right ${opts.strong ? "font-semibold" : ""}`}><Money c={opts.neg ? -c : c} tone={opts.strong ? "auto" : "none"} /></td><td className="num px-4 py-2.5 text-right text-muted"><Money c={opts.neg ? -p : p} /></td><td className="num px-4 py-2.5 text-right"><Delta cur={c} prev={p} inverse={opts.inverse} /></td></tr>
    );
    const pay = obligationTotals(L.txs, "expense", L.today), rec = obligationTotals(L.txs, "income", L.today);
    const byContact = (k: "income" | "expense") => { const m = new Map<string, number>(); for (const t of L.txs) if (t.type === k && t.contactId && t.status !== "canceled" && t.competenceDate >= from && t.competenceDate <= to) m.set(t.contactId, (m.get(t.contactId) ?? 0) + t.amount); return m; };
    const sb = await createClient();
    const { data: contacts } = await sb.from("contacts").select("id,name").eq("workspace_id", ws);
    const cn = new Map((contacts ?? []).map((c) => [c.id, c.name]));
    const { data: closings } = await sb.from("cash_closings").select("date,difference").eq("workspace_id", ws).gte("date", from).lte("date", to);
    const diffs = (closings ?? []).reduce((t, c) => t + toCents(c.difference), 0);
    const topC = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    business = (
      <>
        <Card className="mt-4">
          <CardHeader title="Resultado gerencial (competência)" subtitle="Estimativa baseada nos lançamentos e nos grupos das categorias — não substitui a contabilidade oficial" />
          <div className="overflow-x-auto px-1 pb-3 pt-2"><table className="w-full text-[14px]">
            <thead><tr className="text-left text-[12px] text-faint"><th className="px-4 py-2 font-normal" /><th className="px-4 py-2 text-right font-normal">Período</th><th className="px-4 py-2 text-right font-normal">Anterior</th><th className="px-4 py-2 text-right font-normal">Var.</th></tr></thead>
            <tbody>
              {line("Faturamento registrado", cur.income, prev.income)}
              {line("(−) Custos operacionais", g.cost, gp.cost, { neg: true, inverse: true })}
              {line("= Margem de contribuição estimada", cur.income - g.cost, prev.income - gp.cost, { strong: true })}
              {line("(−) Despesas fixas", g.fixed, gp.fixed, { neg: true, inverse: true })}
              {line("(−) Despesas variáveis e outras", g.variable + g.other + g.uncategorized, gp.variable + gp.other + gp.uncategorized, { neg: true, inverse: true })}
              {g.personal > 0 && line("(−) Despesas pessoais pagas pela empresa", g.personal, gp.personal, { neg: true, inverse: true })}
              {line("= Resultado operacional estimado", cur.income - g.cost - exp(g), prev.income - gp.cost - exp(gp), { strong: true })}
              {line("(−) Investimentos", g.investment, gp.investment, { neg: true })}
              {line("(−) Retiradas e pró-labore", g.withdrawal, gp.withdrawal, { neg: true })}
              {line("= Resultado após retiradas e investimentos", cur.income - g.cost - exp(g) - g.investment - g.withdrawal, prev.income - gp.cost - exp(gp) - gp.investment - gp.withdrawal, { strong: true })}
            </tbody>
          </table></div>
        </Card>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Card className="p-5"><div className="eyebrow mb-3">Caixa no período</div><div className="space-y-1.5 text-[14px]"><div className="flex justify-between"><span className="text-muted">Recebido</span><Money c={cash.inflow} /></div><div className="flex justify-between"><span className="text-muted">Pago</span><Money c={cash.outflow} /></div><div className="flex justify-between border-t border-line pt-1.5 font-semibold"><span>Resultado de caixa</span><Money c={cash.net} tone="auto" /></div>{(closings ?? []).length > 0 && <div className="flex justify-between pt-1.5 text-[13px]"><span className="text-muted">Diferenças de caixa ({closings!.length} fechamentos)</span><Money c={diffs} tone="auto" /></div>}</div></Card>
          <Card className="p-5"><div className="eyebrow mb-3">Contas a pagar (hoje)</div><div className="space-y-1.5 text-[14px]"><div className="flex justify-between"><span className="text-muted">Em aberto</span><Money c={pay.open} /></div><div className="flex justify-between"><span className="text-muted">Vencidas</span><Money c={pay.overdue} /></div><div className="flex justify-between"><span className="text-muted">Próximos 30 dias</span><Money c={pay.next30} /></div></div></Card>
          <Card className="p-5"><div className="eyebrow mb-3">Contas a receber (hoje)</div><div className="space-y-1.5 text-[14px]"><div className="flex justify-between"><span className="text-muted">Em aberto</span><Money c={rec.open} /></div><div className="flex justify-between"><span className="text-muted">Inadimplência registrada</span><Money c={rec.overdue} /></div><div className="flex justify-between"><span className="text-muted">Próximos 30 dias</span><Money c={rec.next30} /></div></div></Card>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {([["Principais clientes", topC(byContact("income"))], ["Principais fornecedores", topC(byContact("expense"))]] as const).map(([t, rows]) => (
            <Card key={t}><CardHeader title={t} />{rows.length ? <div className="px-5 pb-4 pt-2">{rows.map(([id, v]) => <div key={id} className="flex justify-between border-t border-line py-2 text-[14px] first:border-t-0"><span>{cn.get(id)}</span><Money c={v} /></div>)}</div> : <p className="px-5 pb-5 pt-2 text-[13.5px] text-muted">Vincule clientes e fornecedores aos lançamentos para ver este ranking.</p>}</Card>
          ))}
        </div>
      </>
    );
  } else {
    const byAcc = L.accounts.map((a) => { let i = 0, o = 0; for (const t of L.txs as Tx[]) { if (t.status !== "paid" || !t.paidAt || t.paidAt < from || t.paidAt > to) continue; if (t.type === "income" && t.accountId === a.id) i += t.amount; if ((t.type === "expense" || t.type === "card_payment") && t.accountId === a.id) o += t.amount; } return { a, i, o }; }).filter((x) => x.i || x.o);
    const cardRows = L.cards.map((c) => { const inv = buildInvoices(c, L.txs, L.today); const inPeriod = inv.filter((x) => x.month >= monthStart(from) && x.month <= to).reduce((t, x) => t + x.total, 0); const futureInst = inv.filter((x) => x.month > to).reduce((t, x) => t + x.remaining, 0); return { c, inPeriod, futureInst }; });
    personal = (
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card><CardHeader title="Por conta" subtitle="Entradas e saídas efetivadas no período" />{byAcc.length ? <div className="px-5 pb-4 pt-2">{byAcc.map(({ a, i, o }) => <div key={a.id} className="flex items-center justify-between border-t border-line py-2.5 text-[14px] first:border-t-0"><span>{a.name}</span><span className="num text-right"><span className="text-lime">+<Money c={i} /></span> <span className="text-muted">/ −<Money c={o} /></span></span></div>)}</div> : <Empty title="Sem movimentações" />}</Card>
        <Card><CardHeader title="Cartões e parcelamentos" subtitle="Faturas do período e parcelas já comprometidas para depois" />{cardRows.length ? <div className="px-5 pb-4 pt-2">{cardRows.map(({ c, inPeriod, futureInst }) => <div key={c.id} className="border-t border-line py-2.5 text-[14px] first:border-t-0"><div className="flex justify-between"><span>{c.name}</span><Money c={inPeriod} /></div><div className="flex justify-between text-[12.5px] text-faint"><span>Parcelas após o período</span><Money c={futureInst} /></div></div>)}</div> : <Empty title="Sem cartões" />}</Card>
      </div>
    );
  }

  return (
    <div className="print-area">
      <PageHeader title="Relatórios" subtitle={`${fmtDate(from)} a ${fmtDate(to)} · comparado a ${fmtDate(pFrom)}–${fmtDate(pTo)}`} actions={<><a href={exportUrl} className="btn-secondary btn-sm">Exportar Excel (CSV)</a><PrintButton /></>} />
      <div className="no-print mb-5 flex flex-wrap items-end gap-2">
        {presets.map(([k, l]) => <a key={k} href={`?p=${k}`} data-active={preset === k} className="chip">{l}</a>)}
        <form method="get" className="flex items-end gap-2"><input type="date" name="de" defaultValue={from} className="input h-9 w-40 text-[13px]" /><input type="date" name="ate" defaultValue={to} className="input h-9 w-40 text-[13px]" /><button className="btn-secondary btn-sm">Aplicar</button></form>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[["Receitas" + (kind === "business" ? " / faturamento" : ""), cur.income, prev.income, false], ["Despesas", cur.expense, prev.expense, true], ["Resultado", cur.net, prev.net, false]].map(([l, c, p, inv]) => (
          <Card key={l as string} className="p-4 sm:p-5"><div className="text-[12.5px] text-muted sm:text-[13px]">{l as string}</div><Money c={c as number} tone={l === "Resultado" ? "auto" : "none"} className="mt-1 block text-[17px] font-semibold sm:text-[22px]" /><div className="mt-1 text-[12px]"><Delta cur={c as number} prev={p as number} inverse={inv as boolean} /> <span className="text-faint">vs anterior</span></div></Card>
        ))}
      </div>
      <Card className="mt-4"><CardHeader title="Evolução mensal" subtitle="Receitas e despesas por competência (inclui pendentes)" /><div className="px-3 pb-4 pt-3"><MonthlyBars data={series} /></div></Card>
      {business}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CatTable title="Despesas por categoria" curM={expCur} prevM={expPrev} total={cur.expense} inverse />
        <CatTable title={kind === "business" ? "Faturamento por categoria" : "Receitas por categoria"} curM={incCur} prevM={incPrev} total={cur.income} />
      </div>
      {personal}
    </div>
  );
}
