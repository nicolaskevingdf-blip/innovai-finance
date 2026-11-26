import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/data/workspace";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { acceptInvite } from "@/app/actions/workspace";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getUser();
  if (!user) redirect(`/entrar?next=/convite/${token}`);
  const sb = await createClient();
  const { data } = await sb.rpc("invite_preview", { p_token: token });
  const inv = data?.[0];
  const valid = inv && !inv.expired && !inv.accepted && inv.email.toLowerCase() === (user.email ?? "").toLowerCase();
  const accept = async () => { "use server"; await acceptInvite(token); };
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Logo className="mb-10" />
      {valid ? (<>
        <h1 className="text-2xl font-semibold">Você foi convidado para “{inv.workspace_name}”</h1>
        <p className="mt-2 text-muted">Você terá acesso somente a este ambiente.</p>
        <form action={accept} className="mt-8"><button className="btn-primary h-12 px-8">Aceitar convite</button></form>
      </>) : (<>
        <h1 className="text-2xl font-semibold">Convite indisponível</h1>
        <p className="mt-2 max-w-sm text-muted">{!inv ? "Este convite não existe." : inv.accepted ? "Este convite já foi utilizado." : inv.expired ? "Este convite expirou. Peça um novo ao administrador." : `Este convite é para ${inv.email}. Entre com essa conta para aceitar.`}</p>
        <Link href="/inicio" className="btn-secondary mt-8">Ir para o início</Link>
      </>)}
    </main>
  );
}
