"use client";
import { useState } from "react";
import { ActionForm, CopyButton, Submit } from "@/components/client";
import { inviteMember } from "@/app/actions/workspace";
import { ROLES } from "@/lib/templates";


export function InviteForm({ ws, origin }: { ws: string; origin: string }) {
  const [link, setLink] = useState<string | null>(null);
  return (
    <ActionForm action={inviteMember} keepOpen onDone={(s) => setLink(`${origin}/convite/${(s?.data as { token: string }).token}`)}>
      <input type="hidden" name="ws" value={ws} />
      <label className="block"><span className="label">E-mail da pessoa</span><input name="email" type="email" className="input" /></label>
      <div className="space-y-2">{ROLES.map(([v, l, d], i) => (
        <label key={v} className="card flex cursor-pointer items-center gap-3 px-4 py-3 has-[:checked]:border-lime/50"><input type="radio" name="role" value={v} defaultChecked={i === 3} className="accent-[var(--color-lime)]" /><span><span className="block text-[14px]">{l}</span><span className="text-[12.5px] text-faint">{d}</span></span></label>
      ))}</div>
      <Submit className="w-full">Criar convite</Submit>
      {link && <div className="rounded-xl border border-line bg-surface-2 p-3"><div className="mb-2 break-all text-[12.5px] text-muted">{link}</div><CopyButton text={link} label="Copiar link do convite" /><p className="mt-2 text-[12px] text-faint">Válido por 7 dias e somente para o e-mail informado. O envio automático por e-mail depende de um provedor de e-mail (pendente).</p></div>}
    </ActionForm>
  );
}
