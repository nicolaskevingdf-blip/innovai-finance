"use client";
import { ActionForm, MoneyInput, Submit } from "@/components/client";
import { saveAsset } from "@/app/actions/planning";

const TYPES = { asset: [["property", "Imóvel"], ["vehicle", "Veículo"], ["investment", "Investimento"], ["account", "Valor em conta"], ["good", "Bem"], ["other", "Outro ativo"]], liability: [["financing", "Financiamento"], ["loan", "Empréstimo"], ["other", "Outro passivo"]] } as const;

export function AssetForm({ ws, side, a, today }: { ws: string; side: "asset" | "liability"; a?: { id: string; name: string; type: string; notes: string | null; value: number }; today: string }) {
  return (
    <ActionForm action={saveAsset}>
      <input type="hidden" name="ws" value={ws} /><input type="hidden" name="side" value={side} />{a && <input type="hidden" name="id" value={a.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Nome</span><input name="name" defaultValue={a?.name} className="input" placeholder={side === "asset" ? "Ex.: Apartamento, Moto, Tesouro Selic" : "Ex.: Financiamento do carro"} /></label>
        <label className="block"><span className="label">Tipo</span><select name="type" defaultValue={a?.type} className="input">{TYPES[side].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">{side === "asset" ? "Valor estimado por você" : "Saldo devedor"}</span><MoneyInput name="value" defaultValue={a ? (a.value / 100).toFixed(2).replace(".", ",") : ""} /></label>
        <label className="block"><span className="label">Data de referência</span><input type="date" name="date" defaultValue={today} className="input" /></label>
      </div>
      <label className="block"><span className="label">Observações</span><input name="notes" defaultValue={a?.notes ?? ""} className="input" /></label>
      <p className="text-[12.5px] text-faint">A Innovai não estima valores de bens. Atualize o valor sempre que quiser — cada atualização entra no histórico.</p>
      <Submit className="w-full">{a ? "Atualizar valor" : "Adicionar"}</Submit>
    </ActionForm>
  );
}
