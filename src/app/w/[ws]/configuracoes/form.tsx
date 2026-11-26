"use client";
import { ActionForm, MoneyInput, Submit } from "@/components/client";
import { updateSettings } from "@/app/actions/workspace";

export function SettingsForm({ ws, kind, s, name, tradeName }: { ws: string; kind: string; name: string; tradeName: string | null; s: { budget_thresholds?: number[]; min_cash?: number; withdrawal_limit?: number; reserve_target?: number; insight_frequency?: string; weekly_summary?: boolean } }) {
  const t = s.budget_thresholds ?? [50, 75, 90];
  const m = (c?: number) => (c !== undefined ? (c / 100).toFixed(2).replace(".", ",") : "");
  return (
    <ActionForm action={updateSettings} keepOpen>
      <input type="hidden" name="ws" value={ws} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Nome do ambiente</span><input name="name" defaultValue={name} className="input" /></label>
        {kind === "business" && <label className="block"><span className="label">Nome fantasia</span><input name="trade_name" defaultValue={tradeName ?? ""} className="input" /></label>}
      </div>
      <div><span className="label">Alertas de orçamento (%)</span><div className="grid grid-cols-3 gap-3">{t.map((v, i) => <input key={i} type="number" name={`t${i + 1}`} min={1} max={100} defaultValue={v} className="input" />)}</div><span className="mt-1 block text-[12.5px] text-faint">Você também é alertado ao ultrapassar 100%.</span></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">{kind === "business" ? "Caixa mínimo de segurança" : "Saldo mínimo desejado"}</span><MoneyInput name="min_cash" defaultValue={m(s.min_cash)} placeholder="Não definido" /></label>
        {kind === "business" && <label className="block"><span className="label">Limite mensal de retiradas</span><MoneyInput name="withdrawal_limit" defaultValue={m(s.withdrawal_limit)} placeholder="Não definido" /></label>}
        {kind === "business" && <label className="block"><span className="label">Reserva empresarial desejada</span><MoneyInput name="reserve_target" defaultValue={m(s.reserve_target)} placeholder="Não definido" /></label>}
      </div>
      <label className="block"><span className="label">Frequência dos insights</span><select name="insight_frequency" defaultValue={s.insight_frequency ?? "all"} className="input"><option value="all">Todos os insights</option><option value="important">Apenas atenção e prioridade alta</option><option value="off">Somente prioridade alta</option></select></label>
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="weekly_summary" defaultChecked={s.weekly_summary ?? true} className="size-4 accent-[var(--color-lime)]" /> Mostrar resumo semanal na Inteligência</label>
      <Submit>Salvar configurações</Submit>
    </ActionForm>
  );
}
