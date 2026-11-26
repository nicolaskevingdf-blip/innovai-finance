import { Landmark, Plus } from "lucide-react";
import { getWorkspace } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, Empty, Money, Notice, PageHeader, Progress, Stat } from "@/components/ui";
import { Sheet } from "@/components/client";
import { toCents, formatBRL } from "@/lib/finance/money";
import { addMonths, fmtDate, fmtMonth, todayISO, cap } from "@/lib/finance/dates";
import { monthsToPayoff, payoffOrder } from "@/lib/finance/planning";
import { loadRefs } from "../refs";
import { DebtForm, DebtPaymentForm, type DebtView } from "./forms";

export const metadata = { title: "Dívidas" };
const STATUS: Record<string, [string, "lime" | "warn" | "neutral" | "neg"]> = { active: ["Ativa", "warn"], renegotiating: ["Renegociando", "neg"], paid: ["Quitada", "lime"], canceled: ["Cancelada", "neutral"] };

export default async function Page({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const ctx = await getWorkspace(ws);
  const refs = await loadRefs(ctx);
  const sb = await createClient();
  const today = todayISO();
  const [{ data: debts }, { data: pays }] = await Promise.all([
    sb.from("debts").select("*").eq("workspace_id", ws).order("created_at"),
    sb.from("debt_payments").select("*").eq("workspace_id", ws).order("date", { ascending: false }),
  ]);
  const list = (debts ?? []).map((d) => {
    const ps = (pays ?? []).filter((p) => p.debt_id === d.id);
    const paid = ps.reduce((t, p) => t + toCents(p.amount), 0);
    const v: DebtView = { id: d.id, creditor: d.creditor, description: d.description, total: toCents(d.total_amount), rate: d.monthly_interest_rate === null ? null : Number(d.monthly_interest_rate), installmentsTotal: d.installments_total, installment: d.installment_amount === null ? null : toCents(d.installment_amount), dueDay: d.due_day, startDate: d.start_date, status: d.status };
    const remaining = Math.max(0, v.total - paid);
    const months = v.installment ? monthsToPayoff(remaining, v.installment, v.rate) : null;
    return { v, paid, remaining, payments: ps, months };
  });
  const open = list.filter((d) => d.v.status === "active" || d.v.status === "renegotiating");
  const totalRemaining = open.reduce((t, d) => t + d.remaining, 0);
  const monthly = open.reduce((t, d) => t + (d.v.installment ?? 0), 0);
  const withRate = open.filter((d) => d.v.rate !== null);
  const order = payoffOrder(open.map((d) => ({ id: d.v.id, creditor: d.v.creditor, total: d.v.total, paid: d.paid, monthlyRate: d.v.rate, installment: d.v.installment })), withRate.length === open.length && open.length > 1 ? "avalanche" : "snowball");
  return (
    <>
      <PageHeader title="Dívidas" subtitle="Empréstimos, financiamentos, acordos e parcelamentos fora do cartão."
        actions={ctx.canWrite && <Sheet title="Nova dívida" trigger={<button className="btn-primary btn-sm"><Plus size={16} /> Nova dívida</button>}><DebtForm ws={ws} today={today} /></Sheet>} />
      <Card className="mb-4 grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
        <Stat label="Total em aberto" value={totalRemaining} help="Valor total informado menos pagamentos registrados. Não inclui juros futuros." />
        <Stat label="Comprometimento mensal" value={monthly} help="Soma das parcelas informadas das dívidas ativas." />
        <div><div className="text-[13px] text-muted">Dívidas ativas</div><div className="num mt-1 text-[20px] font-semibold">{open.length}</div></div>
      </Card>
      {open.length > 1 && (
        <Card className="mb-4">
          <CardHeader title="Sugestão de ordem de quitação" subtitle={withRate.length === open.length ? "Estratégia avalanche: priorize a maior taxa de juros (menor custo total)." : "Estratégia bola de neve: priorize o menor saldo (vitórias rápidas). Informe as taxas de juros para usar a estratégia de menor custo."} />
          <ol className="px-5 pb-5 pt-3 text-[14px]">{order.map((d, i) => <li key={d.id} className="flex justify-between border-t border-line py-2 first:border-t-0"><span>{i + 1}. {d.creditor}{d.monthlyRate !== null ? <span className="text-faint"> · {d.monthlyRate.toLocaleString("pt-BR")}% a.m.</span> : ""}</span><Money c={d.total - d.paid} /></li>)}</ol>
          <div className="px-5 pb-5"><Notice>Premissas: pagar o mínimo em todas e direcionar qualquer valor extra para a primeira da lista. Juros compostos são considerados apenas quando a taxa foi informada.</Notice></div>
        </Card>
      )}
      {list.length === 0 ? <Card><Empty icon={<Landmark size={18} />} title="Nenhuma dívida registrada" text="Registrar dívidas ajuda a enxergar o comprometimento mensal e planejar a quitação." /></Card> : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map(({ v, paid, remaining, payments, months }) => (
            <Card key={v.id} className="p-5">
              <div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold">{v.creditor}</h3>{v.description && <p className="text-[13px] text-faint">{v.description}</p>}</div><Badge tone={STATUS[v.status][1]}>{STATUS[v.status][0]}</Badge></div>
              <div className="mt-4 flex items-end justify-between"><Money c={remaining} className="text-[22px] font-semibold" /><span className="text-[13px] text-muted">de {formatBRL(v.total)}</span></div>
              <Progress className="mt-2" pct={(paid / v.total) * 100} />
              <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                <div><div className="text-faint">Parcela</div>{v.installment ? <Money c={v.installment} /> : "—"}{v.dueDay ? <span className="text-faint"> · dia {v.dueDay}</span> : ""}</div>
                <div><div className="text-faint">Juros</div>{v.rate !== null ? `${v.rate.toLocaleString("pt-BR")}% a.m.` : <span className="text-muted">não informado</span>}</div>
                <div className="col-span-2"><div className="text-faint">Previsão de quitação</div>{remaining === 0 ? "Quitada" : months === null ? <span className="text-muted">{v.installment ? "A parcela não cobre os juros informados" : "Informe o valor da parcela"}</span> : <span>{cap(fmtMonth(addMonths(today, months), true))} ({months} {months === 1 ? "mês" : "meses"}{v.rate ? ", com juros informados" : ""})</span>}</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {ctx.canWrite && remaining > 0 && <Sheet title={`Pagamento — ${v.creditor}`} trigger={<button className="btn-primary btn-sm">Registrar pagamento</button>}><DebtPaymentForm ws={ws} debtId={v.id} installment={v.installment} accounts={refs.accounts} today={today} /></Sheet>}
                {ctx.canWrite && <Sheet title="Editar dívida" trigger={<button className="btn-secondary btn-sm">Editar</button>}><DebtForm ws={ws} d={v} today={today} /></Sheet>}
              </div>
              {payments.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-[13px] text-muted">Histórico ({payments.length})</summary>{payments.map((p) => <div key={p.id} className="flex justify-between py-1 text-[13px]"><span className="text-faint">{fmtDate(p.date)}</span><Money c={toCents(p.amount)} /></div>)}</details>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
