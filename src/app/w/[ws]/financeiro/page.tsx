import { Plus } from "lucide-react";
import { getWorkspace } from "@/lib/data/workspace";
import { queryTransactions, type TxFilters } from "@/lib/data/tx-query";
import { loadLedger } from "@/lib/data/ledger";
import { obligationTotals } from "@/lib/finance/obligations";
import { Card, Money, PageHeader, Tabs } from "@/components/ui";
import { Sheet } from "@/components/client";
import { TransactionForm } from "@/components/tx-form";
import { TxList } from "@/components/tx-list";
import { TxFiltersBar } from "@/components/tx-filters";
import { loadRefs } from "../refs";

export const metadata = { title: "Financeiro" };

export default async function Page({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<TxFilters & { aba?: string }> }) {
  const [{ ws }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getWorkspace(ws);
  const refs = await loadRefs(ctx);
  const aba = sp.aba === "pagar" || sp.aba === "receber" ? sp.aba : "todas";
  const { aba: _a, ...f } = sp; void _a;
  const filters: TxFilters = aba === "todas" ? f : { ...f, tipo: aba === "pagar" ? "expense" : "income", status: f.status || "pending" };
  const [{ rows, total }, L] = await Promise.all([queryTransactions(ws, filters), loadLedger(ws)]);
  const ob = aba === "todas" ? null : obligationTotals(L.txs, aba === "pagar" ? "expense" : "income", L.today);
  const base = `${ctx.base}/financeiro`;
  return (
    <>
      <PageHeader title="Financeiro" subtitle="Vendas, despesas, contas a pagar e a receber."
        actions={ctx.canOperate && <>
          <Sheet title="Nova venda / receita" trigger={<button className="btn-secondary btn-sm"><Plus size={16} /> Receita</button>}><TransactionForm refs={refs} defaultType="income" /></Sheet>
          <Sheet title="Nova despesa / conta a pagar" trigger={<button className="btn-primary btn-sm"><Plus size={16} /> Despesa</button>}><TransactionForm refs={refs} defaultType="expense" defaultStatus={aba === "pagar" ? "pending" : "paid"} /></Sheet>
        </>} />
      <Tabs active={aba} items={[{ key: "todas", label: "Todas", href: base }, { key: "pagar", label: "Contas a pagar", href: `${base}?aba=pagar` }, { key: "receber", label: "Contas a receber", href: `${base}?aba=receber` }]} />
      {ob && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 text-[13px]">
          <div className="card px-4 py-3"><div className="text-faint">Em aberto</div><Money c={ob.open} className="font-semibold" /></div>
          <div className="card px-4 py-3"><div className="text-faint">{aba === "pagar" ? "Vencido" : "Em atraso (inadimplência registrada)"}</div><Money c={ob.overdue} className={ob.overdue ? "font-semibold text-neg" : "font-semibold"} /></div>
          <div className="card px-4 py-3"><div className="text-faint">Próximos 7 dias</div><Money c={ob.next7} className="font-semibold" /></div>
          <div className="card px-4 py-3"><div className="text-faint">Próximos 30 dias</div><Money c={ob.next30} className="font-semibold" /></div>
        </div>
      )}
      <TxFiltersBar f={filters} refs={refs} action={base} hidden={aba === "todas" ? {} : { aba }} showType={aba === "todas"} />
      <p className="mb-2 px-1 text-[12.5px] text-faint">{total} lançamento(s){aba !== "todas" ? " · ordenados por vencimento" : ""}</p>
      <Card><TxList rows={rows} refs={refs} groupBy={aba === "todas" ? "date" : "due"} emptyText={aba === "pagar" ? "Nenhuma conta a pagar com esses filtros." : aba === "receber" ? "Nenhum valor a receber com esses filtros." : undefined} /></Card>
    </>
  );
}
