"use client";
import clsx from "clsx";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CreditCard, Paperclip, Repeat, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { ActionForm, ConfirmSubmit, MoneyInput, Sheet, Submit } from "./client";
import { CategorySelect, type FormRefs } from "./tx-form";
import { cancelTransaction, deleteTransaction, settleTransaction, updateTransaction, uploadAttachment } from "@/app/actions/finance";
import { formatBRL } from "@/lib/finance/money";
import { fmtDate, fmtDayMonth } from "@/lib/finance/dates";
import { OBLIGATION_LABEL, type ObligationStatus } from "@/lib/finance/obligations";
import { PAYMENT_METHODS } from "@/lib/templates";
import type { TxRow } from "@/lib/data/tx-query";

const STATUS_TONE: Record<ObligationStatus, string> = { pending: "text-muted", overdue: "text-neg", due_today: "text-warn", scheduled: "text-info", partial: "text-warn", paid: "text-lime", canceled: "text-faint" };

export function statusOf(r: TxRow, today: string): ObligationStatus {
  if (r.status === "canceled") return "canceled";
  if (r.status === "paid") return "paid";
  const due = r.dueDate ?? r.date;
  if (due < today) return "overdue";
  if (due === today) return "due_today";
  if (r.tags.includes("parcial")) return "partial";
  return r.tags.includes("programada") ? "scheduled" : "pending";
}

export function TxRowItem({ r, refs, showDue }: { r: TxRow; refs: FormRefs; showDue?: boolean }) {
  const [tab, setTab] = useState<"info" | "edit" | "settle">("info");
  const st = statusOf(r, refs.today);
  const Icon = r.type === "income" ? ArrowDownLeft : r.type === "transfer" ? ArrowLeftRight : r.cardId ? CreditCard : r.type === "adjustment" ? SlidersHorizontal : ArrowUpRight;
  const sign = r.type === "income" ? 1 : r.type === "transfer" ? 0 : r.type === "adjustment" ? Math.sign(r.amount) : -1;
  const sub = [r.category ?? (r.type === "transfer" ? `${r.account} → ${r.toAccount}` : r.type === "card_payment" ? "Pagamento de fatura" : r.type === "adjustment" ? "Ajuste de saldo" : "Sem categoria"), r.card ?? r.account, r.contact].filter(Boolean).join(" · ");
  const isPending = r.status === "pending";
  return (
    <Sheet title={r.description} onClose={() => setTab("info")} trigger={
      <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-surface-2">
        <span className={clsx("flex size-10 shrink-0 items-center justify-center rounded-xl", r.type === "income" ? "bg-lime-soft text-lime" : "bg-surface-3 text-muted")}><Icon size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate text-[14.5px]">{r.description}{r.recurrenceId && <Repeat size={12} className="shrink-0 text-faint" />}{r.attachments.length > 0 && <Paperclip size={12} className="shrink-0 text-faint" />}</span>
          <span className="block truncate text-[12.5px] text-faint">{sub}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className={clsx("num block text-[14.5px] font-medium", sign > 0 && "text-lime", r.status === "canceled" && "line-through opacity-50")}>{sign > 0 ? "+" : sign < 0 ? "−" : ""}{formatBRL(Math.abs(r.amount))}</span>
          <span className={clsx("block text-[11.5px]", STATUS_TONE[st])}>{isPending ? `${OBLIGATION_LABEL[st]}${showDue ? ` · ${fmtDayMonth(r.dueDate ?? r.date)}` : ""}` : r.status === "canceled" ? "Cancelada" : r.cardId ? `Fatura ${r.invoiceMonth?.slice(5, 7)}/${r.invoiceMonth?.slice(2, 4)}` : ""}</span>
        </span>
      </button>
    }>
      <div className="pb-2">
        <div className="mb-4 flex gap-1.5">
          {[["info", "Detalhes"], ...(refs.canWrite && r.type !== "card_payment" && r.type !== "adjustment" ? [["edit", "Editar"]] : []), ...(isPending && !r.cardId && refs.canWrite ? [["settle", r.type === "income" ? "Receber" : "Pagar"]] : [])].map(([k, l]) => (
            <button key={k} type="button" data-active={tab === k} onClick={() => setTab(k as typeof tab)} className="chip">{l}</button>
          ))}
        </div>
        {tab === "info" && <Info r={r} refs={refs} st={st} />}
        {tab === "edit" && <Edit r={r} refs={refs} />}
        {tab === "settle" && <Settle r={r} refs={refs} />}
      </div>
    </Sheet>
  );
}

