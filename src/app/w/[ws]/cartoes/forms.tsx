"use client";
import { ActionForm, MoneyInput, Submit } from "@/components/client";
import { payInvoice, saveCard } from "@/app/actions/finance";

export function CardForm({ ws, c }: { ws: string; c?: { id: string; name: string; bank: string | null; limit: number; closingDay: number; dueDay: number } }) {
  return (
    <ActionForm action={saveCard}>
      <input type="hidden" name="ws" value={ws} />{c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Nome do cartão</span><input name="name" defaultValue={c?.name} className="input" placeholder="Ex.: Nubank Roxinho" /></label>
        <label className="block"><span className="label">Banco <span className="text-faint">(opcional)</span></span><input name="bank" defaultValue={c?.bank ?? ""} className="input" /></label>
      </div>
      <label className="block"><span className="label">Limite total</span><MoneyInput name="limit_amount" defaultValue={c ? (c.limit / 100).toFixed(2).replace(".", ",") : ""} /></label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block"><span className="label">Dia de fechamento</span><input type="number" name="closing_day" min={1} max={28} defaultValue={c?.closingDay} className="input" /></label>
        <label className="block"><span className="label">Dia de vencimento</span><input type="number" name="due_day" min={1} max={28} defaultValue={c?.dueDay} className="input" /></label>
      </div>
      <p className="text-[12.5px] text-faint">Compras feitas a partir do dia de fechamento entram na fatura do mês seguinte.</p>
      <Submit className="w-full">{c ? "Salvar" : "Adicionar cartão"}</Submit>
    </ActionForm>
  );
}

export function PayInvoiceForm({ ws, cardId, month, remaining, accounts, today }: { ws: string; cardId: string; month: string; remaining: number; accounts: { id: string; name: string }[]; today: string }) {
  return (
    <ActionForm action={payInvoice}>
      <input type="hidden" name="ws" value={ws} /><input type="hidden" name="card_id" value={cardId} /><input type="hidden" name="invoice_month" value={month} />
      <p className="text-[14px] text-muted">O pagamento sai da conta escolhida e quita a fatura. Ele <b className="text-fg">não é contado como nova despesa</b>: as compras já foram registradas.</p>
      <label className="block"><span className="label">Valor pago</span><MoneyInput name="amount" defaultValue={(remaining / 100).toFixed(2).replace(".", ",")} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Conta</span><select name="account_id" className="input">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label className="block"><span className="label">Data</span><input type="date" name="date" defaultValue={today} className="input" /></label>
      </div>
      <Submit className="w-full">Registrar pagamento</Submit>
    </ActionForm>
  );
}
