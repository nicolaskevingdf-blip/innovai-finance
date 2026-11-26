import Link from "next/link";
import { getWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, Notice, PageHeader } from "@/components/ui";
import { ConfirmSubmit } from "@/components/client";
import { deleteWorkspace } from "@/app/actions/workspace";
import { STATUS_LABEL } from "@/lib/plans";
import { SEGMENTS } from "@/lib/templates";
import { fmtDate } from "@/lib/finance/dates";
import { SettingsForm } from "./form";

export const metadata = { title: "Configurações" };

export default async function Page({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const ctx = await getWorkspace(ws);
  const sb = await createClient();
  const [{ data: plans }, { data: audit }] = await Promise.all([
    sb.from("plans").select("*").eq("audience", ctx.ws.kind === "business" ? "business" : "personal").order("sort"),
    ctx.canAdmin ? sb.from("audit_log").select("action, entity, at, user_id").eq("workspace_id", ws).order("at", { ascending: false }).limit(15) : Promise.resolve({ data: [] }),
  ]);
  const plan = plans?.find((p) => p.code === ctx.sub?.plan_code);
  const ACTION: Record<string, string> = { insert: "criou", update: "alterou", delete: "excluiu" };
  const ENTITY: Record<string, string> = { transactions: "lançamento", financial_accounts: "conta", credit_cards: "cartão", cash_closings: "fechamento de caixa", attachments: "documento" };
  return (
    <>
      <PageHeader title="Configurações" subtitle={`${ctx.ws.kind === "business" ? `Empresa · ${SEGMENTS.find((s) => s.value === ctx.ws.segment)?.label ?? ""}` : "Finanças pessoais"}`} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          {ctx.canAdmin ? <SettingsForm ws={ws} kind={ctx.ws.kind} name={ctx.ws.name} tradeName={ctx.ws.trade_name} s={ctx.ws.settings as never} /> : <Notice>Somente proprietários e administradores podem alterar as configurações.</Notice>}
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <div className="eyebrow mb-2">Plano</div>
            <div className="text-[16px] font-semibold">{plan?.name ?? "—"}</div>
            <div className="mt-1"><Badge tone="lime">{ctx.sub ? STATUS_LABEL[ctx.sub.status] : "—"}</Badge></div>
            <p className="mt-3 text-[13px] text-muted">Durante o beta, todos os recursos do plano estão liberados sem cobrança. Planos e preços serão definidos após a validação comercial.</p>
          </Card>
          <Card className="p-5">
            <div className="eyebrow mb-2">Sua conta</div>
            <p className="text-[13.5px] text-muted">Exportação de dados, privacidade e exclusão de conta.</p>
            <Link href="/conta" className="btn-secondary btn-sm mt-3">Minha conta</Link>
          </Card>
          {ctx.role === "owner" && (
            <Card className="border-neg/25 p-5">
              <div className="eyebrow mb-2 text-neg">Zona de perigo</div>
              <form action={deleteWorkspace} className="space-y-2"><input type="hidden" name="ws" value={ws} />
                <p className="text-[13px] text-muted">Excluir o ambiente apaga permanentemente todos os seus dados. Digite <b className="text-fg">{ctx.ws.name}</b> para confirmar.</p>
                <input name="confirm" className="input" autoComplete="off" />
                <ConfirmSubmit message="Esta ação é irreversível. Excluir o ambiente?" className="btn-danger btn-sm w-full">Excluir ambiente</ConfirmSubmit>
              </form>
            </Card>
          )}
        </div>
      </div>
      {ctx.canAdmin && (audit ?? []).length > 0 && (
        <Card className="mt-4"><CardHeader title="Atividades recentes" subtitle="Registro de auditoria (sem valores financeiros)" />
          <div className="px-5 pb-4 pt-2">{audit!.map((a, i) => <div key={i} className="flex justify-between border-t border-line py-2 text-[13.5px] first:border-t-0"><span className="text-muted">{a.user_id === ctx.userId ? "Você" : "Um membro"} {ACTION[a.action] ?? a.action} {ENTITY[a.entity] ?? a.entity}</span><span className="text-faint">{fmtDate(a.at.slice(0, 10))} {a.at.slice(11, 16)}</span></div>)}</div>
        </Card>
      )}
    </>
  );
}
