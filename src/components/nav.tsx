"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ArrowDownLeft, ArrowUpRight, BarChart3, Building2, Check, ChevronDown, CreditCard, FileText, Flag, Gem, Home, Landmark, List, LogOut, Menu, Plus, Settings, Sparkles, Tags, Target, TrendingUp, User, UserCog, Users, Vault, Wallet } from "lucide-react";
import { useState } from "react";
import type { NavItem } from "./nav-config";
import { Sheet } from "./client";
import { InnovaiMark, Logo } from "./logo";
import { signOut } from "@/app/actions/auth";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>> = {
  home: Home, list: List, target: Target, flag: Flag, sparkles: Sparkles, vault: Vault, chart: BarChart3, wallet: Wallet, card: CreditCard,
  landmark: Landmark, tags: Tags, gem: Gem, settings: Settings, trend: TrendingUp, "arrow-up": ArrowUpRight, "arrow-down": ArrowDownLeft, users: Users, file: FileText, "user-cog": UserCog,
};

type WsItem = { id: string; name: string; kind: string };

function useActive(base: string) {
  const path = usePathname();
  const sp = useSearchParams();
  return (href: string) => {
    const [p, q] = href.split("?");
    if (p === base) return path === base;
    if (q) return path === p && sp.toString() === q;
    return path === p || path.startsWith(p + "/");
  };
}

const kindLabel = (k: string) => (k === "business" ? "Empresa" : "Pessoal");

export function Sidebar({ base, primary, secondary, switcher, footer }: { base: string; primary: NavItem[]; secondary: NavItem[]; switcher: React.ReactNode; footer: React.ReactNode }) {
  const active = useActive(base);
  const Item = ({ i }: { i: NavItem }) => {
    const Icon = ICONS[i.icon] ?? List;
    const on = active(i.href);
    return (
      <Link href={i.href} aria-current={on ? "page" : undefined} className={clsx("relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] transition", on ? "bg-surface-2 font-medium text-fg" : "text-muted hover:bg-surface hover:text-fg")}>
        {on && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-lime" />}
        <Icon size={18} className={on ? "text-lime" : ""} /> {i.label}
      </Link>
    );
  };
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-bg px-3 py-5 lg:flex">
      <Link href={base} className="mb-6 px-2"><Logo size="sm" /></Link>
      {switcher}
      <nav className="mt-5 space-y-0.5">{primary.map((i) => <Item key={i.href} i={i} />)}</nav>
      <div className="eyebrow mb-2 mt-7 px-3">Recursos</div>
      <nav className="space-y-0.5 overflow-y-auto">{secondary.map((i) => <Item key={i.href} i={i} />)}</nav>
      <div className="mt-auto pt-4">{footer}</div>
    </aside>
  );
}

