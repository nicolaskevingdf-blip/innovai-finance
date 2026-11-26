import { redirect } from "next/navigation";
import { getUser, listWorkspaces } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { Wizard } from "./wizard";
import { Logo } from "@/components/logo";

export const metadata = { title: "Configuração" };

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/entrar");
  const sb = await createClient();
  const [{ data: profile }, all, sp] = await Promise.all([sb.from("profiles").select("full_name").eq("id", user.id).maybeSingle(), listWorkspaces(), searchParams]);
  const kind = sp.tipo === "empresa" ? "business" : sp.tipo === "pessoal" ? "personal" : null;
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8">
      <div className="mb-10 flex items-center justify-between"><Logo className="text-lg" />{all.length > 0 && <a href="/inicio" className="text-[13px] text-muted">Cancelar</a>}</div>
      <Wizard initialKind={kind} fullName={profile?.full_name ?? ""} first={all.length === 0} hasPersonal={all.some((w) => w.kind === "personal")} />
    </main>
  );
}
