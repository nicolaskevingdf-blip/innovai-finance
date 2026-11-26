import { FileText, Upload } from "lucide-react";
import { getWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { Card, Empty, Notice, PageHeader, Tabs } from "@/components/ui";
import { ConfirmSubmit, Sheet } from "@/components/client";
import { deleteAttachment } from "@/app/actions/documents";
import { fmtDateTime } from "@/lib/finance/dates";
import { aiEnabled } from "@/lib/ai/claude";
import { UploadForm } from "./upload";

export const metadata = { title: "Documentos" };
const KIND: Record<string, string> = { invoice: "Nota fiscal", boleto: "Boleto", receipt: "Recibo", proof: "Comprovante", contract: "Contrato", bill: "Fatura", purchase: "Compra", other: "Outro" };

export default async function Page({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<{ tipo?: string }> }) {
  const [{ ws }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getWorkspace(ws);
  const sb = await createClient();
  let q = sb.from("attachments").select("*, transactions(description, amount, date)").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(200);
  if (sp.tipo && KIND[sp.tipo]) q = q.eq("kind", sp.tipo);
  const { data: docs } = await q;
  const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
  return (
    <>
      <PageHeader title="Documentos" subtitle="Notas, boletos, recibos e comprovantes em armazenamento privado do ambiente."
        actions={ctx.canOperate && <Sheet title="Enviar documento" trigger={<button className="btn-primary btn-sm"><Upload size={15} /> Enviar</button>}><UploadForm ws={ws} /></Sheet>} />
      <Tabs active={sp.tipo ?? "all"} items={[{ key: "all", label: "Todos", href: "?" }, ...Object.entries(KIND).map(([k, l]) => ({ key: k, label: l, href: `?tipo=${k}` }))]} />
      <div className="mb-4"><Notice>{aiEnabled() ? "Extração automática de dados de documentos está em preparação — por enquanto, os documentos ficam organizados e vinculados aos lançamentos." : "A extração automática de dados de documentos depende da IA generativa (pendente de configuração). Os documentos ficam armazenados com segurança e vinculados aos lançamentos."}</Notice></div>
      <Card>
        {docs?.length ? docs.map((d) => (
          <div key={d.id} className="flex items-center gap-3 border-t border-line px-5 py-3.5 first:border-t-0">
            <span className="flex size-10 items-center justify-center rounded-xl bg-surface-3 text-muted"><FileText size={17} /></span>
            <a href={`/api/documentos/${d.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 hover:underline"><div className="truncate text-[14.5px]">{d.file_name}</div><div className="text-[12.5px] text-faint">{KIND[d.kind]} · {kb(d.size_bytes ?? 0)} · {fmtDateTime(d.created_at, false)}{d.transactions ? ` · ${d.transactions.description}` : ""}</div></a>
            {ctx.canWrite && <form action={deleteAttachment}><input type="hidden" name="ws" value={ws} /><input type="hidden" name="id" value={d.id} /><ConfirmSubmit message="Excluir este documento?" className="btn-ghost btn-sm">Excluir</ConfirmSubmit></form>}
          </div>
        )) : <Empty icon={<FileText size={18} />} title="Nenhum documento" />}
      </Card>
    </>
  );
}
