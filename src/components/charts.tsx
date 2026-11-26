"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/finance/money";

const axis = { stroke: "#63636b", fontSize: 11, tickLine: false, axisLine: false } as const;
const compact = (c: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(c / 100);

function Tip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line-strong bg-surface-3 px-3 py-2 text-[12.5px] shadow-xl">
      <div className="mb-1 text-muted">{label}</div>
      {payload.map((p) => <div key={p.name} className="num flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}: {formatBRL(p.value)}</div>)}
    </div>
  );
}

export function MonthlyBars({ data, incomeLabel = "Receitas", expenseLabel = "Despesas" }: { data: { label: string; income: number; expense: number }[]; incomeLabel?: string; expenseLabel?: string }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <BarChart data={data} barGap={3} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#1c1c1f" />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} tickFormatter={compact} width={58} />
          <Tooltip content={<Tip />} cursor={{ fill: "rgb(255 255 255 / 0.03)" }} />
          <Bar dataKey="income" name={incomeLabel} fill="#c6f432" radius={[5, 5, 0, 0]} maxBarSize={22} />
          <Bar dataKey="expense" name={expenseLabel} fill="#5b5b63" radius={[5, 5, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BalanceArea({ data, min, height = 220 }: { data: { label: string; balance: number }[]; min?: number | null; height?: number }) {
  const neg = data.some((d) => d.balance < 0);
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c6f432" stopOpacity={0.28} /><stop offset="100%" stopColor="#c6f432" stopOpacity={0} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="#1c1c1f" />
          <XAxis dataKey="label" {...axis} minTickGap={24} />
          <YAxis {...axis} tickFormatter={compact} width={58} />
          <Tooltip content={<Tip />} />
          {min != null && <ReferenceLine y={min} stroke="#f5b83d" strokeDasharray="4 4" label={{ value: "Caixa mínimo", fill: "#f5b83d", fontSize: 11, position: "insideTopLeft" }} />}
          {neg && <ReferenceLine y={0} stroke="#ff6b5e" strokeOpacity={0.5} />}
          <Area type="monotone" dataKey="balance" name="Saldo projetado" stroke="#c6f432" strokeWidth={2} fill="url(#g)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
