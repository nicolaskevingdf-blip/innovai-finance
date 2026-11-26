import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Building2 } from "lucide-react";
import { Badge, Card, CardHeader, Empty, Help, MiniStat, Money, Notice, Progress, SectionTitle, Stat } from "@/components/ui";
import { BalanceArea, MonthlyBars } from "@/components/charts-lazy";
import { FirstSteps } from "@/components/first-steps";
import { InsightCard } from "@/components/insight-card";
import { loadLedger } from "@/lib/data/ledger";
import { loadInsights } from "@/lib/data/insights";
import { businessSnapshot } from "@/lib/finance/snapshot";
import { forecastItems, projectCashflow } from "@/lib/finance/cashflow";
import { addDays, addMonths, fmtDate, fmtDayMonth, fmtMonth, monthEnd, monthStart } from "@/lib/finance/dates";
import { formatBRL } from "@/lib/finance/money";
import { totalsByGroup, summarize } from "@/lib/finance/ledger";
import type { WorkspaceCtx } from "@/lib/data/workspace";
import { SEGMENTS } from "@/lib/templates";

const link = "text-[13px] font-medium text-muted hover:text-fg";

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
  const vs = (a: number, p: number) => (p ? `${a >= p ? "+" : ""}${Math.round(((a - p) / Math.abs(p)) * 100)}% vs mês anterior` : undefined);
  const hasData = L.txs.length > 0;
  const toReceive = b.revenue - b.received;
  const breakdown = [
    { label: "Custos operacionais", value: b.costs, hint: "Mercadorias, insumos, embalagens" },
    { label: "Despesas fixas e variáveis", value: b.expenses, hint: "Aluguel, salários, taxas, marketing…" },
    { label: "Investimentos", value: b.investments, hint: "Fora do resultado operacional" },
    { label: "Retiradas do proprietário", value: b.withdrawals, hint: st.withdrawal_limit ? `Limite: ${formatBRL(st.withdrawal_limit)}` : "Defina um limite em Configurações" },
  ];
  const maxBreak = Math.max(1, ...breakdown.map((x) => x.value));

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* 1. Identificação da empresa */}
      <header className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-lime-soft text-lime sm:size-12"><Building2 size={20} /></span>
        <div className="min-w-0">
          <div className="eyebrow mb-0.5 truncate">{segment ?? "Empresa"} · {fmtMonth(L.today, true)}</div>
          <h1 className="truncate text-[21px] font-bold leading-tight sm:text-[28px]">{ctx.ws.trade_name || ctx.ws.name}</h1>
        </div>
      </header>
      <FirstSteps steps={[
        { label: "Conta da empresa configurada", hint: "Banco e caixa da loja, com o saldo atual.", done: L.accounts.length > 0, href: `${ctx.base}/contas` },
        { label: "Registre a primeira venda", hint: "Toque no + e escolha Receita, ou use Vendas do dia no Caixa.", done: L.txs.some((t) => t.type === "income"), href: `${ctx.base}/caixa` },
        { label: "Cadastre uma conta a pagar", hint: "Aluguel, fornecedores, impostos: o fluxo de caixa passa a prever os vencimentos.", done: L.txs.some((t) => t.type === "expense" && t.status === "pending"), href: `${ctx.base}/financeiro?aba=pagar`, optional: true },
        { label: "Defina o caixa mínimo", hint: "Para ser alertado quando o caixa projetado ficar abaixo do seguro.", done: st.min_cash != null, href: `${ctx.base}/configuracoes`, optional: true },
      ]} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 2. Resultado financeiro */}
        <Card className="relative overflow-hidden p-5 sm:p-6 lg:col-span-2">
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-lime/10 blur-3xl" />
          <Stat size="xl" label="Resultado estimado do mês" value={b.estimatedResult} tone="auto" estimate sub={vs(b.estimatedResult, b.prev.estimatedResult)}
            help="Faturamento − custos − despesas, por competência. Não é lucro contábil oficial: depende de tudo estar lançado. Retiradas e investimentos ficam de fora." />
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
            <Stat size="sm" label="Resultado de caixa" value={b.cashResult} tone="auto" help="Recebido − pago no mês (regime de caixa). Inclui pagamento de faturas." />
            <Stat size="sm" label="Faturamento registrado" value={b.revenue} sub={vs(b.revenue, b.prev.revenue)} help="Vendas e serviços lançados no mês, recebidos ou não." />
          </div>
        </Card>
        {/* 3. Entradas e saídas · 4. Saldo */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-4">
          <MiniStat label="Entradas" value={b.received} tone="lime" icon={<ArrowDownLeft size={15} className="text-lime" />} sub="recebido no mês" />
          <MiniStat label="Saídas" value={b.paidOut} icon={<ArrowUpRight size={15} />} sub="pago no mês" />
          <div className="card col-span-2 grid grid-cols-2 gap-4 p-4 lg:col-span-1">
            <Stat size="sm" label="Saldo atual" value={b.balance} tone="auto" help="Soma das contas da empresa (bancos e caixa), com base nos lançamentos efetivados." />
            <Stat size="sm" label="Capital de giro 30d" value={b.workingCapital30} tone="auto" help="Saldo + a receber em 30 dias − a pagar em 30 dias (inclui vencidos)." />
          </div>
        </div>
      </div>

      {/* 5. Contas a pagar e a receber */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {([["pagar", "Contas a pagar", b.payables, "neg"], ["receber", "Contas a receber", b.receivables, "warn"]] as const).map(([k, title, o, overTone]) => (
          <Link key={k} href={`${ctx.base}/financeiro?aba=${k}`} className="card block p-4 transition hover:border-line-strong sm:p-5">
            <div className="flex items-center justify-between gap-2"><span className="eyebrow">{title}</span>{o.overdue > 0 && <Badge tone={overTone}>{k === "pagar" ? "vencido" : "em atraso"} <Money c={o.overdue} /></Badge>}</div>
            <Money c={o.open} className={`mt-2 block text-[22px] font-semibold ${k === "receber" ? "text-lime" : ""}`} />
            <div className="mt-2 flex gap-4 text-[12.5px] text-faint"><span>7 dias <Money c={o.next7} className="text-fg/80" /></span><span>30 dias <Money c={o.next30} className="text-fg/80" /></span></div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* 6. Fluxo de caixa */}
        <Card className="lg:col-span-3">
          <CardHeader title="Fluxo de caixa — 60 dias" subtitle={<>Menor saldo <Money c={proj.lowest.balance} tone="auto" /> em {fmtDate(proj.lowest.date)}</>} action={<Link href={`${ctx.base}/fluxo`} className={link}>Detalhar</Link>} />
          <div className="px-4 pb-4 pt-3 sm:px-5"><BalanceArea data={proj.buckets.map((x) => ({ label: fmtDayMonth(x.start), balance: x.closing }))} min={st.min_cash ?? null} /></div>
          {st.min_cash == null && <div className="px-4 pb-4 sm:px-5"><Notice>Defina um <Link href={`${ctx.base}/configuracoes`} className="underline">caixa mínimo de segurança</Link> para receber alertas de risco.</Notice></div>}
        </Card>
        {/* 7. Faturamento */}
        <Card className="lg:col-span-2">
          <CardHeader title="Faturamento" subtitle="Competência, últimos 6 meses" />
          <div className="grid grid-cols-2 gap-3 px-4 pt-4 sm:px-5">
            <div><div className="text-[12px] text-faint">Recebido</div><Money c={b.received} className="text-[15px] font-semibold text-lime" /></div>
            <div><div className="flex items-center gap-1 text-[12px] text-faint">Ainda a receber <Help>Parte do faturamento do mês que ainda não entrou no caixa (cartão de crédito, aplicativos, prazo).</Help></div><Money c={Math.max(0, toReceive)} className="text-[15px] font-semibold" /></div>
          </div>
          <div className="px-4 pb-4 pt-4 sm:px-5">{hasData ? <MonthlyBars data={series} incomeLabel="Faturamento" expenseLabel="Custos + despesas" /> : <Empty title="Sem histórico ainda" />}</div>
        </Card>
      </div>

      {/* 8. Despesas */}
      <Card>
        <CardHeader title="Para onde foi o dinheiro" subtitle="Saídas do mês por grupo (competência)" action={<Link href={`${ctx.base}/relatorios`} className={link}>Relatórios</Link>} />
        <ul className="grid gap-x-8 px-4 pb-5 pt-3 sm:grid-cols-2 sm:px-5">
          {breakdown.map((x) => (
            <li key={x.label} className="border-t border-line py-3 first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
              <div className="flex items-center justify-between gap-3 text-[14px]"><span className="truncate">{x.label}</span><Money c={x.value} className="shrink-0 font-medium" /></div>
              <Progress className="mt-2" pct={(x.value / maxBreak) * 100} tone={x.label.startsWith("Retiradas") && st.withdrawal_limit && x.value > st.withdrawal_limit ? "neg" : "lime"} />
              <div className="mt-1 text-[12px] text-faint">{x.hint}</div>
            </li>
          ))}
        </ul>
      </Card>

      {/* 9. Insights */}
      {insights.length > 0 && (
        <section>
          <SectionTitle title="Inteligência Innovai" action={<Link href={`${ctx.base}/inteligencia`} className={link}>Ver tudo</Link>} />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{insights.slice(0, 3).map((i) => <InsightCard key={i.key} i={i} ws={ctx.ws.id} compact />)}</div>
        </section>
      )}
    </div>
  );
}
