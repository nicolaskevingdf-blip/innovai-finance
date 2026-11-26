import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CreditCard, Flag, Target, Wallet } from "lucide-react";
import { Card, CardHeader, Empty, Help, MiniStat, Money, Progress, SectionTitle, Stat } from "@/components/ui";
import { MonthlyBars } from "@/components/charts-lazy";
import { FirstSteps } from "@/components/first-steps";
import { InsightCard } from "@/components/insight-card";
import { loadLedger } from "@/lib/data/ledger";
import { loadGoals, loadInsights } from "@/lib/data/insights";
import { createClient } from "@/lib/supabase/server";
import { personalSnapshot } from "@/lib/finance/snapshot";
import { buildInvoices, cardLimit, currentInvoiceMonth } from "@/lib/finance/cards";
import { budgetUsage, DEFAULT_THRESHOLDS } from "@/lib/finance/planning";
import { summarize } from "@/lib/finance/ledger";
import { fmtDate, fmtMonth, monthEnd, monthStart } from "@/lib/finance/dates";
import { toCents } from "@/lib/finance/money";
import type { WorkspaceCtx } from "@/lib/data/workspace";
import { firstName, greeting, monthlySeries, UpcomingList } from "./common";

const ACCOUNT_LABEL: Record<string, string> = { checking: "Conta corrente", savings: "Poupança", wallet: "Carteira", cash: "Dinheiro", digital: "Conta digital", investment: "Investimentos", other: "Outra" };
const link = "text-[13px] font-medium text-muted hover:text-fg";

