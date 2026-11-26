import Link from "next/link";
import { ResetForm } from "../forms";
export const metadata = { title: "Recuperar senha" };
export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Recuperar senha</h1>
      <p className="mb-7 mt-1 text-muted">Enviaremos um link seguro para redefinir sua senha.</p>
      <ResetForm />
      <p className="mt-6 text-center text-[14px]"><Link href="/entrar" className="text-muted hover:text-fg">Voltar para entrar</Link></p>
    </>
  );
}
