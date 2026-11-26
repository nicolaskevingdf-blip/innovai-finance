"use client";
import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/finance/money";
import { BRAND } from "@/lib/brand";

/** true em telas estreitas (< 640px). Inicia em false para coincidir com o HTML do servidor. */
function useCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setCompact(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return compact;
}

const axis = { stroke: BRAND.faint, fontSize: 11, tickLine: false, axisLine: false } as const;
const compactNumber = (c: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(c / 100);

function Tip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-[12.5px] shadow-xl">
      <div className="mb-1 text-muted">{label}</div>
      {payload.map((p) => <div key={p.name} className="num flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}: {formatBRL(p.value)}</div>)}
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.dashed ? <span className="w-3 border-t-2 border-dashed" style={{ borderColor: i.color }} /> : <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function MonthlyBars({ data, incomeLabel = "Receitas", expenseLabel = "Despesas" }: { data: { label: string; income: number; expense: number }[]; incomeLabel?: string; expenseLabel?: string }) {
  const compact = useCompact();
  return (
    <div>
      <Legend items={[{ label: incomeLabel, color: BRAND.lime }, { label: expenseLabel, color: BRAND.neutralBar }]} />
      <div className="mt-3 h-48 w-full sm:h-56">
        <ResponsiveContainer>
          <BarChart data={data} barGap={compact ? 2 : 3} margin={{ top: 4, right: 0, left: compact ? 0 : -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={BRAND.grid} />
            <XAxis dataKey="label" {...axis} interval={0} tick={{ fontSize: compact ? 10 : 11, fill: BRAND.faint }} />
            <YAxis {...axis} hide={compact} tickFormatter={compactNumber} width={56} />
            <Tooltip content={<Tip />} cursor={{ fill: "rgb(255 255 255 / 0.03)" }} />
            <Bar dataKey="income" name={incomeLabel} fill={BRAND.lime} radius={[4, 4, 0, 0]} maxBarSize={compact ? 14 : 22} />
            <Bar dataKey="expense" name={expenseLabel} fill={BRAND.neutralBar} radius={[4, 4, 0, 0]} maxBarSize={compact ? 14 : 22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function BalanceArea({ data, min, height = 220, label = "Saldo projetado" }: { data: { label: string; balance: number }[]; min?: number | null; height?: number; label?: string }) {
  const compact = useCompact();
  const neg = data.some((d) => d.balance < 0);
  return (
    <div>
      <Legend items={[{ label, color: BRAND.lime }, ...(min != null ? [{ label: "Caixa mínimo", color: BRAND.warn, dashed: true }] : [])]} />
      <div className="mt-3 w-full" style={{ height: compact ? Math.min(height, 190) : height }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: compact ? 0 : -8, bottom: 0 }}>
            <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BRAND.lime} stopOpacity={0.26} /><stop offset="100%" stopColor={BRAND.lime} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke={BRAND.grid} />
            <XAxis dataKey="label" {...axis} minTickGap={compact ? 36 : 24} tick={{ fontSize: compact ? 10 : 11, fill: BRAND.faint }} />
            <YAxis {...axis} hide={compact} tickFormatter={compactNumber} width={56} />
            <Tooltip content={<Tip />} />
            {min != null && <ReferenceLine y={min} stroke={BRAND.warn} strokeDasharray="4 4" />}
            {neg && <ReferenceLine y={0} stroke={BRAND.neg} strokeOpacity={0.5} />}
            <Area type="monotone" dataKey="balance" name={label} stroke={BRAND.lime} strokeWidth={2} fill="url(#g)" animationDuration={600} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
