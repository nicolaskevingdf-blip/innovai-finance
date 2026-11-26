import Link from "next/link";
import { Plus, LogOut } from "lucide-react";
import { getWorkspace } from "@/lib/data/workspace";
import { navFor } from "@/components/nav-config";
import { BottomNav, MobileHeader, Sidebar, WorkspaceSwitcher } from "@/components/nav";
import { Sheet } from "@/components/client";
import { TransactionForm } from "@/components/tx-form";
import { signOut } from "@/app/actions/auth";
import { loadRefs } from "./refs";
import { FabGate } from "@/components/fab-gate";

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
        <MobileHeader base={ctx.base} secondary={secondary} items={items} current={ws} email={ctx.email} />
        {/* pb: espaço para a barra inferior + botão flutuante + área segura do iPhone */}
        <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-10 lg:pb-16 lg:pt-9">{children}</main>
        <FabGate>{quickAdd(
          <button className="no-print fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex size-14 items-center justify-center rounded-full bg-lime text-lime-ink shadow-[0_8px_30px_rgb(166_255_0/0.22)] active:scale-95 lg:hidden" aria-label="Novo lançamento"><Plus size={26} /></button>
        )}</FabGate>
        <BottomNav base={ctx.base} primary={primary} />
      </div>
    </div>
  );
}