export async function PersonalDashboard({ ctx }: { ctx: WorkspaceCtx }) {
  const L = await loadLedger(ctx.ws.id);
  const sb = await createClient();
  const ms = monthStart(L.today);
  const [goals, insights, name, { data: budgets }] = await Promise.all([
    loadGoals(ctx.ws.id, L.today), loadInsights(ctx, L), firstName(ctx.userId),
    sb.from("budgets").select("category_id, amount").eq("workspace_id", ctx.ws.id).eq("month", ms),
  ]);
  const s = personalSnapshot({ accounts: L.accounts, txs: L.txs, cards: L.cards, today: L.today, balances: L.balances });
  const series = monthlySeries(L.txs, L.today);
  const hasData = L.txs.length > 0;
  const base = ctx.base;

  // Orçamento do mês: gasto por categoria principal (inclui subcategorias e pendentes)
  const spent = summarize(L.txs, ms, monthEnd(L.today), { includePending: true }).byCategory;
  const thresholds = (ctx.ws.settings as { budget_thresholds?: number[] }).budget_thresholds ?? [...DEFAULT_THRESHOLDS];
  const budgetRows = (budgets ?? []).map((b) => {
    const cat = L.categories.find((c) => c.id === b.category_id);
    const ids = [b.category_id, ...L.categories.filter((c) => c.parentId === b.category_id).map((c) => c.id)];
    const used = ids.reduce((t, id) => t + (spent.get(id) ?? 0), 0);
    return { id: b.category_id, name: cat?.name ?? "—", amount: toCents(b.amount), used, u: budgetUsage(used, toCents(b.amount), thresholds) };
  }).sort((a, b) => (b.u.pct ?? 0) - (a.u.pct ?? 0));
  const totalBudget = budgetRows.reduce((t, r) => t + r.amount, 0), totalUsed = budgetRows.reduce((t, r) => t + r.used, 0);
  const tone = (lvl: string) => (lvl === "over" ? "neg" : lvl === "high" || lvl === "attention" ? "warn" : "lime") as "neg" | "warn" | "lime";

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* 1. Saudação */}
      <header>
        <div className="eyebrow mb-1">{fmtMonth(L.today, true)}</div>
        <h1 className="text-[22px] font-bold leading-tight sm:text-[28px]">{greeting()}{name ? `, ${name}` : ""}</h1>
      </header>
      <FirstSteps steps={[
        { label: "Conta principal configurada", hint: "Cadastre onde seu dinheiro está, com o saldo atual.", done: L.accounts.length > 0, href: `${base}/contas` },
        { label: "Registre seu primeiro lançamento", hint: "Toque no botão + ou escreva algo como “gastei 30 no mercado”.", done: L.txs.some((t) => t.type !== "adjustment") },
        { label: "Cadastre seu cartão de crédito", hint: "Para acompanhar faturas, parcelas e limite.", done: L.cards.length > 0, href: `${base}/cartoes`, optional: true },
        { label: "Defina um orçamento do mês", hint: "Receba alertas antes de estourar uma categoria.", done: (budgets ?? []).length > 0, href: `${base}/planejamento`, optional: true },
      ]} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 2. Saldo disponível (destaque) + 4. comprometido */}
        <Card className="relative overflow-hidden p-5 sm:p-6 lg:col-span-2">
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-lime/10 blur-3xl" />
          <Stat size="xl" label="Saldo disponível estimado" value={s.availableEstimate} tone="auto" estimate
            help={<>Quanto do seu dinheiro <b>não está comprometido</b> até o fim do mês: saldo total menos contas pendentes e faturas que vencem até lá. Não conta com receitas que ainda não entraram.</>} />
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-4 sm:grid-cols-4">
            <Stat size="sm" label="Saldo total" value={s.totalBalance} help="Soma de todas as contas ativas: bancos, carteira, dinheiro e investimentos cadastrados." />
            <Stat size="sm" label="Comprometido" value={s.committed} help="Contas a pagar e faturas de cartão com vencimento até o fim do mês (inclui vencidas)." />
            <Stat size="sm" label="Saldo previsto" value={s.forecastBalance} tone="auto" help="Saldo total + receitas previstas − compromissos, no fim do mês. Usa apenas o que está cadastrado." />
            <Stat size="sm" label="Saldo bancário" value={s.bankBalance} help="Apenas contas corrente, poupança e digitais." />
          </div>
        </Card>

        {/* 3. Receitas e despesas do mês */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-4">
          <MiniStat label="Entradas" value={s.monthIncome} tone="lime" icon={<ArrowDownLeft size={15} className="text-lime" />} sub="recebidas no mês" />
          <MiniStat label="Saídas" value={s.monthExpense} icon={<ArrowUpRight size={15} />} sub="no mês, com cartões" />
          <div className="card col-span-2 flex items-center justify-between gap-3 px-4 py-3 lg:col-span-1">
            <span className="flex items-center gap-1.5 text-[13px] text-muted">Saldo do mês <Help>Entradas recebidas − saídas do mês. Transferências e pagamentos de fatura não entram.</Help></span>
            <Money c={s.monthNet} tone="auto" className="text-[17px] font-semibold" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 5. Evolução */}
        <Card className="lg:col-span-2">
          <CardHeader title="Evolução financeira" subtitle="Realizado nos últimos 6 meses" />
          <div className="px-4 pb-4 pt-3 sm:px-5">{hasData ? <MonthlyBars data={series} /> : <Empty title="Sem histórico ainda" text="O gráfico aparece conforme você registra movimentações." />}</div>
        </Card>
        {/* 6. Próximas contas */}
        <Card>
          <CardHeader title="Próximas contas" subtitle="Próximos 15 dias" />
          <UpcomingList items={s.upcoming} base={base} empty="Nenhuma conta ou fatura para os próximos 15 dias." />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 7. Orçamento mensal */}
        <Card>
          <CardHeader title="Orçamento do mês" subtitle={totalBudget ? <><Money c={totalUsed} /> de <Money c={totalBudget} /> planejados</> : undefined} action={<Link href={`${base}/planejamento`} className={link}>Planejar</Link>} />
          {budgetRows.length ? (
            <ul className="space-y-4 px-4 pb-5 pt-4 sm:px-5">
              {budgetRows.slice(0, 4).map((r) => (
                <li key={r.id}>
                  <div className="flex items-center justify-between gap-3 text-[14px]"><span className="truncate">{r.name}</span><span className="num shrink-0 text-[13px] text-muted">{r.u.pct !== null ? `${Math.round(r.u.pct)}%` : "—"}</span></div>
                  <Progress className="mt-2" pct={r.u.pct} tone={tone(r.u.level)} />
                  <div className="mt-1 text-[12px] text-faint">{r.u.remaining >= 0 ? <>Resta <Money c={r.u.remaining} /></> : <span className="text-neg">Excedeu <Money c={-r.u.remaining} /></span>}</div>
                </li>
              ))}
            </ul>
          ) : <Empty icon={<Target size={18} />} title="Sem orçamento neste mês" text="Defina limites por categoria e receba alertas antes de estourar." action={<Link href={`${base}/planejamento`} className="btn-secondary btn-sm">Criar orçamento</Link>} />}
        </Card>
        {/* 8. Metas */}
        <Card>
          <CardHeader title="Metas" action={<Link href={`${base}/metas`} className={link}>Ver todas</Link>} />
          {goals.length ? (
            <ul className="space-y-4 px-4 pb-5 pt-4 sm:px-5">
              {goals.slice(0, 4).map((g) => (
                <li key={g.id}>
                  <div className="flex items-center justify-between gap-3 text-[14px]"><span className="truncate">{g.name}</span><span className="num shrink-0 text-[13px] text-muted">{Math.round(g.projection.pct)}%</span></div>
                  <Progress className="mt-2" pct={g.projection.pct} />
                  <div className="mt-1 text-[12px] text-faint"><Money c={g.projection.saved} /> de <Money c={g.target} /></div>
                </li>
              ))}
            </ul>
          ) : <Empty icon={<Flag size={18} />} title="Defina uma meta" text="Reserva de emergência, viagem, carro…" action={<Link href={`${base}/metas`} className="btn-secondary btn-sm">Criar meta <ArrowRight size={14} /></Link>} />}
        </Card>
        {/* Cartões */}
        <Card>
          <CardHeader title="Cartões" action={<Link href={`${base}/cartoes`} className={link}>Faturas</Link>} />
          {L.cards.length ? (
            <ul className="space-y-4 px-4 pb-5 pt-4 sm:px-5">
              {L.cards.map((c) => {
                const lim = cardLimit(c, L.txs);
                const cur = buildInvoices(c, L.txs, L.today).find((i) => i.month === currentInvoiceMonth(c, L.today));
                return (
                  <li key={c.id}>
                    <div className="flex items-center justify-between gap-3 text-[14px]"><span className="flex min-w-0 items-center gap-2"><CreditCard size={15} className="shrink-0 text-muted" /><span className="truncate">{c.name}</span></span><Money c={cur?.total ?? 0} className="shrink-0" /></div>
                    <div className="mt-1 text-[12px] text-faint">Fatura atual · vence {cur ? fmtDate(cur.dueDate) : "—"}</div>
                    <Progress className="mt-2" pct={lim.usagePct} tone={lim.usagePct >= 80 ? "warn" : "lime"} />
                    <div className="mt-1 flex justify-between gap-2 text-[12px] text-faint"><span>Disponível <Money c={lim.available} /></span><span>de <Money c={lim.limit} /></span></div>
                  </li>
                );
              })}
            </ul>
          ) : <Empty icon={<CreditCard size={18} />} title="Nenhum cartão" text="Cadastre seus cartões para acompanhar faturas e parcelas." action={<Link href={`${base}/cartoes`} className="btn-secondary btn-sm">Adicionar cartão</Link>} />}
        </Card>
      </div>

      {/* Contas */}
      <section>
        <SectionTitle title="Contas" action={<Link href={`${base}/contas`} className={link}>Gerenciar</Link>} />
        <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {s.balances.map(({ account, balance }) => (
            <Link key={account.id} href={`${base}/contas/${account.id}`} className="card w-[68%] shrink-0 snap-start p-4 transition hover:border-line-strong sm:w-auto">
              <div className="flex items-center gap-2 text-[13px] text-muted"><Wallet size={15} className="shrink-0" /><span className="truncate">{account.name}</span></div>
              <Money c={balance} tone="auto" className="mt-2 block truncate text-[18px] font-semibold" />
              <div className="text-[11.5px] text-faint">{ACCOUNT_LABEL[account.type]}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* 9. Insights */}
      {insights.length > 0 && (
        <section>
          <SectionTitle title="Inteligência Innovai" action={<Link href={`${base}/inteligencia`} className={link}>Ver tudo</Link>} />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{insights.slice(0, 3).map((i) => <InsightCard key={i.key} i={i} ws={ctx.ws.id} compact />)}</div>
        </section>
      )}
    </div>
  );
}
