import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { getUser, listWorkspaces } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { Logo } from "@/components/logo";
import { signOut } from "@/app/actions/auth";
import { DeleteAccountForm, ProfileForm } from "./forms";

export const metadata = { title: "Minha conta" };

export default async function Page() {
  const user = await getUser();
  if (!user) redirect("/entrar");
  const sb = await createClient();
  const [{ data: profile }, all] = await Promise.all([sb.from("profiles").select("full_name").eq("id", user.id).maybeSingle(), listWorkspaces()]);
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-8 flex items-center justify-between"><Link href="/inicio" className="btn-ghost btn-sm -ml-3"><ArrowLeft size={16} /> Voltar</Link><Logo size="sm" /></div>
      <PageHeader title="Minha conta" subtitle={user.email} />
      <div className="space-y-4">
        <Card className="p-5"><div className="eyebrow mb-3">Perfil</div><ProfileForm name={profile?.full_name ?? ""} /></Card>
        <Card className="p-5">
          <div className="eyebrow mb-3">Ambientes</div>
          {all.map((w) => <Link key={w.id} href={`/w/${w.id}`} className="flex justify-between border-t border-line py-2.5 text-[14px] first:border-t-0"><span>{w.name}</span><span className="text-faint">{w.kind === "business" ? "Empresa" : "Pessoal"} · {w.role === "owner" ? "proprietário" : "membro"}</span></Link>)}
          <Link href="/onboarding" className="btn-secondary btn-sm mt-3">Adicionar ambiente</Link>
        </Card>
        <Card className="p-5">
          <div className="eyebrow mb-3">Privacidade e dados (LGPD)</div>
          <p className="text-[13.5px] text-muted">Baixe uma cópia completa dos seus dados em formato aberto (JSON).</p>
          <a href="/api/conta/exportar" className="btn-secondary btn-sm mt-3"><Download size={15} /> Exportar meus dados</a>
          <p className="mt-3 text-[12.5px] text-faint">Veja a <Link href="/privacidade" className="underline">política de privacidade</Link>.</p>
        </Card>
        <Card className="border-neg/25 p-5"><div className="eyebrow mb-3 text-neg">Excluir conta</div><DeleteAccountForm /></Card>
        <form action={signOut}><button className="btn-ghost">Sair da conta</button></form>
      </div>
    </main>
  );
}