function Info({ r, refs, st }: { r: TxRow; refs: FormRefs; st: ObligationStatus }) {
  const line = (k: string, v: React.ReactNode) => v ? <div className="flex justify-between gap-4 border-t border-line py-2.5 text-[14px] first:border-t-0"><span className="text-muted">{k}</span><span className="text-right">{v}</span></div> : null;
  const method = PAYMENT_METHODS.find((p) => p.value === r.paymentMethod)?.label;
  return (
    <div>
      <div className="num mb-4 text-[30px] font-semibold">{formatBRL(Math.abs(r.amount))}</div>
      <div className="card px-4 py-1">
        {line("Tipo", { income: "Receita", expense: r.cardId ? "Compra no cartão" : "Despesa", transfer: "Transferência", adjustment: "Ajuste de saldo", card_payment: "Pagamento de fatura" }[r.type])}
        {line("Situação", <span className={STATUS_TONE[st]}>{OBLIGATION_LABEL[st]}</span>)}
        {line("Data", fmtDate(r.date))}
        {r.status === "pending" && line("Vencimento", fmtDate(r.dueDate))}
        {r.status === "paid" && r.paidAt && line(r.type === "income" ? "Recebido em" : "Pago em", fmtDate(r.paidAt))}
        {line("Categoria", r.category)}
        {line("Conta", r.type === "transfer" ? `${r.account} → ${r.toAccount}` : r.account)}
        {line("Cartão", r.card && `${r.card} · fatura ${r.invoiceMonth?.slice(5, 7)}/${r.invoiceMonth?.slice(0, 4)}`)}
        {line("Parcela", r.installment)}
        {line("Contato", r.contact)}
        {line("Forma de pagamento", method)}
        {line("Tags", r.tags.length ? r.tags.join(", ") : null)}
        {line("Observações", r.notes)}
        {line("Origem", r.source === "ai_text" ? "Texto (IA)" : r.source === "voice" ? "Voz" : r.source === "recurrence" ? "Recorrência" : null)}
      </div>

      <div className="mt-4">
        <div className="eyebrow mb-2">Documentos</div>
        {r.attachments.map((a) => <a key={a.id} href={`/api/documentos/${a.id}`} target="_blank" rel="noreferrer" className="mb-1.5 flex items-center gap-2 text-[14px] text-lime"><Paperclip size={14} /> {a.file_name}</a>)}
        {refs.canWrite && (
          <ActionForm action={uploadAttachment} keepOpen resetOnSuccess className="!space-y-2">
            <input type="hidden" name="ws" value={refs.ws} /><input type="hidden" name="transaction_id" value={r.id} />
            <div className="flex gap-2">
              <select name="kind" className="input w-40"><option value="receipt">Recibo</option><option value="invoice">Nota fiscal</option><option value="boleto">Boleto</option><option value="proof">Comprovante</option><option value="contract">Contrato</option><option value="bill">Fatura</option><option value="other">Outro</option></select>
              <input type="file" name="file" accept="application/pdf,image/*" className="input flex-1 pt-2 text-[13px] file:mr-2 file:rounded-md file:border-0 file:bg-surface-3 file:px-2 file:text-fg" />
            </div>
            <Submit className="btn-sm w-full" pendingText="Enviando…">Anexar documento</Submit>
          </ActionForm>
        )}
      </div>

      {refs.canWrite && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          {r.status === "pending" && (
            <form action={cancelTransaction}><input type="hidden" name="ws" value={refs.ws} /><input type="hidden" name="id" value={r.id} /><ConfirmSubmit message="Cancelar este lançamento? Ele deixa de contar nas projeções." className="btn-secondary btn-sm">Cancelar lançamento</ConfirmSubmit></form>
          )}
          <form action={deleteTransaction}><input type="hidden" name="ws" value={refs.ws} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="scope" value="one" /><ConfirmSubmit message="Excluir este lançamento definitivamente?" className="btn-danger btn-sm">Excluir</ConfirmSubmit></form>
          {r.installmentGroup && <form action={deleteTransaction}><input type="hidden" name="ws" value={refs.ws} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="scope" value="group" /><ConfirmSubmit message="Excluir TODAS as parcelas desta compra?" className="btn-danger btn-sm">Excluir todas as parcelas</ConfirmSubmit></form>}
          {r.recurrenceId && r.status === "pending" && <form action={deleteTransaction}><input type="hidden" name="ws" value={refs.ws} /><input type="hidden" name="id" value={r.id} /><input type="hidden" name="scope" value="future" /><ConfirmSubmit message="Excluir esta e as próximas ocorrências pendentes?" className="btn-danger btn-sm">Excluir esta e as próximas</ConfirmSubmit></form>}
        </div>
      )}
    </div>
  );
}

