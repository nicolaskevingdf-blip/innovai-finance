import Link from "next/link";
import { Card, CardHeader, Empty, Money, Notice, PageHeader, Progress, Stat } from "@/components/ui";
import { BalanceArea, MonthlyBars } from "@/components/charts";
import { InsightCard } from "@/components/insight-card";
import { loadLedger } from "@/lib/data/ledger";
import { loadInsights } from "@/lib/data/insights";
import { businessSnapshot } from "@/lib/finance/snapshot";
import { forecastItems, projectCashflow } from "@/lib/finance/cashflow";
import { addDays, addMonths, fmtDate, fmtDayMonth, fmtMonth, monthEnd, monthStart } from "@/lib/finance/dates";
import { totalsByGroup, summarize } from "@/lib/finance/ledger";
import type { WorkspaceCtx } from "@/lib/data/workspace";
import { SEGMENTS } from "@/lib/templates";

export async function BusinessDashboard({ ctx }: { ctx: WorkspaceCtx }) {
  const L = await loadLedger(ctx.ws.id);
  const insights = await loadInsights(ctx, L);
  const st = ctx.ws.settings as { min_cash?: number; withdrawal_limit?: number };
  const b = businessSnapshot({ accounts: L.accounts, txs: L.txs, categories: L.categories, today: L.today, balances: L.balances });
  const items = forecastItems(L.txs, L.cards, L.today, addDays(L.today, 60));
  const proj = projectCashflow({ startBalance: b.balance, items, from: L.today, to: addDays(L.today, 60), granularity: "day", minCash: st.min_cash });
  const cats = new Map(L.categories.map((c) => [c.id, c]));
  const series = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(monthStart(L.today), -(5 - i));
    const s = summarize(L.txs, m, monthEnd(m), { includePending: true });
    const g = totalsByGroup(L.txs, cats, m, monthEnd(m));
    return { label: fmtMonth(m), income: s.income, expense: g.cost + g.fixed + g.variable + g.other + g.personal + g.uncategorized };
  });
  const segment = SEGMENTS.find((s) => s.value === ctx.ws.segment)?.label;
  const pct = (a: number, p: number) => (p ? `${a >= p ? "+" : ""}${Math.round(((a - p) / p) * 100)}% vs mês anterior` : undefined);
  const hasData = L.txs.length > 0;

  return (
    <>
      <PageHeader eyebrow={`${segment ?? "Empresa"} · ${fmtMonth(L.today, true)}`} title={ctx.ws.trade_name || ctx.ws.name} subtitle={hasData ? undefined : "Registre vendas, despesas e contas a pagar para ver o desempenho do negócio."} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <div className="grid gap-6 sm:grid-cols-2">
            <Stat size="lg" label="Saldo atual" value={b.balance} tone="auto" help="Soma dos saldos das contas da empresa (bancos e caixa), com base nos lançamentos efetivados." />
            <Stat size="lg" label="Capital de giro (30 dias)" value={b.workingCapital30} tone="auto" estimate help="Saldo atual + valores a receber em 30 dias − contas a pagar em 30 dias (inclui vencidos). Mostra a folga de caixa no curto prazo." />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-line pt-5 sm:grid-cols-3">
            <Stat label="Faturamento registrado" value={b.revenue} sub={pct(b.revenue, b.prev.revenue)} help="Vendas e serviços lançados no mês (competência), recebidos ou não." />
            <Stat label="Recebido" value={b.received} tone="lime" help="Dinheiro que efetivamente entrou nas contas no mês." />
            <Stat label="Custos" value={b.costs} help="Mercadorias, matéria-prima, insumos e embalagens lançados no mês." />
            <Stat label="Despesas" value={b.expenses} help="Despesas fixas e variáveis do mês. Não inclui investimentos nem retiradas." />
            <Stat label="Resultado estimado" value={b.estimatedResult} tone="auto" estimate sub={pct(b.estimatedResult, b.prev.estimatedResult)} help="Faturamento − custos − despesas, por competência. Não é lucro contábil oficial: depende de tudo estar lançado." />
            <Stat label="Resultado de caixa" value={b.cashResult} tone="auto" help="Recebido − pago no mês (regime de caixa). Inclui pagamento de faturas." />
          </div>
        </Card>
        <div className="grid gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between"><span className="eyebrow">Contas a pagar</span><Link href={`${ctx.base}/financeiro?aba=pagar`} className="text-[12.5px] text-muted hover:text-fg">Abrir</Link></div>
            <div className="num mt-2 text-[22px] font-semibold"><Money c={b.payables.open} /></div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[12px] text-faint">
              <div><div className={b.payables.overdue ? "text-neg" : ""}><Money c={b.payables.overdue} /></div>vencido</div>
              <div><div className="text-fg/80"><Money c={b.payables.next7} /></div>7 dias</div>
              <div><div className="text-fg/80"><Money c={b.payables.next30} /></div>30 dias</div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between"><span className="eyebrow">Contas a receber</span><Link href={`${ctx.base}/financeiro?aba=receber`} className="text-[12.5px] text-muted hover:text-fg">Abrir</Link></div>
            <div className="num mt-2 text-[22px] font-semibold text-lime"><Money c={b.receivables.open} /></div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[12px] text-faint">
              <div><div className={b.receivables.overdue ? "text-warn" : ""}><Money c={b.receivables.overdue} /></div>em atraso</div>
              <div><div className="text-fg/80"><Money c={b.receivables.next7} /></div>7 dias</div>
              <div><div className="text-fg/80"><Money c={b.receivables.next30} /></div>30 dias</div>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Caixa projetado — 60 dias" subtitle={`Menor saldo: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(proj.lowest.balance / 100)} em ${fmtDate(proj.lowest.date)} · baseado em contas cadastradas`} action={<Link href={`${ctx.base}/fluxo`} className="text-[13px] text-muted hover:text-fg">Detalhar</Link>} />
          <div className="px-3 pb-4 pt-3"><BalanceArea data={proj.buckets.map((x) => ({ label: fmtDayMonth(x.start), balance: x.closing }))} min={st.min_cash ?? null} /></div>
          {st.min_cash == null && <div className="px-5 pb-5"><Notice>Defina um <Link href={`${ctx.base}/configuracoes`} className="underline">caixa mínimo de segurança</Link> para receber alertas de risco.</Notice></div>}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Faturamento x custos e despesas" subtitle="Por competência, últimos 6 meses" />
          <div className="px-3 pb-4 pt-3">{hasData ? <MonthlyBars data={series} incomeLabel="Faturamento" expenseLabel="Custos + despesas" /> : <Empty title="Sem histórico ainda" />}</div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="eyebrow">Retiradas do proprietário (mês)</div>
          <div className="num mt-2 text-[22px] font-semibold"><Money c={b.withdrawals} /></div>
          {st.withdrawal_limit ? (<><Progress className="mt-3" pct={(b.withdrawals / st.withdrawal_limit) * 100} tone={b.withdrawals > st.withdrawal_limit ? "neg" : "lime"} /><div className="mt-1.5 text-[12.5px] text-faint">Limite definido: <Money c={st.withdrawal_limit} /></div></>)
            : <p className="mt-2 text-[13px] text-muted">Defina um limite mensal em <Link href={`${ctx.base}/configuracoes`} className="underline">Configurações</Link> para separar melhor empresa e proprietário.</p>}
        </Card>
        <Card className="p-5">
          <div className="eyebrow">Investimentos no negócio (mês)</div>
          <div className="num mt-2 text-[22px] font-semibold"><Money c={b.investments} /></div>
          <p className="mt-2 text-[13px] text-muted">Equipamentos, reformas e expansão ficam fora do resultado operacional.</p>
        </Card>
        <Card className="p-5">
          <div className="eyebrow">Atalhos</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={`${ctx.base}/caixa`} className="btn-secondary btn-sm">Fechar caixa</Link>
            <Link href={`${ctx.base}/financeiro?aba=pagar`} className="btn-secondary btn-sm">A pagar</Link>
            <Link href={`${ctx.base}/relatorios`} className="btn-secondary btn-sm">Relatórios</Link>
            <Link href={`${ctx.base}/inteligencia`} className="btn-secondary btn-sm">Perguntar à IA</Link>
          </div>
        </Card>
      </div>

      {insights.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-[15px] font-semibold">Inteligência Innovai</h2><Link href={`${ctx.base}/inteligencia`} className="text-[13px] text-muted hover:text-fg">Ver tudo</Link></div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{insights.slice(0, 3).map((i) => <InsightCard key={i.key} i={i} ws={ctx.ws.id} compact />)}</div>
        </section>
      )}
    </>
  );
}
