import Link from "next/link";
import { Vault } from "lucide-react";
import { getWorkspace } from "@/lib/data/workspace";
import { loadLedger } from "@/lib/data/ledger";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, Empty, Money, Notice, PageHeader, Stat } from "@/components/ui";
import { Sheet } from "@/components/client";
import { fmtDate, isISODate } from "@/lib/finance/dates";
import { balanceEffect } from "@/lib/finance/ledger";
import { toCents } from "@/lib/finance/money";
import { PAYMENT_METHODS } from "@/lib/templates";
import { loadRefs } from "../refs";
import { CloseForm, SalesForm } from "./forms";

export const metadata = { title: "Caixa" };

export default async function Page({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<{ conta?: string; data?: string }> }) {
  const [{ ws }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getWorkspace(ws);
  const [L, refs] = await Promise.all([loadLedger(ws), loadRefs(ctx)]);
  const cashAccs = L.accounts.filter((a) => a.type === "cash" && !a.archived);
  const date = isISODate(sp.data) && sp.data <= L.today ? sp.data : L.today;
  const acc = cashAccs.find((a) => a.id === sp.conta) ?? cashAccs[0];
  const sb = await createClient();
  const { data: history } = await sb.from("cash_closings").select("*").eq("workspace_id", ws).order("date", { ascending: false }).limit(30);
  const incomeCats = L.categories.filter((c) => c.kind === "income");
  const bankAccs = L.accounts.filter((a) => a.type !== "cash" && !a.archived);
  if (!acc) return (<><PageHeader title="Caixa" /><Card><Empty icon={<Vault size={18} />} title="Nenhuma conta do tipo caixa" text="Crie uma conta do tipo “Dinheiro em espécie / caixa” para controlar a gaveta." action={<Link href={`${ctx.base}/contas`} className="btn-secondary btn-sm">Criar conta</Link>} /></Card></>);

  // Valores do dia calculados pelo sistema
  const current = L.balances.get(acc.id) ?? 0;
  let after = 0, cashIn = 0, cashOut = 0;
  const sales: Record<string, number> = {};
  for (const t of L.txs) {
    const d = t.paidAt ?? t.date;
    if (t.status === "paid" && d >= date) after += balanceEffect(t, acc.id);
    if (t.status === "paid" && d === date) { const e = balanceEffect(t, acc.id); if (e > 0) cashIn += e; else cashOut += -e; }
    if (t.type === "income" && t.status !== "canceled" && t.date === date) { const k = t.paymentMethod ?? "other"; sales[k] = (sales[k] ?? 0) + t.amount; }
  }
  const opening = current - after;
  const closedToday = (history ?? []).find((h) => h.date === date && h.account_id === acc.id);
  const totalSales = Object.values(sales).reduce((a, b) => a + b, 0);
  const label = (k: string) => PAYMENT_METHODS.find((p) => p.value === k)?.label ?? "Outros";

  return (
    <>
      <PageHeader title="Caixa" subtitle="Faturamento do dia, conferência e fechamento da gaveta."
        actions={ctx.canOperate && <Sheet title="Faturamento do dia" trigger={<button className="btn-secondary btn-sm">Registrar vendas do dia</button>}><SalesForm ws={ws} date={date} cashAccounts={cashAccs} bankAccounts={bankAccs.length ? bankAccs : cashAccs} categories={incomeCats} /></Sheet>} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        {cashAccs.length > 1 && <label><span className="label">Caixa</span><select name="conta" defaultValue={acc.id} className="input h-10 w-48">{cashAccs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
        <label><span className="label">Dia</span><input type="date" name="data" defaultValue={date} max={L.today} className="input h-10 w-44" /></label>
        <button className="btn-secondary btn-sm h-10">Ver</button>
      </form>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
            <Stat label="Saldo inicial" value={opening} help="Saldo da conta caixa no início do dia, calculado pelos lançamentos." />
            <Stat label="Entradas" value={cashIn} tone="lime" />
            <Stat label="Saídas" value={cashOut} help="Despesas, retiradas e transferências (sangrias) que saíram do caixa." />
            <Stat label="Saldo esperado" value={opening + cashIn - cashOut} />
          </div>
          <div className="mt-6 border-t border-line pt-4">
            {closedToday ? (
              <div className="flex flex-wrap items-center gap-3 text-[14px]"><Badge tone={toCents(closedToday.difference) === 0 ? "lime" : "warn"}>Caixa fechado</Badge> Contado: <Money c={toCents(closedToday.counted_amount)} /> · Diferença: <Money c={toCents(closedToday.difference)} tone="auto" />{closedToday.justification && <span className="text-muted">· {closedToday.justification}</span>}</div>
            ) : ctx.canOperate ? (
              <Sheet title={`Fechar caixa — ${fmtDate(date)}`} trigger={<button className="btn-primary">Fechar caixa do dia</button>}><CloseForm ws={ws} accountId={acc.id} date={date} opening={opening} cashIn={cashIn} cashOut={cashOut} sales={sales} /></Sheet>
            ) : <p className="text-muted">Caixa ainda não fechado.</p>}
          </div>
        </Card>
        <Card className="p-5">
          <div className="eyebrow mb-3">Vendas do dia por forma de pagamento</div>
          {totalSales ? (<div className="space-y-2 text-[14px]">{Object.entries(sales).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-muted">{label(k)}</span><Money c={v} /></div>)}<div className="flex justify-between border-t border-line pt-2 font-semibold"><span>Total</span><Money c={totalSales} /></div></div>) : <p className="text-[14px] text-muted">Nenhuma venda registrada neste dia.</p>}
        </Card>
      </div>
      {!refs.canWrite && ctx.canOperate && <div className="mt-4"><Notice>Como funcionário, você pode registrar vendas e fechar o caixa. Edição de lançamentos é restrita aos gestores.</Notice></div>}
      <Card className="mt-4">
        <CardHeader title="Histórico de fechamentos" />
        {history?.length ? (
          <div className="overflow-x-auto px-2 pb-3 pt-2"><table className="w-full text-[13.5px]">
            <thead><tr className="text-left text-[12px] text-faint"><th className="px-3 py-2 font-normal">Dia</th><th className="px-3 py-2 text-right font-normal">Esperado</th><th className="px-3 py-2 text-right font-normal">Contado</th><th className="px-3 py-2 text-right font-normal">Diferença</th><th className="px-3 py-2 font-normal">Justificativa</th></tr></thead>
            <tbody>{history.map((h) => <tr key={h.id} className="border-t border-line"><td className="px-3 py-2.5">{fmtDate(h.date)}</td><td className="num px-3 py-2.5 text-right"><Money c={toCents(h.expected_amount)} /></td><td className="num px-3 py-2.5 text-right"><Money c={toCents(h.counted_amount)} /></td><td className="num px-3 py-2.5 text-right"><Money c={toCents(h.difference)} tone="auto" /></td><td className="px-3 py-2.5 text-muted">{h.justification ?? "—"}</td></tr>)}</tbody>
          </table></div>
        ) : <Empty title="Nenhum fechamento ainda" />}
      </Card>
    </>
  );
}