/** Barra inferior fixa (celular/tablet). Respeita a área segura do iPhone. */
export function BottomNav({ base, primary }: { base: string; primary: NavItem[] }) {
  const active = useActive(base);
  return (
    <nav aria-label="Navegação principal" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {primary.map((i) => {
          const Icon = ICONS[i.icon] ?? List;
          const on = active(i.href);
          return (
            <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined} className="flex h-[62px] flex-col items-center justify-center gap-1 active:opacity-70">
              <span className={clsx("flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200", on ? "bg-lime-soft" : "")}>
                <Icon size={20} strokeWidth={on ? 2.25 : 1.75} className={on ? "text-lime" : "text-faint"} />
              </span>
              <span className={clsx("max-w-full truncate px-0.5 text-[10.5px] leading-none", on ? "font-semibold text-fg" : "text-faint")}>{i.short ?? i.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Cabeçalho compacto do celular: marca + ambiente ativo (alternável) + menu. */
export function MobileHeader({ base, secondary, items, current, email }: { base: string; secondary: NavItem[]; items: WsItem[]; current: string; email: string }) {
  const cur = items.find((i) => i.id === current);
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
      <div className="flex h-14 items-center gap-2 px-4">
        <Link href={base} aria-label="Início" className="shrink-0"><InnovaiMark className="h-7 w-7" /></Link>
        <Sheet title="Seus ambientes" trigger={
          <button className="flex min-w-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-left active:bg-surface-2" aria-label="Trocar de ambiente">
            {cur?.kind === "business" ? <Building2 size={14} className="shrink-0 text-lime" /> : <User size={14} className="shrink-0 text-lime" />}
            <span className="truncate text-[13.5px] font-medium">{cur?.name}</span>
            <ChevronDown size={14} className="shrink-0 text-faint" />
          </button>
        }>
          <WorkspaceList items={items} current={current} />
          <div className="h-3" />
        </Sheet>
        <div className="flex-1" />
        <Sheet title="Menu" trigger={<button className="btn-ghost size-10 rounded-full p-0" aria-label="Abrir menu"><Menu size={21} /></button>}>
          <MenuBody secondary={secondary} email={email} />
        </Sheet>
      </div>
    </header>
  );
}

function MenuBody({ secondary, email }: { secondary: NavItem[]; email: string }) {
  return (
    <div className="pb-3">
      <div className="grid grid-cols-2 gap-2">
        {secondary.map((i) => {
          const Icon = ICONS[i.icon] ?? List;
          return <Link key={i.href} href={i.href} className="card flex min-h-14 items-center gap-2.5 px-3.5 py-3 text-[14px] leading-tight active:bg-surface-2"><Icon size={18} className="shrink-0 text-lime" /> <span className="min-w-0">{i.label}</span></Link>;
        })}
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
        <Link href="/conta" className="min-w-0 truncate text-[13px] text-muted">{email}</Link>
        <form action={signOut}><button className="btn-ghost btn-sm"><LogOut size={16} /> Sair</button></form>
      </div>
    </div>
  );
}

function WorkspaceList({ items, current }: { items: WsItem[]; current: string }) {
  return (
    <div className="space-y-1">
      {items.map((w) => (
        <Link key={w.id} href={`/w/${w.id}`} className={clsx("flex h-14 items-center gap-3 rounded-xl px-3 text-[14.5px] transition", w.id === current ? "bg-surface-2" : "hover:bg-surface-2")}>
          <span className={clsx("flex size-9 items-center justify-center rounded-xl", w.id === current ? "bg-lime-soft text-lime" : "bg-surface-2 text-muted")}>{w.kind === "business" ? <Building2 size={17} /> : <User size={17} />}</span>
          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{w.name}</span><span className="text-[12px] text-faint">{kindLabel(w.kind)}</span></span>
          {w.id === current && <Check size={18} className="text-lime" />}
        </Link>
      ))}
      <Link href="/onboarding" className="flex h-14 items-center gap-3 rounded-xl px-3 text-[14.5px] text-muted hover:bg-surface-2 hover:text-fg"><span className="flex size-9 items-center justify-center rounded-xl border border-dashed border-line-strong"><Plus size={17} /></span> Adicionar ambiente</Link>
    </div>
  );
}

export function WorkspaceSwitcher({ items, current }: { items: WsItem[]; current: string }) {
  const [open, setOpen] = useState(false);
  const cur = items.find((i) => i.id === current);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left hover:border-line-strong">
        <span className="flex size-8 items-center justify-center rounded-lg bg-lime-soft text-lime">{cur?.kind === "business" ? <Building2 size={16} /> : <User size={16} />}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium">{cur?.name}</span><span className="text-[11.5px] text-faint">{kindLabel(cur?.kind ?? "")}</span></span>
        <ChevronDown size={16} className={clsx("text-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="absolute inset-x-0 top-full z-50 mt-2 animate-fade-up rounded-2xl border border-line-strong bg-surface p-1.5 shadow-2xl" onClick={() => setOpen(false)}><WorkspaceList items={items} current={current} /></div>}
    </div>
  );
}
