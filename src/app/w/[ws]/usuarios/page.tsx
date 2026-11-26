import { headers } from "next/headers";
import { Plus } from "lucide-react";
import { getWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, Notice, PageHeader } from "@/components/ui";
import { ConfirmSubmit, Sheet } from "@/components/client";
import { removeMember, revokeInvite, updateMemberRole } from "@/app/actions/workspace";
import { fmtDate } from "@/lib/finance/dates";
import { InviteForm } from "./invite";
import { ROLES } from "@/lib/templates";

export const metadata = { title: "Usuários" };
const LABEL: Record<string, string> = { owner: "Proprietário", ...Object.fromEntries(ROLES.map(([v, l]) => [v, l])) };

export default async function Page({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const ctx = await getWorkspace(ws);
  const sb = await createClient();
  const [{ data: members }, { data: invites }] = await Promise.all([
    sb.rpc("workspace_member_list", { p_ws: ws }),
    ctx.canAdmin ? sb.from("workspace_invites").select("*").eq("workspace_id", ws).is("accepted_at", null).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const limit = { business_starter: 2, business_pro: 10, business_advanced: 50 }[ctx.sub?.plan_code ?? ""] ?? null;
  return (
    <>
      <PageHeader title="Usuários e permissões" subtitle="Cada pessoa acessa apenas este ambiente, com o perfil definido aqui."
        actions={ctx.canAdmin && <Sheet title="Convidar pessoa" trigger={<button className="btn-primary btn-sm"><Plus size={16} /> Convidar</button>}><InviteForm ws={ws} origin={origin} /></Sheet>} />
      {limit && <div className="mb-4"><Notice>Seu plano permite até {limit} usuários neste ambiente ({members?.length ?? 0} em uso).</Notice></div>}
      <Card>
        {(members ?? []).map((m: { user_id: string; role: string; full_name: string | null; email: string; created_at: string }) => (
          <div key={m.user_id} className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 first:border-t-0">
            <span className="flex size-10 items-center justify-center rounded-full bg-surface-3 text-[14px] font-medium">{(m.full_name ?? m.email).slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1"><div className="truncate text-[14.5px]">{m.full_name ?? m.email}{m.user_id === ctx.userId && <span className="text-faint"> (você)</span>}</div><div className="truncate text-[12.5px] text-faint">{m.email}</div></div>
            {ctx.canAdmin && m.role !== "owner" && m.user_id !== ctx.userId ? (
              <div className="flex items-center gap-2">
                <form action={updateMemberRole} className="flex gap-2"><input type="hidden" name="ws" value={ws} /><input type="hidden" name="user" value={m.user_id} />
                  <select name="role" defaultValue={m.role} className="input h-9 w-40 text-[13px]">{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select><button className="btn-secondary btn-sm">Salvar</button></form>
                <form action={removeMember}><input type="hidden" name="ws" value={ws} /><input type="hidden" name="user" value={m.user_id} /><ConfirmSubmit message="Remover o acesso desta pessoa?" className="btn-ghost btn-sm">Remover</ConfirmSubmit></form>
              </div>
            ) : <Badge tone={m.role === "owner" ? "lime" : "neutral"}>{LABEL[m.role]}</Badge>}
          </div>
        ))}
      </Card>
      {ctx.canAdmin && (invites ?? []).length > 0 && (
        <Card className="mt-4"><CardHeader title="Convites pendentes" />
          <div className="px-5 pb-4 pt-2">{invites!.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 border-t border-line py-2.5 text-[14px] first:border-t-0">
              <span className="min-w-0 truncate">{i.email} · <span className="text-muted">{LABEL[i.role]}</span> · <span className="text-faint">expira {fmtDate(i.expires_at.slice(0, 10))}</span></span>
              <form action={revokeInvite}><input type="hidden" name="ws" value={ws} /><input type="hidden" name="id" value={i.id} /><button className="btn-ghost btn-sm">Revogar</button></form>
            </div>))}</div>
        </Card>
      )}
      <Card className="mt-4 p-5">
        <div className="eyebrow mb-3">O que cada perfil pode fazer</div>
        <div className="grid gap-2 text-[13.5px] sm:grid-cols-2">{[["owner", "Proprietário", "Controle total, inclusive excluir o ambiente"], ...ROLES].map(([v, l, d]) => <div key={v}><b className="font-medium">{l}:</b> <span className="text-muted">{d}</span></div>)}</div>
      </Card>
    </>
  );
}
