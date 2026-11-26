export type NavItem = { href: string; label: string; icon: string };

export function navFor(kind: string, base: string) {
  const personal = kind !== "business";
  const primary: NavItem[] = personal
    ? [
        { href: base, label: "Início", icon: "home" },
        { href: `${base}/movimentacoes`, label: "Movimentações", icon: "list" },
        { href: `${base}/planejamento`, label: "Planejamento", icon: "target" },
        { href: `${base}/metas`, label: "Metas", icon: "flag" },
        { href: `${base}/inteligencia`, label: "Inteligência", icon: "sparkles" },
      ]
    : [
        { href: base, label: "Início", icon: "home" },
        { href: `${base}/financeiro`, label: "Financeiro", icon: "list" },
        { href: `${base}/caixa`, label: "Caixa", icon: "vault" },
        { href: `${base}/relatorios`, label: "Relatórios", icon: "chart" },
        { href: `${base}/inteligencia`, label: "Inteligência", icon: "sparkles" },
      ];
  const secondary: NavItem[] = personal
    ? [
        { href: `${base}/contas`, label: "Contas", icon: "wallet" },
        { href: `${base}/cartoes`, label: "Cartões", icon: "card" },
        { href: `${base}/dividas`, label: "Dívidas", icon: "landmark" },
        { href: `${base}/categorias`, label: "Categorias", icon: "tags" },
        { href: `${base}/patrimonio`, label: "Patrimônio", icon: "gem" },
        { href: `${base}/relatorios`, label: "Relatórios", icon: "chart" },
        { href: `${base}/usuarios`, label: "Compartilhar", icon: "users" },
        { href: `${base}/configuracoes`, label: "Configurações", icon: "settings" },
      ]
    : [
        { href: `${base}/fluxo`, label: "Fluxo de caixa", icon: "trend" },
        { href: `${base}/financeiro?aba=pagar`, label: "Contas a pagar", icon: "arrow-up" },
        { href: `${base}/financeiro?aba=receber`, label: "Contas a receber", icon: "arrow-down" },
        { href: `${base}/contatos`, label: "Clientes e fornecedores", icon: "users" },
        { href: `${base}/contas`, label: "Contas bancárias", icon: "wallet" },
        { href: `${base}/categorias`, label: "Categorias", icon: "tags" },
        { href: `${base}/documentos`, label: "Documentos", icon: "file" },
        { href: `${base}/metas`, label: "Metas", icon: "flag" },
        { href: `${base}/usuarios`, label: "Usuários", icon: "user-cog" },
        { href: `${base}/configuracoes`, label: "Configurações", icon: "settings" },
      ];
  return { primary, secondary };
}
