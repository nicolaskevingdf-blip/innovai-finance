"use client";
import { ActionForm, MoneyInput, Submit } from "@/components/client";
import { addDebtPayment, saveDebt } from "@/app/actions/planning";

export interface DebtView { id: string; creditor: string; description: string | null; total: number; rate: number | null; installmentsTotal: number | null; installment: number | null; dueDay: number | null; startDate: string; status: string }
const m = (c: number | null) => (c ? (c / 100).toFixed(2).replace(".", ",") : "");

export function DebtForm({ ws, d, today }: { ws: string; d?: DebtView; today: string }) {
  return (
    <ActionForm action={saveDebt}>
      <input type="hidden" name="ws" value={ws} />{d && <input type="hidden" name="id" value={d.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Credor</span><input name="creditor" defaultValue={d?.creditor} className="input" placeholder="Ex.: Banco X, financiamento" /></label>
        <label className="block"><span className="label">Descrição</span><input name="description" defaultValue={d?.description ?? ""} className="input" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Valor total devido</span><MoneyInput name="total_amount" defaultValue={m(d?.total ?? null)} /></label>
        <label className="block"><span className="label">Juros (% ao mês) <span className="text-faint">se souber</span></span><input name="monthly_interest_rate" inputMode="decimal" defaultValue={d?.rate ?? ""} className="input" placeholder="Ex.: 2,5" /></label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="block"><span className="label">Parcelas</span><input type="number" name="installments_total" min={1} defaultValue={d?.installmentsTotal ?? ""} className="input" /></label>
        <label className="block col-span-2"><span className="label">Valor da parcela</span><MoneyInput name="installment_amount" defaultValue={m(d?.installment ?? null)} /></label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="block"><span className="label">Vence dia</span><input type="number" name="due_day" min={1} max={31} defaultValue={d?.dueDay ?? ""} className="input" /></label>
        <label className="block col-span-2"><span className="label">Início</span><input type="date" name="start_date" defaultValue={d?.startDate ?? today} className="input" /></label>
      </div>
      {d && <label className="block"><span className="label">Situação</span><select name="status" defaultValue={d.status} className="input"><option value="active">Ativa</option><option value="renegotiating">Em renegociação</option><option value="paid">Quitada</option><option value="canceled">Cancelada</option></select></label>}
      <Submit className="w-full">{d ? "Salvar" : "Adicionar dívida"}</Submit>
    </ActionForm>
  );
}

export function DebtPaymentForm({ ws, debtId, installment, accounts, today }: { ws: string; debtId: string; installment: number | null; accounts: { id: string; name: string }[]; today: string }) {
  return (
    <ActionForm action={addDebtPayment}>
      <input type="hidden" name="ws" value={ws} /><input type="hidden" name="debt_id" value={debtId} />
      <div className="grid grid-cols-2 gap-3"><MoneyInput name="amount" defaultValue={m(installment)} /><input type="date" name="date" defaultValue={today} className="input" /></div>
      <label className="flex items-center gap-2 text-[13px] text-muted"><input type="checkbox" name="register_expense" defaultChecked className="size-4 accent-[var(--color-lime)]" /> Registrar também como despesa paga na conta</label>
      <select name="account_id" className="input">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <p className="text-[12.5px] text-faint">Desmarque se o pagamento já foi lançado em Movimentações, para não duplicar.</p>
      <Submit className="w-full">Registrar pagamento</Submit>
    </ActionForm>
  );
}
