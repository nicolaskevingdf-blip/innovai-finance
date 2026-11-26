import Link from "next/link";
import { CreditCard, Plus } from "lucide-react";
import { getWorkspace } from "@/lib/data/workspace";
import { loadLedger } from "@/lib/data/ledger";
import { Badge, Card, Empty, Money, PageHeader, Progress, Stat, Tabs } from "@/components/ui";
import { Sheet } from "@/components/client";
import { buildInvoices, cardLimit, currentInvoiceMonth, type InvoiceStatus } from "@/lib/finance/cards";
import { fmtDate, fmtMonth } from "@/lib/finance/dates";
import { loadRefs } from "../refs";
import { CardForm, PayInvoiceForm } from "./forms";

export const metadata = { title: "Cartões" };
const ST: Record<InvoiceStatus, [string, "lime" | "neg" | "warn" | "info" | "neutral"]> = { open: ["Aberta", "info"], closed: ["Fechada", "warn"], paid: ["Paga", "lime"], partial: ["Parcialmente paga", "warn"], overdue: ["Vencida", "neg"], future: ["Futura", "neutral"] };

export default async function Page({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<{ id?: string; fatura?: string }> }) {
  const [{ ws }, sp] = await Promise.all([params, searchParams]);
  const ctx = await getWorkspace(ws);
  const [L, refs] = await Promise.all([loadLedger(ws), loadRefs(ctx)]);
  const add = ctx.canWrite && <Sheet title="Novo cartão" trigger={<button className="btn-primary btn-sm"><Plus size={16} /> Novo cartão</button>}><CardForm ws={ws} /></Sheet>;
  if (!L.cards.length) return (<><PageHeader title="Cartões de crédito" actions={add} /><Card><Empty icon={<CreditCard size={18} />} title="Nenhum cartão cadastrado" text="Cadastre seus cartões para registrar compras parceladas e acompanhar faturas sem duplicar despesas." /></Card></>);
  const card = L.cards.find((c) => c.id === sp.id) ?? L.cards[0];
  const lim = cardLimit(card, L.txs);
  const invoices = buildInvoices(card, L.txs, L.today);
  const cur = currentInvoiceMonth(card, L.today);
  const selected = invoices.find((i) => i.month === sp.fatura) ?? invoices.find((i) => i.month === cur) ?? invoices.at(-1);
  const future = invoices.filter((i) => i.month > cur).reduce((s, i) => s + i.remaining, 0);
  return (
    <>
      <PageHeader title="Cartões de crédito" actions={<>{ctx.canWrite && <Sheet title="Editar cartão" trigger={<button className="btn-secondary btn-sm">Editar {card.name}</button>}><CardForm ws={ws} c={card} /></Sheet>}{add}</>} />
      {L.cards.length > 1 && <Tabs active={card.id} items={L.cards.map((c) => ({ key: c.id, label: c.name, href: `?id=${c.id}` }))} />}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center gap-2 text-muted"><CreditCard size={16} /> {card.name}{card.bank ? ` · ${card.bank}` : ""} · fecha dia {card.closingDay}, vence dia {card.dueDay}</div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Limite" value={lim.limit} />
            <Stat label="Comprometido" value={lim.used} help="Todas as compras e parcelas futuras ainda não pagas. É quanto do limite está ocupado." />
            <Stat label="Disponível" value={lim.available} tone={lim.available < 0 ? "neg" : "lime"} />
            <Stat label="Parcelas futuras" value={future} help="Soma das faturas seguintes à atual, já comprometidas por compras parceladas." />
          </div>
          <Progress className="mt-5" pct={lim.usagePct} tone={lim.usagePct >= 80 ? "warn" : "lime"} />
        </Card>
        <Card className="p-5">
          <div className="eyebrow">Fatura {selected ? fmtMonth(selected.month, true) : ""}</div>
          {selected ? (<>
            <div className="num mt-2 text-[28px] font-semibold"><Money c={selected.total} /></div>
            <div className="mt-1 flex items-center gap-2 text-[13px] text-muted"><Badge tone={ST[selected.status][1]}>{ST[selected.status][0]}</Badge> vence {fmtDate(selected.dueDate)}</div>
            {selected.paid > 0 && <div className="mt-2 text-[13px] text-muted">Pago: <Money c={selected.paid} /> · Restante: <Money c={selected.remaining} /></div>}
            {ctx.canWrite && selected.remaining > 0 && <div className="mt-4"><Sheet title={`Pagar fatura ${fmtMonth(selected.month, true)}`} trigger={<button className="btn-primary w-full">Pagar fatura</button>}><PayInvoiceForm ws={ws} cardId={card.id} month={selected.month} remaining={selected.remaining} accounts={refs.accounts} today={L.today} /></Sheet></div>}
          </>) : <p className="mt-2 text-muted">Sem faturas.</p>}
        </Card>
      </div>

      <div className="no-scrollbar -mx-4 my-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {invoices.map((i) => (
          <Link key={i.month} href={`?id=${card.id}&fatura=${i.month}`} data-active={i.month === selected?.month} className="chip h-auto shrink-0 flex-col items-start gap-0 rounded-xl py-2">
            <span className="text-[12px]">{fmtMonth(i.month)}</span><span className="num text-[13px] text-fg"><Money c={i.total} /></span>
          </Link>
        ))}
      </div>

      <Card>
        {selected?.items.length ? selected.items.sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
          <div key={t.id} className="flex items-center gap-3 border-t border-line px-5 py-3 first:border-t-0">
            <div className="min-w-0 flex-1"><div className="truncate text-[14.5px]">{t.description}</div><div className="text-[12.5px] text-faint">{fmtDate(t.date)}{t.installmentTotal ? ` · parcela ${t.installmentNumber}/${t.installmentTotal}` : ""}</div></div>
            <Money c={t.amount} className="text-[14.5px]" />
          </div>
        )) : <Empty title="Nenhuma compra nesta fatura" />}
      </Card>
    </>
  );
}
