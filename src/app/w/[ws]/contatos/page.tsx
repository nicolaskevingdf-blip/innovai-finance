import Link from "next/link";
import { Plus } from "lucide-react";
import { getWorkspace } from "@/lib/data/workspace";
import { loadLedger } from "@/lib/data/ledger";
import { createClient } from "@/lib/supabase/server";
import { Card, Empty, Money, PageHeader, Tabs } from "@/components/ui";
import { Sheet } from "@/components/client";
import { ContactForm } from "./form";

export const metadata = { title: "Clientes e fornecedores" };

export default async function Page({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<{ tipo?: string; q?: string }> }) {
  const [{ ws }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getWorkspace(ws);
  const L = await loadLedger(ws);
  const kind = sp.tipo === "supplier" ? "supplier" : "client";
  const sb = await createClient();
  let q = sb.from("contacts").select("*").eq("workspace_id", ws).eq("kind", kind).eq("archived", false).order("name");
  if (sp.q?.trim()) q = q.ilike("name", `%${sp.q.trim().replace(/[%_,()]/g, " ").slice(0, 60)}%`);
  const { data: contacts } = await q;
  const t = kind === "client" ? "income" : "expense";
  const stats = new Map<string, { total: number; open: number; overdue: number; last: string | null }>();
  for (const x of L.txs) {
    if (x.type !== t || !x.contactId || x.status === "canceled") continue;
    const s = stats.get(x.contactId) ?? { total: 0, open: 0, overdue: 0, last: null };
    if (x.status === "paid") { s.total += x.amount; s.last = !s.last || x.date > s.last ? x.date : s.last; }
    if (x.status === "pending") { s.open += x.amount; if ((x.dueDate ?? x.date) < L.today) s.overdue += x.amount; }
    stats.set(x.contactId, s);
  }
  return (
    <>
      <PageHeader title="Clientes e fornecedores" subtitle="Cadastro simples com histórico financeiro e pendências."
        actions={ctx.canWrite && <Sheet title={kind === "client" ? "Novo cliente" : "Novo fornecedor"} trigger={<button className="btn-primary btn-sm"><Plus size={16} /> {kind === "client" ? "Novo cliente" : "Novo fornecedor"}</button>}><ContactForm ws={ws} kind={kind} /></Sheet>} />
      <Tabs active={kind} items={[{ key: "client", label: "Clientes", href: "?tipo=client" }, { key: "supplier", label: "Fornecedores", href: "?tipo=supplier" }]} />
      <form className="mb-4 flex gap-2"><input type="hidden" name="tipo" value={kind} /><input name="q" defaultValue={sp.q} placeholder="Buscar por nome" className="input" /><button className="btn-secondary">Buscar</button></form>
      <Card>
        {contacts?.length ? contacts.map((c) => {
          const s = stats.get(c.id);
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4 first:border-t-0">
              <div className="min-w-0 flex-1"><div className="text-[15px]">{c.name}</div><div className="text-[12.5px] text-faint">{[c.phone, c.email].filter(Boolean).join(" · ") || "Sem contato"}</div></div>
              <div className="grid grid-cols-3 gap-4 text-right text-[12.5px]">
                <div><div className="text-faint">{kind === "client" ? "Recebido" : "Pago"}</div><Money c={s?.total ?? 0} /></div>
                <div><div className="text-faint">Em aberto</div><Money c={s?.open ?? 0} /></div>
                <div><div className="text-faint">Vencido</div><Money c={s?.overdue ?? 0} className={s?.overdue ? "text-neg" : ""} /></div>
              </div>
              <div className="flex gap-1">
                <Link href={`${ctx.base}/financeiro?contato=${c.id}`} className="btn-ghost btn-sm">Histórico</Link>
                {ctx.canWrite && <Sheet title="Editar" trigger={<button className="btn-ghost btn-sm">Editar</button>}><ContactForm ws={ws} kind={kind} c={c} /></Sheet>}
              </div>
            </div>
          );
        }) : <Empty title={kind === "client" ? "Nenhum cliente" : "Nenhum fornecedor"} text="Vincule contatos aos lançamentos para acompanhar recebimentos e pagamentos." />}
      </Card>
    </>
  );
}
