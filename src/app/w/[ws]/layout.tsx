import Link from "next/link";
import { Plus, LogOut } from "lucide-react";
import { getWorkspace } from "@/lib/data/workspace";
import { navFor } from "@/components/nav-config";
import { BottomNav, MobileMenu, Sidebar, WorkspaceSwitcher } from "@/components/nav";
import { Sheet } from "@/components/client";
import { TransactionForm } from "@/components/tx-form";
import { Logo } from "@/components/logo";
import { signOut } from "@/app/actions/auth";
import { loadRefs } from "./refs";

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const ctx = await getWorkspace(ws);
  const refs = await loadRefs(ctx);
  const { primary, secondary } = navFor(ctx.ws.kind, ctx.base);
  const items = ctx.all.map((w) => ({ id: w.id, name: w.name, kind: w.kind }));
  const quickAdd = (trigger: React.ReactNode) => ctx.canOperate ? <Sheet title="Novo lançamento" trigger={trigger}><TransactionForm refs={refs} /></Sheet> : null;

  return (
    <div className="flex min-h-dvh">
      <Sidebar base={ctx.base} primary={primary} secondary={secondary}
        switcher={<WorkspaceSwitcher items={items} current={ws} />}
        footer={
          <div className="space-y-2">
            {quickAdd(<button className="btn-primary w-full"><Plus size={18} /> Novo lançamento</button>)}
            <div className="flex items-center justify-between px-1">
              <Link href="/conta" className="truncate text-[12.5px] text-faint hover:text-fg">{ctx.email}</Link>
              <form action={signOut}><button className="btn-ghost btn-sm px-2" aria-label="Sair"><LogOut size={16} /></button></form>
            </div>
          </div>
        } />
      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur-xl lg:hidden">
          <Link href={ctx.base} className="flex min-w-0 items-center gap-2"><Logo product={false} className="text-[17px]" /><span className="truncate text-[13px] text-muted">· {ctx.ws.name}</span></Link>
          <MobileMenu secondary={secondary} switcherItems={items} current={ws} email={ctx.email} />
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:pb-16 lg:pt-9">{children}</main>
        {quickAdd(
          <button className="no-print fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 flex size-14 items-center justify-center rounded-2xl bg-lime text-lime-ink shadow-[0_8px_30px_rgb(198_244_50/0.25)] active:scale-95 lg:hidden" aria-label="Novo lançamento"><Plus size={26} /></button>
        )}
        <BottomNav base={ctx.base} primary={primary} />
      </div>
    </div>
  );
}