function Edit({ r, refs }: { r: TxRow; refs: FormRefs }) {
  return (
    <ActionForm action={updateTransaction}>
      <input type="hidden" name="ws" value={refs.ws} /><input type="hidden" name="id" value={r.id} />
      <label className="block"><span className="label">Valor</span><MoneyInput name="amount" defaultValue={(r.amount / 100).toFixed(2).replace(".", ",")} /></label>
      <label className="block"><span className="label">Descrição</span><input name="description" defaultValue={r.description} maxLength={140} className="input" /></label>
      {r.type !== "transfer" && <label className="block"><span className="label">Categoria</span><CategorySelect categories={refs.categories} kind={r.type === "income" ? "income" : "expense"} value={r.categoryId ?? ""} /></label>}
      {!r.cardId && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="label">Data</span><input type="date" name="date" defaultValue={r.date} className="input" /></label>
          {r.status === "pending" ? <label className="block"><span className="label">Vencimento</span><input type="date" name="due_date" defaultValue={r.dueDate ?? r.date} className="input" /></label>
            : r.type !== "transfer" && <label className="block"><span className="label">Conta</span><select name="account_id" defaultValue={r.accountId ?? ""} className="input">{refs.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
        </div>
      )}
      {r.cardId && <><input type="hidden" name="date" value={r.date} /><p className="text-[12.5px] text-faint">Data e fatura de compras no cartão não podem ser alteradas. Para corrigir, exclua e lance novamente.</p></>}
      {!r.cardId && <label className="block"><span className="label">Forma de pagamento</span><select name="payment_method" defaultValue={r.paymentMethod ?? ""} className="input"><option value="">—</option>{PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>}
      {refs.kind === "business" && <label className="block"><span className="label">Contato</span><select name="contact_id" defaultValue={r.contactId ?? ""} className="input"><option value="">—</option>{refs.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <label className="block"><span className="label">Tags</span><input name="tags" defaultValue={r.tags.join(", ")} className="input" /></label>
      <label className="block"><span className="label">Observações</span><textarea name="notes" defaultValue={r.notes ?? ""} rows={2} className="input" /></label>
      <Submit className="w-full">Salvar alterações</Submit>
    </ActionForm>
  );
}

function Settle({ r, refs }: { r: TxRow; refs: FormRefs }) {
  return (
    <ActionForm action={settleTransaction}>
      <input type="hidden" name="ws" value={refs.ws} /><input type="hidden" name="id" value={r.id} />
      <p className="text-[14px] text-muted">Em aberto: <b className="num text-fg">{formatBRL(r.amount)}</b>. Informe um valor menor para registrar um pagamento parcial — o restante continua pendente.</p>
      <label className="block"><span className="label">Valor {r.type === "income" ? "recebido" : "pago"}</span><MoneyInput name="amount" defaultValue={(r.amount / 100).toFixed(2).replace(".", ",")} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Data</span><input type="date" name="date" defaultValue={refs.today} className="input" /></label>
        <label className="block"><span className="label">Conta</span><select name="account_id" defaultValue={r.accountId ?? refs.accounts[0]?.id} className="input">{refs.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      </div>
      <label className="block"><span className="label">Forma de pagamento</span><select name="payment_method" defaultValue={r.paymentMethod ?? ""} className="input"><option value="">—</option>{PAYMENT_METHODS.filter((p) => p.value !== "credit").map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
      <Submit className="w-full">Confirmar {r.type === "income" ? "recebimento" : "pagamento"}</Submit>
    </ActionForm>
  );
}
