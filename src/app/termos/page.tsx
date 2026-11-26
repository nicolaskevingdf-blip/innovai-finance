import Link from "next/link";
export const metadata = { title: "Termos de uso" };
export default function Page() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 text-[15px] leading-relaxed text-muted">
      <Link href="/" className="text-[13px] text-faint">← Innovai Finance</Link>
      <h1 className="mt-6 text-2xl font-semibold text-fg">Termos de uso</h1>
      <p className="mt-2 rounded-xl border border-warn/25 bg-warn-soft px-4 py-3 text-[13.5px] text-warn">Rascunho técnico — deve ser revisado por assessoria jurídica antes da comercialização.</p>
      <p className="mt-6">A Innovai Finance é uma ferramenta de organização financeira. Indicadores como “resultado estimado”, “saldo previsto” e projeções são calculados a partir dos dados registrados por você e não substituem contabilidade, assessoria fiscal ou recomendação de investimentos.</p>
      <p className="mt-4">Durante o período beta, todos os recursos estão liberados sem cobrança. Planos e preços serão comunicados com antecedência.</p>
    </main>
  );
}
