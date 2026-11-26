import Link from "next/link";
import { getWorkspace } from "@/lib/data/workspace";
import { workspaceHistory } from "@/lib/data/history";
import { HistoryList } from "@/components/history-list";
import { Empty, Notice, PageHeader, Tabs } from "@/components/ui";

export const metadata = { title: "Histórico de alterações" };

const ENTITIES = [
  { key: "", label: "Tudo" },
  { key: "transactions", label: "Lançamentos" },
  { key: "financial_accounts", label: "Contas" },
  { key: "credit_cards", label: "Cartões" },
  { key: "cash_closings", label: "Caixa" },
  { key: "attachments", label: "Documentos" },
];
const ACTIONS = [{ key: "", label: "Todas" }, { key: "insert", label: "Criações" }, { key: "update", label: "Edições" }, { key: "delete", label: "Exclusões" }];

export default async function Page({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<{ tipo?: string; acao?: string; p?: string }> }) {
  const { ws } = await params;
  const sp = await searchParams;
  const ctx = await getWorkspace(ws);
  const base = `${ctx.base}/historico`;
  if (!ctx.canAdmin) {
    return <div><PageHeader title="Histórico de alterações" /><Notice tone="warn">Somente proprietários e administradores do ambiente podem ver o histórico.</Notice></div>;
  }
  const entity = ENTITIES.some((e) => e.key === sp.tipo) ? sp.tipo! : "";
  const action = ACTIONS.some((a) => a.key === sp.acao) ? sp.acao! : "";
  const page = Math.max(0, Math.min(1000, Number(sp.p) || 0));
  const { entries, hasMore } = await workspaceHistory(ws, ctx.userId, { page, entity: entity || undefined, action: action || undefined });
  const href = (o: { tipo?: string; acao?: string; p?: number }) => {
    const q = new URLSearchParams();
    const t = o.tipo ?? entity, a = o.acao ?? action, pg = o.p ?? 0;
    if (t) q.set("tipo", t); if (a) q.set("acao", a); if (pg) q.set("p", String(pg));
    const s = q.toString(); return s ? `${base}?${s}` : base;
  };
  return (
    <div className="space-y-5">
      <PageHeader title="Histórico de alterações" subtitle="Quem criou, editou ou excluiu cada registro, com valores anteriores e novos. Gerado automaticamente pelo banco e imutável." />
      <Tabs active={entity} items={ENTITIES.map((e) => ({ key: e.key, label: e.label, href: href({ tipo: e.key, p: 0 }) }))} />
      <div className="flex flex-wrap gap-1.5">{ACTIONS.map((a) => <Link key={a.key} href={href({ acao: a.key, p: 0 })} data-active={action === a.key} className="chip">{a.label}</Link>)}</div>
      {entries.length ? <HistoryList entries={entries} /> : <Empty title="Nada registrado com esses filtros" />}
      {(page > 0 || hasMore) && (
        <nav className="flex items-center justify-between gap-3">
          {page > 0 ? <Link href={href({ p: page - 1 })} className="btn-secondary btn-sm">Mais recentes</Link> : <span />}
          <span className="text-[12.5px] text-faint">Página {page + 1}</span>
          {hasMore ? <Link href={href({ p: page + 1 })} className="btn-secondary btn-sm">Mais antigos</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
