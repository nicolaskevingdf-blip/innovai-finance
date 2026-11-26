import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Brain, Building2, LineChart, ShieldCheck, Wallet } from "lucide-react";
import { Logo } from "@/components/logo";
import { getUser } from "@/lib/data/workspace";

export default async function Landing() {
  if (await getUser()) redirect("/inicio");
  const pillars = [
    { icon: Wallet, title: "Finanças pessoais", text: "Contas, cartões com parcelas, orçamento, metas, dívidas e patrimônio — com saldo disponível realista." },
    { icon: Building2, title: "Finanças da empresa", text: "Contas a pagar e receber, fluxo de caixa projetado, fechamento de caixa e separação PF/PJ." },
    { icon: Brain, title: "Inteligência Innovai", text: "Lançamentos por texto ou voz, perguntas em linguagem natural e alertas calculados com seus dados reais." },
  ];
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-5 sm:px-8">
      <header className="flex h-20 items-center justify-between">
        <Logo size="sm" />
        <nav className="flex items-center gap-2">
          <Link href="/entrar" className="btn-ghost btn-sm">Entrar</Link>
          <Link href="/cadastro" className="btn-primary btn-sm">Criar conta</Link>
        </nav>
      </header>
      <section className="flex flex-1 flex-col justify-center py-16 sm:py-24">
        <div className="eyebrow mb-4 !text-lime">Gestão financeira inteligente</div>
        <h1 className="max-w-3xl text-[36px] font-extrabold leading-[1.05] sm:text-[64px]">Seus números, com <span className="text-lime">clareza</span> para decidir.</h1>
        <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted">A Innovai transforma seus lançamentos em entendimento: o que entrou, o que já está comprometido e o que realmente está disponível — para você e para o seu negócio, em ambientes separados.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/cadastro" className="btn-primary h-12 px-6">Começar agora <ArrowRight size={18} /></Link>
          <Link href="/entrar" className="btn-secondary h-12 px-6">Já tenho conta</Link>
        </div>
        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {pillars.map((p) => (
            <div key={p.title} className="card p-6">
              <p.icon className="text-lime" size={22} />
              <h3 className="mt-4 font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{p.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-faint">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} /> Dados isolados por ambiente</span>
          <span className="inline-flex items-center gap-1.5"><LineChart size={15} /> Cálculos determinísticos e auditáveis</span>
          <span>LGPD: exporte ou exclua seus dados quando quiser</span>
        </div>
      </section>
      <footer className="flex flex-wrap gap-4 border-t border-line py-6 text-[13px] text-faint">
        <span>© {new Date().getFullYear()} Innovai · Tecnologia que facilita o seu negócio.</span>
        <Link href="/privacidade" className="hover:text-fg">Privacidade</Link>
        <Link href="/termos" className="hover:text-fg">Termos</Link>
      </footer>
    </main>
  );
}
