"use client";
import { ActionForm, MoneyInput, Submit } from "@/components/client";
import { adjustBalance, saveAccount } from "@/app/actions/finance";
import { ACCOUNT_TYPES } from "@/lib/templates";

export function AccountForm({ ws, a }: { ws: string; a?: { id: string; name: string; type: string; institution: string | null } }) {
  return (
    <ActionForm action={saveAccount}>
      <input type="hidden" name="ws" value={ws} />{a && <input type="hidden" name="id" value={a.id} />}
      <label className="block"><span className="label">Nome</span><input name="name" defaultValue={a?.name} className="input" placeholder="Ex.: Itaú, Carteira, Caixa da loja" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Tipo</span><select name="type" defaultValue={a?.type ?? "checking"} className="input">{ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        <label className="block"><span className="label">Instituição <span className="text-faint">(opcional)</span></span><input name="institution" defaultValue={a?.institution ?? ""} className="input" /></label>
      </div>
      {!a && <label className="block"><span className="label">Saldo atual</span><MoneyInput name="opening_balance" allowNegative /><span className="mt-1 block text-[12.5px] text-faint">Saldo inicial na data de hoje. Para corrigir depois, use “Ajustar saldo”.</span></label>}
      <Submit className="w-full">{a ? "Salvar" : "Adicionar conta"}</Submit>
    </ActionForm>
  );
}

export function AdjustForm({ ws, id }: { ws: string; id: string }) {
  return (
    <ActionForm action={adjustBalance}>
      <input type="hidden" name="ws" value={ws} /><input type="hidden" name="account_id" value={id} />
      <p className="text-[14px] text-muted">Informe o saldo real da conta. A diferença é registrada como <b className="text-fg">ajuste</b> — fica no histórico, mas não entra em receitas nem despesas.</p>
      <label className="block"><span className="label">Saldo real hoje</span><MoneyInput name="real_balance" allowNegative /></label>
      <label className="block"><span className="label">Motivo</span><input name="reason" className="input" placeholder="Ex.: conferência com extrato" /></label>
      <Submit className="w-full">Ajustar saldo</Submit>
    </ActionForm>
  );
}
