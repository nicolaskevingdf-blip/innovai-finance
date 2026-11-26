import Link from "next/link";
import { SignUpForm } from "../forms";
export const metadata = { title: "Criar conta" };
export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Crie sua conta Innovai</h1>
      <p className="mb-7 mt-1 text-muted">Uma conta para suas finanças pessoais e seus negócios.</p>
      <SignUpForm />
      <p className="mt-6 text-center text-[14px] text-muted">Já tem conta? <Link href="/entrar" className="text-lime">Entrar</Link></p>
    </>
  );
}
