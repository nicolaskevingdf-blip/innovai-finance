import Link from "next/link";
export const metadata = { title: "Política de privacidade" };
export default function Page() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 text-[15px] leading-relaxed text-muted">
      <Link href="/" className="text-[13px] text-faint">← Innovai Finance</Link>
      <h1 className="mt-6 text-2xl font-semibold text-fg">Política de privacidade</h1>
      <p className="mt-2 rounded-xl border border-warn/25 bg-warn-soft px-4 py-3 text-[13.5px] text-warn">Rascunho técnico — deve ser revisado por assessoria jurídica antes da comercialização.</p>
      <h2 className="mt-8 font-semibold text-fg">Quais dados tratamos</h2>
      <p>Dados de cadastro (nome e e-mail) e os dados financeiros que você registra: contas, movimentações, cartões, metas, documentos anexados e informações dos ambientes que você cria ou dos quais participa.</p>
      <h2 className="mt-6 font-semibold text-fg">Finalidade</h2>
      <p>Exclusivamente prestar o serviço de gestão financeira: calcular saldos, relatórios, projeções e insights. Não vendemos dados.</p>
      <h2 className="mt-6 font-semibold text-fg">Isolamento e segurança</h2>
      <p>Cada ambiente é isolado no banco de dados por regras de acesso (Row Level Security). Pessoas de um ambiente não acessam dados de outro sem convite. Conexões são criptografadas (HTTPS) e documentos ficam em armazenamento privado.</p>
      <h2 className="mt-6 font-semibold text-fg">Inteligência artificial</h2>
      <p>Quando a IA generativa está habilitada, apenas dados agregados do ambiente ativo são enviados ao provedor de IA para responder a sua pergunta. A IA não grava lançamentos sem sua confirmação.</p>
      <h2 className="mt-6 font-semibold text-fg">Seus direitos (LGPD)</h2>
      <p>Você pode exportar todos os seus dados e excluir sua conta a qualquer momento em <em>Minha conta</em>.</p>
    </main>
  );
}
