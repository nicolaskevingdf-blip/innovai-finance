import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/data/workspace";
import { loadLedger } from "@/lib/data/ledger";
import { queryTransactions } from "@/lib/data/tx-query";
import { Card, CardHeader, PageHeader, Stat } from "@/components/ui";
import { ConfirmSubmit, Sheet } from "@/components/client";
import { TxList } from "@/components/tx-list";
import { BalanceArea } from "@/components/charts-lazy";
import { archiveAccount } from "@/app/actions/accounts";
import { addMonths, fmtMonth, monthEnd, monthStart } from "@/lib/finance/dates";
import { accountFlows, balanceEffect } from "@/lib/finance/ledger";
import { loadRefs } from "../../refs";
import { AccountForm, AdjustForm } from "../forms";

export default async function Page({ params }: { params: Promise<{ ws: string; id: string }> }) {
  const { ws, id } = await params;
  const ctx = await getWorkspace(ws);
  const [L, refs] = await Promise.all([loadLedger(ws), loadRefs(ctx)]);
  const acc = L.accounts.find((a) => a.id === id);
  if (!acc) notFound();
  const balance = L.balances.get(id) ?? 0;
  const { rows } = await queryTransactions(ws, { conta: id }, 150);
  const ms = monthStart(L.today), me = monthEnd(L.today);
  const { income: inc, expense: out, transferIn: trIn, transferOut: trOut } = accountFlows(L.txs, id, ms, me);
  // evolução: saldo no fim de cada mês (retroativo a partir do saldo atual, usando o histórico carregado)
  const series = [];
  let running = balance;
  for (let i = 0; i < 6; i++) {
    const m = addMonths(ms, -i);
    series.unshift({ label: fmtMonth(m), balance: running });
    for (const t of L.txs) { const d = t.paidAt ?? t.date; if (d >= m && d <= monthEnd(m)) running -= balanceEffect(t, id); }
  }
  return (
    <>
      <PageHeader eyebrow="Conta" title={acc.name} actions={ctx.canWrite && <>
        <Sheet title="Ajustar saldo" trigger={<button className="btn-secondary btn-sm">Ajustar saldo</button>}><AdjustForm ws={ws} id={id} /></Sheet>
        <Sheet title="Editar conta" trigger={<button className="btn-secondary btn-sm">Editar</button>}><AccountForm ws={ws} a={{ id, name: acc.name, type: acc.type, institution: acc.institution ?? null }} /></Sheet>
        {acc.archived || balance === 0 ? (
          <form action={archiveAccount}><input type="hidden" name="ws" value={ws} /><input type="hidden" name="id" value={id} /><input type="hidden" name="archived" value={String(!acc.archived)} /><ConfirmSubmit message={acc.archived ? "Reativar esta conta?" : "Arquivar esta conta? O histórico é mantido."} className="btn-ghost btn-sm">{acc.archived ? "Reativar" : "Arquivar"}</ConfirmSubmit></form>
        ) : <span className="self-center text-[12.5px] text-faint" title="Contas com saldo não podem ser arquivadas">Para arquivar, zere o saldo (transfira ou ajuste)</span>}
      </>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <Stat size="lg" label="Saldo atual" value={balance} tone="auto" />
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
            <Stat label="Receitas (mês)" value={inc} tone="lime" />
            <Stat label="Despesas (mês)" value={out} help="Inclui pagamentos de fatura de cartão feitos por esta conta." />
            <Stat label="Transf. recebidas" value={trIn} />
            <Stat label="Transf. enviadas" value={trOut} />
          </div>
        </Card>
        <Card className="lg:col-span-2"><CardHeader title="Evolução do saldo" subtitle="Saldo ao fim de cada mês" /><div className="px-3 pb-4 pt-3"><BalanceArea data={series} height={200} /></div></Card>
      </div>
      <Card className="mt-4"><CardHeader title="Histórico" /><TxList rows={rows} refs={refs} /></Card>
    </>
  );
}
