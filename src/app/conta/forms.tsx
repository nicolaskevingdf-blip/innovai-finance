"use client";
import { ActionForm, Submit } from "@/components/client";
import { deleteAccount, updateProfile } from "@/app/actions/account";

export function ProfileForm({ name }: { name: string }) {
  return (
    <ActionForm action={updateProfile} keepOpen>
      <label className="block"><span className="label">Nome</span><input name="full_name" defaultValue={name} className="input" /></label>
      <Submit className="btn-sm">Salvar</Submit>
    </ActionForm>
  );
}
export function DeleteAccountForm() {
  return (
    <ActionForm action={deleteAccount} keepOpen>
      <p className="text-[13.5px] text-muted">Apaga sua conta, os ambientes em que você é proprietário (com todos os dados e documentos) e remove seu acesso aos demais. Digite <b className="text-fg">EXCLUIR</b>.</p>
      <input name="confirm" className="input" autoComplete="off" />
      <button type="submit" className="btn-danger btn-sm" onClick={(e) => { if (!confirm("Excluir sua conta definitivamente?")) e.preventDefault(); }}>Excluir minha conta</button>
    </ActionForm>
  );
}
