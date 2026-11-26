"use client";
import { ActionForm, Submit } from "@/components/client";
import { saveContact } from "@/app/actions/finance";

export function ContactForm({ ws, kind, c }: { ws: string; kind: "client" | "supplier"; c?: { id: string; name: string; phone: string | null; email: string | null; document: string | null; notes: string | null } }) {
  return (
    <ActionForm action={saveContact}>
      <input type="hidden" name="ws" value={ws} /><input type="hidden" name="kind" value={kind} />{c && <input type="hidden" name="id" value={c.id} />}
      <label className="block"><span className="label">Nome</span><input name="name" defaultValue={c?.name} className="input" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="label">Telefone</span><input name="phone" type="tel" defaultValue={c?.phone ?? ""} className="input" /></label>
        <label className="block"><span className="label">E-mail</span><input name="email" type="email" defaultValue={c?.email ?? ""} className="input" /></label>
      </div>
      <label className="block"><span className="label">CPF/CNPJ <span className="text-faint">(opcional)</span></span><input name="document" defaultValue={c?.document ?? ""} className="input" /></label>
      <label className="block"><span className="label">Observações</span><textarea name="notes" rows={2} defaultValue={c?.notes ?? ""} className="input" /></label>
      <Submit className="w-full">Salvar</Submit>
    </ActionForm>
  );
}
