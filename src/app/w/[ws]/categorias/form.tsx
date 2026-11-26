"use client";
import { ActionForm, Submit } from "@/components/client";
import { saveCategory } from "@/app/actions/finance";
import { GROUP_LABEL } from "@/lib/templates";

const COLORS = ["", "#c6f432", "#8ab4ff", "#f5b83d", "#ff6b5e", "#b794f6", "#5eead4", "#f9a8d4", "#9a9aa2"];

export function CategoryForm({ ws, kind, parents, c, business }: { ws: string; kind: "income" | "expense"; parents: { id: string; name: string }[]; c?: { id: string; name: string; grp: string; parentId: string | null; color: string | null }; business: boolean }) {
  const groups = kind === "income" ? ["revenue", "other"] : business ? ["cost", "fixed", "variable", "investment", "withdrawal", "personal", "other"] : ["fixed", "variable", "investment", "other"];
  return (
    <ActionForm action={saveCategory}>
      <input type="hidden" name="ws" value={ws} /><input type="hidden" name="kind" value={kind} />{c && <input type="hidden" name="id" value={c.id} />}
      <label className="block"><span className="label">Nome</span><input name="name" defaultValue={c?.name} maxLength={50} className="input" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Dentro de</span><select name="parent_id" defaultValue={c?.parentId ?? ""} className="input"><option value="">— Categoria principal —</option>{parents.filter((p) => p.id !== c?.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="block"><span className="label">Grupo</span><select name="grp" defaultValue={c?.grp ?? groups[0]} className="input">{groups.map((g) => <option key={g} value={g}>{GROUP_LABEL[g as keyof typeof GROUP_LABEL]}</option>)}</select></label>
      </div>
      <div><span className="label">Cor</span><div className="flex flex-wrap gap-2">{COLORS.map((col) => (
        <label key={col || "none"} className="cursor-pointer"><input type="radio" name="color" value={col} defaultChecked={(c?.color ?? "") === col} className="peer sr-only" /><span className="block size-8 rounded-full border-2 border-transparent peer-checked:border-fg" style={{ background: col || "var(--color-surface-3)" }} /></label>
      ))}</div></div>
      <Submit className="w-full">{c ? "Salvar" : "Criar categoria"}</Submit>
    </ActionForm>
  );
}
