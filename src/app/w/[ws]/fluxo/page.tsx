import { getWorkspace } from "@/lib/data/workspace";
import { loadLedger } from "@/lib/data/ledger";
import { Badge, Card, CardHeader, Empty, Money, Notice, PageHeader, Stat } from "@/components/ui";
import { BalanceArea } from "@/components/charts-lazy";
import { addDays, diffDays, fmtDate, fmtDayMonth, isISODate } from "@/lib/finance/dates";
import { forecastItems, projectCashflow, type Granularity } from "@/lib/finance/cashflow";

export const metadata = { title: "Fluxo de caixa" };

export default async function Page({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<{ h?: string; g?: string; de?: string; ate?: string }> }) {
  const [{ ws }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getWorkspace(ws);
  const L = await loadLedger(ws);
  const minCash = (ctx.ws.settings as { min_cash?: number }).min_cash;
  const horizon = ["7", "30", "60", "90"].includes(sp.h ?? "") ? Number(sp.h) : 30;
  const custom = isISODate(sp.ate) && sp.ate > L.today;
  const to = custom ? sp.ate! : addDays(L.today, horizon);
  const span = diffDays(L.today, to);
  const g: Granularity = (["day", "week", "month"] as const).includes(sp.g as Granularity) ? (sp.g as Granularity) : span <= 31 ? "day" : span <= 92 ? "week" : "month";
  const start = [...L.balances.values()].reduce((a, b) => a + b, 0);
  const items = forecastItems(L.txs, L.cards, L.today, to);
  const r = projectCashflow({ startBalance: start, items, from: L.today, to, granularity: g, minCash });
  const daily = projectCashflow({ startBalance: start, items, from: L.today, to, granularity: "day", minCash });
  const inflow = items.filter((i) => i.amount > 0).reduce((t, i) => t + i.amount, 0), outflow = items.filter((i) => i.amount < 0).reduce((t, i) => t - i.amount, 0);
  const overdue = items.filter((i) => i.overdue);
  const qs = (o: Record<string, string>) => "?" + new URLSearchParams({ h: String(horizon), g, ...o });
  return (
    <>
      <PageHeader title="Fluxo de caixa" subtitle="Projeção usando somente saldos atuais, contas a pagar/receber e faturas cadastradas. Nada é inventado." />
      <div className="mb-4 flex flex-wrap items-end gap-2">
        {[7, 30, 60, 90].map((h) => <a key={h} href={qs({ h: String(h), g: "" }).replace("&g=", "")} data-active={!custom && h === horizon} className="chip">{h} dias</a>)}
        <span className="mx-1 h-6 w-px bg-line" />
        {(["day", "week", "month"] as const).map((x) => <a key={x} href={qs({ g: x, ...(custom ? { ate: to } : {}) })} data-active={g === x} className="chip">{x === "day" ? "Diário" : x === "week" ? "Semanal" : "Mensal"}</a>)}
        <form method="get" className="flex items-end gap-2"><input type="hidden" name="g" value={g} /><input type="date" name="ate" min={addDays(L.today, 1)} defaultValue={custom ? to : ""} className="input h-9 w-40 text-[13px]" /><button className="btn-secondary btn-sm">Período</button></form>
      </div>
      <Card className="grid grid-cols-2 gap-x-4 gap-y-5 p-4 sm:grid-cols-5 sm:p-5">
        <Stat label="Saldo inicial (hoje)" value={start} />
        <Stat label="Entradas previstas" value={inflow} tone="lime" />
        <Stat label="Saídas previstas" value={outflow} />
        <Stat label={`Saldo final (${fmtDate(to)})`} value={start + inflow - outflow} tone="auto" estimate />
        <Stat label="Menor saldo" value={daily.lowest.balance} tone="auto" sub={fmtDate(daily.lowest.date)} />
      </Card>
      {daily.riskStart && <div className="mt-4"><Notice tone="warn">Período de risco: o saldo projetado fica abaixo do caixa mínimo ({minCash !== undefined && <Money c={minCash} />}) a partir de <b>{fmtDate(daily.riskStart)}</b>.</Notice></div>}
      {minCash === undefined && <div className="mt-4"><Notice>Defina um caixa mínimo em Configurações para destacar períodos de risco.</Notice></div>}
      {overdue.length > 0 && <div className="mt-4"><Notice tone="warn">{overdue.length} item(ns) vencido(s) foram considerados para hoje. Atualize o status para manter a projeção precisa.</Notice></div>}
      <Card className="mt-4"><CardHeader title="Saldo projetado" /><div className="px-3 pb-4 pt-3"><BalanceArea data={daily.buckets.map((b) => ({ label: fmtDayMonth(b.start), balance: b.closing }))} min={minCash ?? null} height={240} /></div></Card>
      <Card className="mt-4">
        <CardHeader title={g === "day" ? "Por dia" : g === "week" ? "Por semana" : "Por mês"} />
        <div className="overflow-x-auto px-2 pb-3 pt-2"><table className="w-full text-[13.5px]">
          <thead><tr className="text-left text-[12px] text-faint"><th className="px-3 py-2 font-normal">{g === "day" ? "Dia" : "Início"}</th><th className="hidden px-3 py-2 text-right font-normal sm:table-cell">Saldo inicial</th><th className="px-3 py-2 text-right font-normal">Entradas</th><th className="px-3 py-2 text-right font-normal">Saídas</th><th className="px-3 py-2 text-right font-normal">Saldo final</th></tr></thead>
          <tbody>{r.buckets.filter((b) => g !== "day" || b.inflow || b.outflow || b.start === L.today).map((b) => (
            <tr key={b.start} className="border-t border-line"><td className="px-3 py-2.5">{fmtDayMonth(b.start)} {b.belowMin && <span className="ml-1 inline-block size-2 rounded-full bg-warn align-middle" title="Abaixo do caixa mínimo" />}</td><td className="num hidden px-3 py-2.5 text-right text-muted sm:table-cell"><Money c={b.opening} /></td><td className="num px-3 py-2.5 text-right text-lime">{b.inflow ? <Money c={b.inflow} /> : "—"}</td><td className="num px-3 py-2.5 text-right">{b.outflow ? <Money c={-b.outflow} /> : "—"}</td><td className="num px-3 py-2.5 text-right font-medium"><Money c={b.closing} tone="auto" /></td></tr>
          ))}</tbody>
        </table></div>
      </Card>
      <Card className="mt-4">
        <CardHeader title="Lançamentos considerados" />
        {items.length ? <div className="px-5 pb-4 pt-2">{items.map((i, k) => <div key={k} className="flex items-center justify-between gap-3 border-t border-line py-2 text-[14px] first:border-t-0"><span className="min-w-0 truncate"><span className="text-faint">{fmtDayMonth(i.date)}</span> · {i.label} {i.overdue && <Badge tone="neg">vencido</Badge>}</span><Money c={i.amount} tone="auto" /></div>)}</div> : <Empty title="Nenhuma conta futura cadastrada" text="Cadastre contas a pagar e a receber para projetar o caixa." />}
      </Card>
    </>
  );
}
