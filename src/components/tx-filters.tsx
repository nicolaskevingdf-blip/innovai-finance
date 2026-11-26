import { Search, SlidersHorizontal } from "lucide-react";
import type { TxFilters } from "@/lib/data/tx-query";
import type { FormRefs } from "./tx-form";
import { PAYMENT_METHODS } from "@/lib/templates";

export function TxFiltersBar({ f, refs, action, hidden = {}, showType = true }: { f: TxFilters; refs: FormRefs; action: string; hidden?: Record<string, string>; showType?: boolean }) {
  const active = Object.entries(f).filter(([k, v]) => v && k !== "q" && !(k in hidden)).length;
  return (
    <form method="get" action={action} className="mb-4 space-y-3">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="flex gap-2">
        <div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" /><input name="q" defaultValue={f.q} placeholder="Buscar por descrição" className="input pl-10" /></div>
        <button className="btn-secondary">Buscar</button>
      </div>
      <details className="group" open={active > 0}>
        <summary className="chip w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden"><SlidersHorizontal size={14} /> Filtros{active ? ` (${active})` : ""}</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <label><span className="label">De</span><input type="date" name="de" defaultValue={f.de} className="input" /></label>
          <label><span className="label">Até</span><input type="date" name="ate" defaultValue={f.ate} className="input" /></label>
          {showType && <label><span className="label">Tipo</span><select name="tipo" defaultValue={f.tipo ?? ""} className="input"><option value="">Todos</option><option value="income">Receitas</option><option value="expense">Despesas</option><option value="transfer">Transferências</option><option value="card_payment">Pagamentos de fatura</option><option value="refund">Estornos</option><option value="adjustment">Ajustes</option></select></label>}
          <label><span className="label">Situação</span><select name="status" defaultValue={f.status ?? ""} className="input"><option value="">Todas</option><option value="paid">Pagas/recebidas</option><option value="pending">Pendentes</option><option value="overdue">Vencidas</option><option value="canceled">Canceladas</option></select></label>
          <label><span className="label">Categoria</span><select name="categoria" defaultValue={f.categoria ?? ""} className="input"><option value="">Todas</option>{refs.categories.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label><span className="label">Conta</span><select name="conta" defaultValue={f.conta ?? ""} className="input"><option value="">Todas</option>{refs.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          {refs.cards.length > 0 && <label><span className="label">Cartão</span><select name="cartao" defaultValue={f.cartao ?? ""} className="input"><option value="">Todos</option>{refs.cards.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
          <label><span className="label">Forma de pagamento</span><select name="metodo" defaultValue={f.metodo ?? ""} className="input"><option value="">Todas</option>{PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
          <label><span className="label">Valor mínimo</span><input name="min" defaultValue={f.min} inputMode="decimal" className="input" /></label>
          <label><span className="label">Valor máximo</span><input name="max" defaultValue={f.max} inputMode="decimal" className="input" /></label>
          <div className="col-span-2 flex items-end gap-2 sm:col-span-1"><button className="btn-primary btn-sm flex-1">Aplicar</button><a href={action + (Object.keys(hidden).length ? "?" + new URLSearchParams(hidden) : "")} className="btn-ghost btn-sm">Limpar</a></div>
        </div>
      </details>
    </form>
  );
}
