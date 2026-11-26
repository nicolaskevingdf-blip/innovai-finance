import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatBRL } from "@/lib/finance/money";

export { clsx as cx };

export function Money({ c, signed, className, tone }: { c: number; signed?: boolean; className?: string; tone?: "auto" | "none" }) {
  const color = tone === "auto" ? (c > 0 ? "text-lime" : c < 0 ? "text-neg" : "") : "";
  return <span className={clsx("num whitespace-nowrap", color, className)}>{formatBRL(c, { signed })}</span>;
}

export function Card({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <As className={clsx("card animate-fade-up", className)}>{children}</As>;
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Explicação acessível de um indicador financeiro. */
export function Help({ children }: { children: ReactNode }) {
  return (
    <details className="group relative inline-block align-middle">
      <summary aria-label="O que é este indicador?" className="flex size-5 cursor-pointer sm:size-4 list-none items-center justify-center rounded-full border border-line-strong text-[10px] text-faint hover:text-fg [&::-webkit-details-marker]:hidden">?</summary>
      <div className="fixed inset-x-4 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 rounded-xl border border-line-strong bg-surface-2 p-4 text-[13.5px] font-normal normal-case leading-relaxed tracking-normal text-fg/85 shadow-2xl animate-fade-up sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:z-30 sm:mt-2 sm:w-64 sm:-translate-x-1/2 sm:p-3 sm:text-[12.5px]">{children}</div>
    </details>
  );
}

export function Stat({ label, value, help, sub, tone, size = "md", estimate }: { label: string; value: number; help?: ReactNode; sub?: ReactNode; tone?: "lime" | "neg" | "auto"; size?: "sm" | "md" | "lg" | "xl"; estimate?: boolean }) {
  const color = tone === "lime" ? "text-lime" : tone === "neg" ? "text-neg" : tone === "auto" ? (value < 0 ? "text-neg" : "") : "";
  const cls = { sm: "text-[clamp(14.5px,4.4vw,16px)] leading-6", md: "text-[19px] leading-7 sm:text-[20px]", lg: "text-[26px] leading-8 sm:text-[30px] sm:leading-9", xl: "text-[34px] leading-10 sm:text-[40px] sm:leading-[3rem]" }[size];
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted sm:text-[13px]">
        <span className="leading-tight">{label}</span>
        {estimate && <span className="rounded-md bg-surface-2 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-faint">estimativa</span>}
        {help && <Help>{help}</Help>}
      </div>
      <div className={clsx("num mt-1 truncate font-semibold tracking-tight", cls, color)}>{formatBRL(value)}</div>
      {sub && <div className="mt-0.5 text-[12px] text-faint">{sub}</div>}
    </div>
  );
}

/** Título de seção usado nos dashboards e listas. */
export function SectionTitle({ title, action, className }: { title: string; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {action}
    </div>
  );
}

/** Indicador compacto com ícone — 2 por linha no celular. */
export function MiniStat({ label, value, icon, tone, sub }: { label: string; value: number; icon?: ReactNode; tone?: "lime" | "neg" | "auto"; sub?: ReactNode }) {
  const color = tone === "lime" ? "text-lime" : tone === "neg" ? "text-neg" : tone === "auto" && value < 0 ? "text-neg" : "";
  return (
    <div className="card min-w-0 p-4">
      <div className="flex items-center gap-2 text-[12.5px] text-muted">{icon}<span className="truncate">{label}</span></div>
      <div className={clsx("num mt-1.5 truncate text-[clamp(15px,4.6vw,18px)] font-semibold sm:text-[20px]", color)}>{formatBRL(value)}</div>
      {sub && <div className="mt-0.5 truncate text-[11.5px] text-faint">{sub}</div>}
    </div>
  );
}

const BADGE = { lime: "bg-lime-soft text-lime", neg: "bg-neg-soft text-neg", warn: "bg-warn-soft text-warn", info: "bg-info-soft text-info", neutral: "bg-surface-3 text-muted" };
export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: keyof typeof BADGE; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium whitespace-nowrap", BADGE[tone], className)}>{children}</span>;
}

export function Progress({ pct, tone = "lime", className }: { pct: number | null; tone?: "lime" | "warn" | "neg" | "info"; className?: string }) {
  const p = Math.max(0, Math.min(100, pct ?? 0));
  const bg = { lime: "bg-lime", warn: "bg-warn", neg: "bg-neg", info: "bg-info" }[tone];
  return (
    <div className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)} role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className={clsx("h-full rounded-full transition-[width] duration-700", bg)} style={{ width: `${p}%` }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-[22px] font-bold leading-tight sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[13.5px] leading-relaxed text-muted sm:text-[14px]">{subtitle}</p>}
      </div>
      {actions && <div className="no-print no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0">{actions}</div>}
    </header>
  );
}

export function Empty({ title, text, action, icon }: { title: string; text?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-surface-3 text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      {text && <p className="mt-1 max-w-sm text-[14px] text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Tabs({ items, active }: { items: { href: string; label: string; key: string; count?: number }[]; active: string }) {
  return (
    <nav className="no-scrollbar -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {items.map((i) => (
        <Link key={i.key} href={i.href} data-active={i.key === active} className="chip shrink-0">
          {i.label}
          {i.count !== undefined && <span className="num text-[12px] opacity-70">{i.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function Field({ label, children, hint, error, className }: { label: string; children: ReactNode; hint?: ReactNode; error?: string; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-[12.5px] text-neg">{error}</span> : hint ? <span className="mt-1 block text-[12.5px] text-faint">{hint}</span> : null}
    </label>
  );
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("flex items-center gap-3 border-t border-line px-4 py-3.5 first:border-t-0 sm:px-5", className)}>{children}</div>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "lime" }) {
  const c = { info: "border-info/20 bg-info-soft text-info", warn: "border-warn/25 bg-warn-soft text-warn", lime: "border-lime/25 bg-lime-soft text-lime" }[tone];
  return <div className={clsx("rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed", c)}>{children}</div>;
}
