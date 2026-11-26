import Link from "next/link";
import { ArrowRight, CreditCard, Flag, Wallet } from "lucide-react";
import { Card, CardHeader, Empty, Money, PageHeader, Progress, Stat } from "@/components/ui";
import { MonthlyBars } from "@/components/charts";
import { InsightCard } from "@/components/insight-card";
import { loadLedger } from "@/lib/data/ledger";
import { loadGoals, loadInsights } from "@/lib/data/insights";
import { personalSnapshot } from "@/lib/finance/snapshot";
import { buildInvoices, cardLimit, currentInvoiceMonth } from "@/lib/finance/cards";
import { fmtDate, fmtMonth } from "@/lib/finance/dates";
import type { WorkspaceCtx } from "@/lib/data/workspace";
import { monthlySeries, UpcomingList } from "./common";

const ACCOUNT_LABEL: Record<string, string> = { checking: "Conta corrente", savings: "Poupança", wallet: "Carteira", cash: "Dinheiro", digital: "Conta digital", investment: "Investimentos", other: "Outra" };

export async function PersonalDashboard({ ctx }: { ctx: WorkspaceCtx }) {
  const L = await loadLedger(ctx.ws.id);
  const [goals, insights] = await Promise.all([loadGoals(ctx.ws.id, L.today), loadInsights(ctx, L)]);
  const s = personalSnapshot({ accounts: L.accounts, txs: L.txs, cards: L.cards, today: L.today, balances: L.balances });
  const series = monthlySeries(L.txs, L.today);
  const hasData = L.txs.length > 0;
  const base = ctx.base;

  return (
    <>
      <PageHeader eyebrow={fmtMonth(L.today, true)} title="Início" subtitle={hasData ? undefined : "Registre seus primeiros lançamentos para ver sua situação financeira."} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 sm:p-6 lg:col-span-2">
          <Stat size="lg" label="Saldo disponível estimado" value={s.availableEstimate} tone="auto" estimate
            help={<>Quanto do seu dinheiro <b>não está comprometido</b> até o fim do mês: saldo total menos contas pendentes e faturas que vencem até lá. Não conta com receitas que ainda não entraram.</>} />
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-line pt-5 sm:grid-cols-4">
            <Stat label="Saldo total" value={s.totalBalance} help="Soma de todas as contas ativas: bancos, carteira, dinheiro e investimentos cadastrados." />
            <Stat label="Saldo bancário" value={s.bankBalance} help="Apenas contas corrente, poupança e digitais." />
            <Stat label="Comprometido" value={s.committed} help="Contas a pagar e faturas de cartão com vencimento até o fim do mês (inclui vencidas)." />
            <Stat label="Saldo previsto" value={s.forecastBalance} tone="auto" estimate help="Saldo total + receitas previstas − compromissos, considerando o fim do mês. Usa apenas o que está cadastrado." />
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="eyebrow mb-4">Este mês</div>
          <div className="space-y-4">
            <Stat label="Entradas" value={s.monthIncome} tone="lime" help="Receitas já recebidas no mês." />
            <Stat label="Saídas" value={s.monthExpense} help="Despesas pagas no mês, incluindo compras no cartão da fatura deste mês. Transferências e pagamentos de fatura não contam." />
            <Stat label="Saldo do mês" value={s.monthNet} tone="auto" />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Evolução financeira" subtitle="Receitas e despesas realizadas nos últimos 6 meses" />
          <div className="px-3 pb-4 pt-3">{hasData ? <MonthlyBars data={series} /> : <Empty title="Sem histórico ainda" text="O gráfico aparece conforme você registra movimentações." />}</div>
        </Card>
        <Card>
          <CardHeader title="Próximos vencimentos" subtitle="Próximos 15 dias" />
          <UpcomingList items={s.upcoming} base={base} empty="Nenhuma conta ou fatura para os próximos 15 dias." />
        </Card>
      </div>

      {insights.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between"><h2 className="text-[15px] font-semibold">Inteligência Innovai</h2><Link href={`${base}/inteligencia`} className="text-[13px] text-muted hover:text-fg">Ver tudo</Link></div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{insights.slice(0, 3).map((i) => <InsightCard key={i.key} i={i} ws={ctx.ws.id} compact />)}</div>
        </section>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Contas" action={<Link href={`${base}/contas`} className="text-[13px] text-muted hover:text-fg">Gerenciar</Link>} />
          <ul className="px-2 py-2">
            {s.balances.map(({ account, balance }) => (
              <li key={account.id}><Link href={`${base}/contas/${account.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-surface-3 text-muted"><Wallet size={16} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[14px]">{account.name}</span><span className="text-[12px] text-faint">{ACCOUNT_LABEL[account.type]}</span></span>
                <Money c={balance} tone="auto" className="text-[14px]" />
              </Link></li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Cartões" action={<Link href={`${base}/cartoes`} className="text-[13px] text-muted hover:text-fg">Ver faturas</Link>} />
          {L.cards.length ? (
            <ul className="space-y-4 px-5 pb-5 pt-4">
              {L.cards.map((c) => {
                const lim = cardLimit(c, L.txs);
                const cur = buildInvoices(c, L.txs, L.today).find((i) => i.month === currentInvoiceMonth(c, L.today));
                return (
                  <li key={c.id}>
                    <div className="flex items-center justify-between text-[14px]"><span className="flex items-center gap-2"><CreditCard size={15} className="text-muted" />{c.name}</span><Money c={cur?.total ?? 0} /></div>
                    <div className="mt-1 text-[12px] text-faint">Fatura atual · vence {cur ? fmtDate(cur.dueDate) : "—"}</div>
                    <Progress className="mt-2" pct={lim.usagePct} tone={lim.usagePct >= 80 ? "warn" : "lime"} />
                    <div className="mt-1 flex justify-between text-[12px] text-faint"><span>Disponível <Money c={lim.available} /></span><span>Limite <Money c={lim.limit} /></span></div>
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="Nenhum cartão" text="Cadastre seus cartões para acompanhar faturas e parcelas." action={<Link href={`${base}/cartoes`} className="btn-secondary btn-sm">Adicionar cartão</Link>} />}
        </Card>
        <Card>
          <CardHeader title="Metas" action={<Link href={`${base}/metas`} className="text-[13px] text-muted hover:text-fg">Ver metas</Link>} />
          {goals.length ? (
            <ul className="space-y-4 px-5 pb-5 pt-4">
              {goals.slice(0, 4).map((g) => (
                <li key={g.id}>
                  <div className="flex items-center justify-between text-[14px]"><span className="truncate">{g.name}</span><span className="num text-muted">{Math.round(g.projection.pct)}%</span></div>
                  <Progress className="mt-2" pct={g.projection.pct} />
                  <div className="mt-1 text-[12px] text-faint"><Money c={g.projection.saved} /> de <Money c={g.target} /></div>
                </li>
              ))}
            </ul>
          ) : <Empty icon={<Flag size={18} />} title="Defina uma meta" text="Reserva de emergência, viagem, carro…" action={<Link href={`${base}/metas`} className="btn-secondary btn-sm">Criar meta <ArrowRight size={14} /></Link>} />}
        </Card>
      </div>
    </>
  );
}
