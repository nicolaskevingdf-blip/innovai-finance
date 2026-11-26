import Link from "next/link";
import { Plus, Wallet } from "lucide-react";
import { getWorkspace } from "@/lib/data/workspace";
import { loadLedger } from "@/lib/data/ledger";
import { Card, Empty, Money, PageHeader, Stat } from "@/components/ui";
import { Sheet } from "@/components/client";
import { ACCOUNT_TYPES } from "@/lib/templates";
import { AccountForm } from "./forms";

export const metadata = { title: "Contas" };

export default async function Page({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const ctx = await getWorkspace(ws);
  const L = await loadLedger(ws);
  const active = L.accounts.filter((a) => !a.archived), archived = L.accounts.filter((a) => a.archived);
  const total = active.reduce((s, a) => s + (L.balances.get(a.id) ?? 0), 0);
  const label = (t: string) => ACCOUNT_TYPES.find((x) => x.value === t)?.label;
  return (
    <>
      <PageHeader title={ctx.ws.kind === "business" ? "Contas bancárias e caixa" : "Contas"} subtitle="Saldos calculados a partir do saldo inicial e de todas as movimentações efetivadas."
        actions={ctx.canWrite && <Sheet title="Nova conta" trigger={<button className="btn-primary btn-sm"><Plus size={16} /> Nova conta</button>}><AccountForm ws={ws} /></Sheet>} />
      <Card className="mb-4 p-5"><Stat size="lg" label="Saldo total" value={total} tone="auto" help="Soma das contas ativas. Transferências entre contas não alteram o total." /></Card>
      <Card>
        {active.length ? active.map((a) => (
          <Link key={a.id} href={`${ctx.base}/contas/${a.id}`} className="flex items-center gap-3 border-t border-line px-5 py-4 first:border-t-0 hover:bg-surface-2">
            <span className="flex size-10 items-center justify-center rounded-xl bg-surface-3 text-muted"><Wallet size={17} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-[15px]">{a.name}</span><span className="text-[12.5px] text-faint">{label(a.type)}</span></span>
            <Money c={L.balances.get(a.id) ?? 0} tone="auto" className="text-[15px] font-medium" />
          </Link>
        )) : <Empty title="Nenhuma conta" />}
      </Card>
      {archived.length > 0 && <p className="mt-4 text-[13px] text-faint">Arquivadas: {archived.map((a) => <Link key={a.id} href={`${ctx.base}/contas/${a.id}`} className="mr-2 underline">{a.name}</Link>)}</p>}
    </>
  );
}
