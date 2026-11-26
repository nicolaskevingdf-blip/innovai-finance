import { Plus } from "lucide-react";
import { getWorkspace } from "@/lib/data/workspace";
import { loadLedger } from "@/lib/data/ledger";
import { Card, PageHeader, Tabs, Money } from "@/components/ui";
import { ConfirmSubmit, Sheet } from "@/components/client";
import { removeCategory } from "@/app/actions/finance";
import { GROUP_LABEL } from "@/lib/templates";
import { addMonths, monthEnd, monthStart } from "@/lib/finance/dates";
import { summarize } from "@/lib/finance/ledger";
import { CategoryForm } from "./form";

export const metadata = { title: "Categorias" };

export default async function Page({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<{ tipo?: string }> }) {
  const [{ ws }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getWorkspace(ws);
  const L = await loadLedger(ws);
  const kind = sp.tipo === "income" ? "income" : "expense";
  const cats = L.categories.filter((c) => c.kind === kind);
  const parents = cats.filter((c) => !c.parentId);
  const from = addMonths(monthStart(L.today), -2);
  const usage = summarize(L.txs, from, monthEnd(L.today), { includePending: true, kind }).byCategory;
  // Sugestões: descrições frequentes sem categoria
  const freq = new Map<string, number>();
  for (const t of L.txs) if (t.type === kind && !t.categoryId) { const k = t.description.replace(/\(\d+\/\d+\)/, "").trim().toLowerCase(); freq.set(k, (freq.get(k) ?? 0) + 1); }
  const uncategorized = [...freq.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const business = ctx.ws.kind === "business";
  const groups = [...new Set(parents.map((p) => p.grp))];
  return (
    <>
      <PageHeader title="Categorias" subtitle="Categorias e subcategorias deste ambiente. Categorias com histórico são arquivadas em vez de excluídas."
        actions={ctx.canWrite && <Sheet title={`Nova categoria de ${kind === "income" ? "receita" : "despesa"}`} trigger={<button className="btn-primary btn-sm"><Plus size={16} /> Nova</button>}><CategoryForm ws={ws} kind={kind} parents={parents} business={business} /></Sheet>} />
      <Tabs active={kind} items={[{ key: "expense", label: "Despesas", href: "?tipo=expense" }, { key: "income", label: "Receitas", href: "?tipo=income" }]} />
      {uncategorized.length > 0 && <div className="mb-4 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-[13.5px] text-info">Lançamentos recorrentes sem categoria: {uncategorized.map(([d, n]) => `“${d}” (${n}x)`).join(", ")}. Categorize-os para relatórios mais precisos.</div>}
      <div className="space-y-4">
        {groups.map((g) => (
          <Card key={g}>
            <div className="px-5 pt-4 eyebrow">{GROUP_LABEL[g]}</div>
            <div className="py-2">
              {parents.filter((p) => p.grp === g).map((p) => {
                const kids = cats.filter((c) => c.parentId === p.id);
                const used = [p.id, ...kids.map((k) => k.id)].reduce((t, id) => t + (usage.get(id) ?? 0), 0);
                return (
                  <div key={p.id} className="border-t border-line px-5 py-3 first:border-t-0">
                    <div className="flex items-center gap-3">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color ?? "var(--color-line-strong)" }} />
                      <span className="min-w-0 flex-1 truncate text-[14.5px]">{p.name}</span>
                      {used > 0 && <span className="hidden text-[12.5px] text-faint sm:inline">3 meses: <Money c={used} /></span>}
                      {ctx.canWrite && <Sheet title="Editar categoria" trigger={<button className="btn-ghost btn-sm shrink-0 px-2.5">Editar</button>}><CategoryForm ws={ws} kind={kind} parents={parents} business={business} c={p} /></Sheet>}
                      {ctx.canWrite && <form action={removeCategory}><input type="hidden" name="ws" value={ws} /><input type="hidden" name="id" value={p.id} /><ConfirmSubmit message="Remover esta categoria? Se houver lançamentos ou subcategorias, ela será arquivada e o histórico preservado." className="btn-ghost btn-sm shrink-0 px-2.5 text-faint">Remover</ConfirmSubmit></form>}
                    </div>
                    {kids.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5 pl-5">{kids.map((k) => (
                      <Sheet key={k.id} title="Editar subcategoria" trigger={<button className="chip h-7 text-[12.5px]">{k.name}</button>}>
                        <CategoryForm ws={ws} kind={kind} parents={parents} business={business} c={k} />
                        {ctx.canWrite && <form action={removeCategory} className="mt-3"><input type="hidden" name="ws" value={ws} /><input type="hidden" name="id" value={k.id} /><ConfirmSubmit message="Remover esta subcategoria?" className="btn-ghost btn-sm w-full">Remover subcategoria</ConfirmSubmit></form>}
                      </Sheet>
                    ))}</div>}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
