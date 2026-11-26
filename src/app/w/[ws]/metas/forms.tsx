"use client";
import { ActionForm, MoneyInput, Submit } from "@/components/client";
import { addContribution, saveGoal } from "@/app/actions/planning";

const KINDS = [["emergency", "Reserva de emergência"], ["travel", "Viagem"], ["vehicle", "Veículo"], ["home", "Casa"], ["wedding", "Casamento"], ["purchase", "Compra de produto"], ["investment", "Investimento"], ["business", "Reinvestimento no negócio"], ["custom", "Personalizada"]];

export function GoalForm({ ws, g }: { ws: string; g?: { id: string; name: string; kind: string; target: number; targetDate: string | null } }) {
  return (
    <ActionForm action={saveGoal}>
      <input type="hidden" name="ws" value={ws} />{g && <input type="hidden" name="id" value={g.id} />}
      <label className="block"><span className="label">Tipo</span><select name="kind" defaultValue={g?.kind ?? "emergency"} className="input">{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className="block"><span className="label">Nome</span><input name="name" defaultValue={g?.name} className="input" placeholder="Ex.: Viagem para o Nordeste" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Valor desejado</span><MoneyInput name="target_amount" defaultValue={g ? (g.target / 100).toFixed(2).replace(".", ",") : ""} /></label>
        <label className="block"><span className="label">Prazo <span className="text-faint">(opcional)</span></span><input type="date" name="target_date" defaultValue={g?.targetDate ?? ""} className="input" /></label>
      </div>
      {!g && <label className="block"><span className="label">Já guardado <span className="text-faint">(opcional)</span></span><MoneyInput name="initial" /></label>}
      <Submit className="w-full">{g ? "Salvar" : "Criar meta"}</Submit>
    </ActionForm>
  );
}

export function ContributionForm({ ws, goalId, today }: { ws: string; goalId: string; today: string }) {
  return (
    <ActionForm action={addContribution} keepOpen resetOnSuccess>
      <input type="hidden" name="ws" value={ws} /><input type="hidden" name="goal_id" value={goalId} />
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput name="amount" />
        <input type="date" name="date" defaultValue={today} className="input" />
      </div>
      <input name="note" placeholder="Observação (opcional)" className="input" />
      <label className="flex items-center gap-2 text-[13px] text-muted"><input type="checkbox" name="withdraw" className="size-4 accent-[var(--color-lime)]" /> É um resgate (retirada da meta)</label>
      <Submit className="w-full">Registrar</Submit>
    </ActionForm>
  );
}
