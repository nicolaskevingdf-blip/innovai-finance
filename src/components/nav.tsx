"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ArrowDownLeft, ArrowUpRight, BarChart3, Building2, Check, ChevronDown, CreditCard, FileText, Flag, Gem, Home, Landmark, List, LogOut, Menu, Plus, Settings, Sparkles, Tags, Target, TrendingUp, User, UserCog, Users, Vault, Wallet } from "lucide-react";
import { useState } from "react";
import type { NavItem } from "./nav-config";
import { Sheet } from "./client";
import { signOut } from "@/app/actions/auth";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  home: Home, list: List, target: Target, flag: Flag, sparkles: Sparkles, vault: Vault, chart: BarChart3, wallet: Wallet, card: CreditCard,
  landmark: Landmark, tags: Tags, gem: Gem, settings: Settings, trend: TrendingUp, "arrow-up": ArrowUpRight, "arrow-down": ArrowDownLeft, users: Users, file: FileText, "user-cog": UserCog,
};

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

export function Sidebar({ base, primary, secondary, switcher, footer }: { base: string; primary: NavItem[]; secondary: NavItem[]; switcher: React.ReactNode; footer: React.ReactNode }) {
  const active = useActive(base);
  const Item = ({ i }: { i: NavItem }) => {
    const Icon = ICONS[i.icon] ?? List;
    const on = active(i.href);
    return (
      <Link href={i.href} className={clsx("flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] transition", on ? "bg-surface-3 font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}>
        <Icon size={18} className={on ? "text-lime" : ""} /> {i.label}
      </Link>
    );
  };
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/40 px-3 py-5 lg:flex">
      {switcher}
      <nav className="mt-6 space-y-0.5">{primary.map((i) => <Item key={i.href} i={i} />)}</nav>
      <div className="eyebrow mt-7 mb-2 px-3">Recursos</div>
      <nav className="space-y-0.5 overflow-y-auto">{secondary.map((i) => <Item key={i.href} i={i} />)}</nav>
      <div className="mt-auto pt-4">{footer}</div>
    </aside>
  );
}

export function BottomNav({ base, primary }: { base: string; primary: NavItem[] }) {
  const active = useActive(base);
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {primary.map((i) => {
          const Icon = ICONS[i.icon] ?? List;
          const on = active(i.href);
          return (
            <Link key={i.href} href={i.href} className={clsx("flex h-16 flex-col items-center justify-center gap-1 text-[10.5px]", on ? "text-fg" : "text-faint")}>
              <Icon size={21} className={on ? "text-lime" : ""} />
              <span className="max-w-full truncate px-1">{i.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileMenu({ secondary, switcherItems, current, email }: { secondary: NavItem[]; switcherItems: { id: string; name: string; kind: string }[]; current: string; email: string }) {
  return (
    <Sheet title="Menu" trigger={<button className="btn-ghost btn-sm -mr-2 lg:hidden" aria-label="Abrir menu"><Menu size={20} /></button>}>
      <MenuBody secondary={secondary} switcherItems={switcherItems} current={current} email={email} />
    </Sheet>
  );
}

function MenuBody({ secondary, switcherItems, current, email }: { secondary: NavItem[]; switcherItems: { id: string; name: string; kind: string }[]; current: string; email: string }) {
  return (
    <div className="pb-2">
      <div className="eyebrow mb-2">Ambientes</div>
      <WorkspaceList items={switcherItems} current={current} />
      <div className="eyebrow mt-6 mb-2">Recursos</div>
      <div className="grid grid-cols-2 gap-2">
        {secondary.map((i) => { const Icon = ICONS[i.icon] ?? List; return <Link key={i.href} href={i.href} className="card flex h-14 items-center gap-2.5 px-3.5 text-[14px]"><Icon size={18} className="text-muted" /> {i.label}</Link>; })}
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <Link href="/conta" className="text-[13px] text-muted">{email}</Link>
        <form action={signOut}><button className="btn-ghost btn-sm"><LogOut size={16} /> Sair</button></form>
      </div>
    </div>
  );
}

function WorkspaceList({ items, current }: { items: { id: string; name: string; kind: string }[]; current: string }) {
  return (
    <div className="space-y-1">
      {items.map((w) => (
        <Link key={w.id} href={`/w/${w.id}`} className={clsx("flex h-11 items-center gap-3 rounded-xl px-3 text-[14px]", w.id === current ? "bg-surface-3" : "hover:bg-surface-2")}>
          {w.kind === "business" ? <Building2 size={17} className="text-muted" /> : <User size={17} className="text-muted" />}
          <span className="flex-1 truncate">{w.name}</span>
          {w.id === current && <Check size={16} className="text-lime" />}
        </Link>
      ))}
      <Link href="/onboarding" className="flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] text-muted hover:bg-surface-2 hover:text-fg"><Plus size={17} /> Adicionar ambiente</Link>
    </div>
  );
}

export function WorkspaceSwitcher({ items, current }: { items: { id: string; name: string; kind: string }[]; current: string }) {
  const [open, setOpen] = useState(false);
  const cur = items.find((i) => i.id === current);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-left hover:border-line-strong">
        <span className="flex size-8 items-center justify-center rounded-lg bg-lime-soft text-lime">{cur?.kind === "business" ? <Building2 size={16} /> : <User size={16} />}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium">{cur?.name}</span><span className="text-[11.5px] text-faint">{cur?.kind === "business" ? "Empresa" : "Pessoal"}</span></span>
        <ChevronDown size={16} className="text-faint" />
      </button>
      {open && <div className="absolute inset-x-0 top-full z-50 mt-2 rounded-2xl border border-line-strong bg-surface-2 p-1.5 shadow-2xl" onClick={() => setOpen(false)}><WorkspaceList items={items} current={current} /></div>}
    </div>
  );
}
