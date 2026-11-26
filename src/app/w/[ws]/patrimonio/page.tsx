import { Plus } from "lucide-react";
import { getWorkspace } from "@/lib/data/workspace";
import { loadLedger } from "@/lib/data/ledger";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, Empty, Money, PageHeader, Stat } from "@/components/ui";
import { ConfirmSubmit, Sheet } from "@/components/client";
import { BalanceArea } from "@/components/charts";
import { archiveAsset } from "@/app/actions/finance";
import { toCents } from "@/lib/finance/money";
import { addMonths, fmtDate, fmtMonth, monthEnd, monthStart } from "@/lib/finance/dates";
import { cardLimit } from "@/lib/finance/cards";
import { AssetForm } from "./form";

export const metadata = { title: "Patrimônio" };

export default async function Page({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const ctx = await getWorkspace(ws);
  const L = await loadLedger(ws);
  const sb = await createClient();
  const [{ data: assets }, { data: values }, { data: debts }, { data: dpays }] = await Promise.all([
    sb.from("assets").select("*").eq("workspace_id", ws).eq("archived", false).order("created_at"),
    sb.from("asset_values").select("*").eq("workspace_id", ws).order("date", { ascending: false }),
    sb.from("debts").select("id,creditor,total_amount,status").eq("workspace_id", ws).in("status", ["active", "renegotiating"]),
    sb.from("debt_payments").select("debt_id,amount").eq("workspace_id", ws),
  ]);
  const valueAt = (id: string, until?: string) => { const v = (values ?? []).find((x) => x.asset_id === id && (!until || x.date <= until)); return v ? { value: toCents(v.value), date: v.date as string } : null; };
  const list = (assets ?? []).map((a) => ({ ...a, current: valueAt(a.id) }));
  const accountsTotal = [...L.balances.entries()].filter(([id]) => !L.accounts.find((a) => a.id === id)?.archived).reduce((t, [, b]) => t + Math.max(0, b), 0);
  const cardDebt = L.cards.reduce((t, c) => t + cardLimit(c, L.txs).used, 0);
  const debtTotal = (debts ?? []).reduce((t, d) => t + Math.max(0, toCents(d.total_amount) - (dpays ?? []).filter((p) => p.debt_id === d.id).reduce((s, p) => s + toCents(p.amount), 0)), 0);
  const assetsTotal = list.filter((a) => a.side === "asset").reduce((t, a) => t + (a.current?.value ?? 0), 0) + accountsTotal;
  const liabTotal = list.filter((a) => a.side === "liability").reduce((t, a) => t + (a.current?.value ?? 0), 0) + cardDebt + debtTotal;
  const series = Array.from({ length: 6 }, (_, i) => {
    const m = monthEnd(addMonths(monthStart(L.today), -(5 - i)));
    const a = list.filter((x) => x.side === "asset").reduce((t, x) => t + (valueAt(x.id, m)?.value ?? 0), 0);
    const l = list.filter((x) => x.side === "liability").reduce((t, x) => t + (valueAt(x.id, m)?.value ?? 0), 0);
    return { label: fmtMonth(m), balance: a - l };
  });
  const Section = ({ side, title }: { side: "asset" | "liability"; title: string }) => {
    const items = list.filter((a) => a.side === side);
    return (
      <Card>
        <CardHeader title={title} action={ctx.canWrite && <Sheet title={side === "asset" ? "Novo ativo" : "Novo passivo"} trigger={<button className="btn-secondary btn-sm"><Plus size={15} /> Adicionar</button>}><AssetForm ws={ws} side={side} today={L.today} /></Sheet>} />
        <div className="py-2">
          {side === "asset" && <div className="flex justify-between border-b border-line px-5 py-3 text-[14px]"><span>Saldos em contas <span className="text-faint">(automático)</span></span><Money c={accountsTotal} /></div>}
          {side === "liability" && <>
            {cardDebt > 0 && <div className="flex justify-between border-b border-line px-5 py-3 text-[14px]"><span>Cartões de crédito <span className="text-faint">(automático)</span></span><Money c={cardDebt} /></div>}
            {debtTotal > 0 && <div className="flex justify-between border-b border-line px-5 py-3 text-[14px]"><span>Dívidas cadastradas <span className="text-faint">(automático)</span></span><Money c={debtTotal} /></div>}
          </>}
          {items.length ? items.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0">
              <div className="min-w-0 flex-1"><div className="truncate text-[14px]">{a.name}</div><div className="text-[12px] text-faint">{a.current ? `informado em ${fmtDate(a.current.date)}` : "sem valor"}</div></div>
              <Money c={a.current?.value ?? 0} className="text-[14px]" />
              {ctx.canWrite && <Sheet title={`Atualizar ${a.name}`} trigger={<button className="btn-ghost btn-sm">Atualizar</button>}><AssetForm ws={ws} side={side} today={L.today} a={{ id: a.id, name: a.name, type: a.type, notes: a.notes, value: a.current?.value ?? 0 }} /><form action={archiveAsset} className="mt-3"><input type="hidden" name="ws" value={ws} /><input type="hidden" name="id" value={a.id} /><ConfirmSubmit message="Remover este item do patrimônio?" className="btn-ghost btn-sm w-full">Remover</ConfirmSubmit></form></Sheet>}
            </div>
          )) : <Empty title={side === "asset" ? "Nenhum bem cadastrado" : "Nenhum passivo adicional"} />}
        </div>
      </Card>
    );
  };
  return (
    <>
      <PageHeader title="Patrimônio" subtitle="Bens e obrigações com valores informados por você. Saldos de contas, cartões e dívidas entram automaticamente." />
      <Card className="mb-4 grid grid-cols-1 gap-5 p-5 sm:grid-cols-3">
        <Stat label="Total de ativos" value={assetsTotal} />
        <Stat label="Total de passivos" value={liabTotal} />
        <Stat size="lg" label="Patrimônio líquido estimado" value={assetsTotal - liabTotal} tone="auto" estimate help="Ativos − passivos. Baseado em valores informados manualmente e nos saldos atuais; não é uma avaliação de mercado." />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2"><Section side="asset" title="Ativos" /><Section side="liability" title="Passivos" /></div>
      {list.length > 0 && <Card className="mt-4"><CardHeader title="Evolução dos bens informados" subtitle="Ativos − passivos cadastrados manualmente, pelo último valor informado em cada mês" /><div className="px-3 pb-4 pt-3"><BalanceArea data={series} height={200} /></div></Card>}
    </>
  );
}
