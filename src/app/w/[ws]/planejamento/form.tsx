"use client";
import { ActionForm, MoneyInput, Submit } from "@/components/client";
import { saveBudgets } from "@/app/actions/planning";

export function BudgetForm({ ws, month, rows, income, savings }: { ws: string; month: string; rows: { id: string; name: string; amount: number | null; avg: number | null }[]; income: number; savings: number }) {
  const v = (c: number | null) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");
  return (
    <ActionForm action={saveBudgets}>
      <input type="hidden" name="ws" value={ws} /><input type="hidden" name="month" value={month} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Renda prevista no mês</span><MoneyInput name="expected_income" defaultValue={v(income)} /></label>
        <label className="block"><span className="label">Meta de economia</span><MoneyInput name="savings_target" defaultValue={v(savings)} /></label>
      </div>
      <div className="eyebrow pt-2">Limites por categoria</div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1"><div className="truncate text-[14px]">{r.name}</div>{r.avg !== null && <div className="text-[11.5px] text-faint">média 3 meses: {(r.avg / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>}</div>
            <div className="w-40"><MoneyInput name={`b_${r.id}`} defaultValue={v(r.amount)} placeholder="—" /></div>
          </div>
        ))}
      </div>
      <Submit className="w-full">Salvar planejamento</Submit>
    </ActionForm>
  );
}
