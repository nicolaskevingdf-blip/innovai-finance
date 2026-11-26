import Link from "next/link";
import { SignInForm } from "../forms";
export const metadata = { title: "Entrar" };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
      <p className="mb-7 mt-1 text-muted">Entre para acessar seus ambientes financeiros.</p>
      {sp.erro && <p className="mb-4 rounded-xl border border-neg/25 bg-neg-soft px-3.5 py-2.5 text-[13.5px] text-neg">O link expirou ou é inválido. Tente novamente.</p>}
      <SignInForm next={sp.next} />
      <p className="mt-6 text-center text-[14px] text-muted">Ainda não tem conta? <Link href="/cadastro" className="text-lime">Criar conta</Link></p>
    </>
  );
}
