import { Plus } from "lucide-react";
import { getWorkspace } from "@/lib/data/workspace";
import { queryTransactions, type TxFilters } from "@/lib/data/tx-query";
import { Card, Money, PageHeader } from "@/components/ui";
import { Sheet } from "@/components/client";
import { TransactionForm } from "@/components/tx-form";
import { TxList } from "@/components/tx-list";
import { TxFiltersBar } from "@/components/tx-filters";
import { loadRefs } from "../refs";
import { monthEnd, todayISO } from "@/lib/finance/dates";

export const metadata = { title: "Movimentações" };

export default async function Page({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<TxFilters> }) {
  const [{ ws }, f] = await Promise.all([params, searchParams]);
  const ctx = await getWorkspace(ws);
  const refs = await loadRefs(ctx);
  // Sem filtro de data, mostra até o fim do mês atual (parcelas futuras ficam em Cartões/filtros).
  const defaultRange = !f.de && !f.ate && !f.status;
  const { rows, total } = await queryTransactions(ws, defaultRange ? { ...f, ate: monthEnd(todayISO()) } : f);
  const live = rows.filter((r) => r.status !== "canceled");
  const inc = live.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const exp = live.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  const exportUrl = `/api/exportar/movimentacoes?ws=${ws}&${new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][])}`;
  return (
    <>
      <PageHeader title="Movimentações" subtitle="Receitas, despesas, transferências e compras no cartão."
        actions={<>
          <a href={exportUrl} className="btn-secondary btn-sm">Exportar (Excel/CSV)</a>
          {ctx.canOperate && <Sheet title="Novo lançamento" trigger={<button className="btn-primary btn-sm hidden lg:inline-flex"><Plus size={16} /> Novo</button>}><TransactionForm refs={refs} /></Sheet>}
        </>} />
      <TxFiltersBar f={f} refs={refs} action={`${ctx.base}/movimentacoes`} />
      <div className="mb-3 grid grid-cols-3 gap-2 text-[13px]">
        <div className="card px-4 py-3"><div className="text-faint">Receitas</div><Money c={inc} className="font-semibold text-lime" /></div>
        <div className="card px-4 py-3"><div className="text-faint">Despesas</div><Money c={exp} className="font-semibold" /></div>
        <div className="card px-4 py-3"><div className="text-faint">Resultado</div><Money c={inc - exp} tone="auto" className="font-semibold" /></div>
      </div>
      <p className="mb-2 px-1 text-[12.5px] text-faint">{total > rows.length ? `Mostrando ${rows.length} de ${total}. Refine os filtros para ver mais.` : `${total} lançamento(s)${defaultRange ? " até o fim do mês atual" : ""}. Totais excluem transferências, ajustes e pagamentos de fatura.`}</p>
      <Card><TxList rows={rows} refs={refs} groupBy={f.status === "pending" || f.status === "overdue" ? "due" : "date"} /></Card>
    </>
  );
}
