"use client";
import { ActionForm, MoneyInput, Submit } from "@/components/client";
import { closeCash, registerDailySales } from "@/app/actions/finance";
import { formatBRL } from "@/lib/finance/money";
import { useState } from "react";
import { parseMoneyInput } from "@/lib/finance/money";

export function SalesForm({ ws, date, cashAccounts, bankAccounts, categories }: { ws: string; date: string; cashAccounts: { id: string; name: string }[]; bankAccounts: { id: string; name: string }[]; categories: { id: string; name: string }[] }) {
  const methods = [["cash", "Dinheiro"], ["pix", "PIX"], ["debit", "Cartão de débito"], ["credit", "Cartão de crédito"], ["app", "Aplicativos (iFood etc.)"], ["other", "Outros"]];
  return (
    <ActionForm action={registerDailySales}>
      <input type="hidden" name="ws" value={ws} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Data das vendas</span><input type="date" name="date" defaultValue={date} className="input" /></label>
        <label className="block"><span className="label">Categoria</span><select name="category_id" className="input">{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      </div>
      <div className="space-y-2">{methods.map(([k, l]) => <div key={k} className="flex items-center gap-3"><span className="flex-1 text-[14px]">{l}</span><div className="w-44"><MoneyInput name={`m_${k}`} placeholder="—" /></div></div>)}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Dinheiro entra no</span><select name="cash_account" className="input">{cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label className="block"><span className="label">PIX/cartões entram na</span><select name="bank_account" className="input">{bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label className="block"><span className="label">Crédito recebe em (dias)</span><input type="number" name="credit_days" defaultValue={30} min={0} max={120} className="input" /></label>
        <label className="block"><span className="label">Aplicativos repassam em (dias)</span><input type="number" name="app_days" defaultValue={30} min={0} max={120} className="input" /></label>
      </div>
      <p className="text-[12.5px] text-faint">Vendas no crédito e em aplicativos entram no faturamento do dia, mas ficam como <b>a receber</b> até a data de repasse.</p>
      <Submit className="w-full">Registrar faturamento do dia</Submit>
    </ActionForm>
  );
}

export function CloseForm({ ws, accountId, date, opening, cashIn, cashOut, sales }: { ws: string; accountId: string; date: string; opening: number; cashIn: number; cashOut: number; sales: Record<string, number> }) {
  const expected = opening + cashIn - cashOut;
  const [counted, setCounted] = useState("");
  const c = parseMoneyInput(counted);
  const diff = c === null ? null : c - expected;
  const m = (x: number) => (x / 100).toFixed(2);
  return (
    <ActionForm action={closeCash}>
      <input type="hidden" name="ws" value={ws} /><input type="hidden" name="account_id" value={accountId} /><input type="hidden" name="date" value={date} />
      <input type="hidden" name="opening_amount" value={m(opening)} /><input type="hidden" name="cash_in" value={m(cashIn)} /><input type="hidden" name="cash_out" value={m(cashOut)} />
      <input type="hidden" name="sales_by_method" value={JSON.stringify(sales)} />
      <div className="card px-4 py-2 text-[14px]">
        {[["Saldo inicial", opening], ["(+) Entradas em dinheiro", cashIn], ["(−) Saídas e retiradas", -cashOut]].map(([l, v]) => <div key={l as string} className="flex justify-between border-t border-line py-2 first:border-t-0"><span className="text-muted">{l}</span><span className="num">{formatBRL(v as number)}</span></div>)}
        <div className="flex justify-between border-t border-line py-2 font-semibold"><span>Saldo esperado</span><span className="num">{formatBRL(expected)}</span></div>
      </div>
      <label className="block"><span className="label">Valor contado na gaveta</span>
        <div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-faint">R$</span><input name="counted_amount" value={counted} onChange={(e) => setCounted(e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" className="input num h-14 pl-12 text-[22px] font-semibold" /></div>
      </label>
      {diff !== null && <div className={`rounded-xl px-4 py-3 text-[14px] ${diff === 0 ? "bg-lime-soft text-lime" : "bg-warn-soft text-warn"}`}>{diff === 0 ? "Caixa confere." : `Diferença de ${formatBRL(diff, { signed: true })} (${diff > 0 ? "sobra" : "falta"}).`}</div>}
      {diff !== null && diff !== 0 && <label className="block"><span className="label">Justificativa</span><textarea name="justification" rows={2} className="input" placeholder="Ex.: troco errado, sangria não registrada…" /></label>}
      <Submit className="w-full">Fechar caixa</Submit>
    </ActionForm>
  );
}
