import type { CategoryGroup } from "./finance/types";

export type CatTpl = { name: string; kind: "income" | "expense"; grp: CategoryGroup; icon: string; children?: string[] };

export const PERSONAL_CATEGORIES: CatTpl[] = [
  { name: "Salário", kind: "income", grp: "revenue", icon: "briefcase" },
  { name: "Renda extra", kind: "income", grp: "revenue", icon: "sparkles" },
  { name: "Rendimentos", kind: "income", grp: "revenue", icon: "trending-up" },
  { name: "Outras receitas", kind: "income", grp: "other", icon: "plus" },
  { name: "Moradia", kind: "expense", grp: "fixed", icon: "home", children: ["Aluguel", "Condomínio", "Manutenção"] },
  { name: "Alimentação", kind: "expense", grp: "variable", icon: "utensils", children: ["Mercado", "Restaurantes", "Delivery"] },
  { name: "Transporte", kind: "expense", grp: "variable", icon: "bus", children: ["Aplicativos", "Transporte público", "Estacionamento"] },
  { name: "Veículos", kind: "expense", grp: "variable", icon: "car", children: ["Manutenção do veículo", "IPVA e licenciamento", "Seguro"] },
  { name: "Combustível", kind: "expense", grp: "variable", icon: "fuel" },
  { name: "Saúde", kind: "expense", grp: "variable", icon: "heart-pulse", children: ["Farmácia", "Consultas", "Plano de saúde"] },
  { name: "Lazer", kind: "expense", grp: "variable", icon: "party-popper" },
  { name: "Compras", kind: "expense", grp: "variable", icon: "shopping-bag" },
  { name: "Educação", kind: "expense", grp: "fixed", icon: "graduation-cap" },
  { name: "Assinaturas", kind: "expense", grp: "fixed", icon: "repeat" },
  { name: "Contas", kind: "expense", grp: "fixed", icon: "receipt", children: ["Energia", "Água", "Internet", "Telefone"] },
  { name: "Dívidas", kind: "expense", grp: "fixed", icon: "landmark" },
  { name: "Investimentos", kind: "expense", grp: "investment", icon: "piggy-bank" },
  { name: "Viagens", kind: "expense", grp: "variable", icon: "plane" },
  { name: "Família", kind: "expense", grp: "variable", icon: "users" },
  { name: "Outros", kind: "expense", grp: "other", icon: "circle" },
];

const BUSINESS_BASE: CatTpl[] = [
  { name: "Vendas", kind: "income", grp: "revenue", icon: "shopping-cart" },
  { name: "Serviços", kind: "income", grp: "revenue", icon: "wrench" },
  { name: "Outras receitas", kind: "income", grp: "other", icon: "plus" },
  // Custos operacionais
  { name: "Mercadorias", kind: "expense", grp: "cost", icon: "package" },
  { name: "Matéria-prima", kind: "expense", grp: "cost", icon: "boxes" },
  { name: "Insumos", kind: "expense", grp: "cost", icon: "flask-conical" },
  { name: "Embalagens", kind: "expense", grp: "cost", icon: "package-open" },
  // Fixas
  { name: "Aluguel", kind: "expense", grp: "fixed", icon: "building" },
  { name: "Salários", kind: "expense", grp: "fixed", icon: "users" },
  { name: "Internet e telefone", kind: "expense", grp: "fixed", icon: "wifi" },
  { name: "Contabilidade", kind: "expense", grp: "fixed", icon: "calculator" },
  { name: "Sistemas", kind: "expense", grp: "fixed", icon: "monitor" },
  { name: "Seguros", kind: "expense", grp: "fixed", icon: "shield" },
  { name: "Energia e água", kind: "expense", grp: "fixed", icon: "zap" },
  // Variáveis
  { name: "Taxas", kind: "expense", grp: "variable", icon: "percent" },
  { name: "Comissões", kind: "expense", grp: "variable", icon: "hand-coins" },
  { name: "Marketing", kind: "expense", grp: "variable", icon: "megaphone" },
  { name: "Fretes", kind: "expense", grp: "variable", icon: "truck" },
  { name: "Impostos", kind: "expense", grp: "variable", icon: "landmark" },
  // Investimentos
  { name: "Equipamentos", kind: "expense", grp: "investment", icon: "hard-drive" },
  { name: "Reformas", kind: "expense", grp: "investment", icon: "hammer" },
  { name: "Expansão", kind: "expense", grp: "investment", icon: "rocket" },
  // Retiradas
  { name: "Pró-labore", kind: "expense", grp: "withdrawal", icon: "user" },
  { name: "Retirada do proprietário", kind: "expense", grp: "withdrawal", icon: "arrow-up-right" },
  { name: "Distribuição de lucros", kind: "expense", grp: "withdrawal", icon: "coins" },
  { name: "Despesas pessoais pagas pela empresa", kind: "expense", grp: "personal", icon: "alert-triangle" },
  { name: "Outras despesas", kind: "expense", grp: "other", icon: "circle" },
];

const SEGMENT_EXTRA: Record<string, CatTpl[]> = {
  restaurant: [
    { name: "Ingredientes", kind: "expense", grp: "cost", icon: "carrot" },
    { name: "Bebidas", kind: "expense", grp: "cost", icon: "cup-soda" },
    { name: "Taxas de aplicativos de delivery", kind: "expense", grp: "variable", icon: "bike" },
    { name: "Delivery", kind: "income", grp: "revenue", icon: "bike" },
    { name: "Salão", kind: "income", grp: "revenue", icon: "utensils" },
  ],
  barbershop: [
    { name: "Cortes e serviços", kind: "income", grp: "revenue", icon: "scissors" },
    { name: "Venda de produtos", kind: "income", grp: "revenue", icon: "shopping-bag" },
    { name: "Produtos para uso", kind: "expense", grp: "cost", icon: "spray-can" },
    { name: "Comissões de profissionais", kind: "expense", grp: "variable", icon: "hand-coins" },
  ],
  store: [{ name: "Custo das mercadorias vendidas", kind: "expense", grp: "cost", icon: "package" }],
  services: [
    { name: "Deslocamentos", kind: "expense", grp: "variable", icon: "map-pin" },
    { name: "Custos de execução", kind: "expense", grp: "cost", icon: "wrench" },
    { name: "Projetos", kind: "income", grp: "revenue", icon: "folder-kanban" },
  ],
  mei: [{ name: "DAS (MEI)", kind: "expense", grp: "variable", icon: "landmark" }],
};

export function businessCategories(segment: string | null): CatTpl[] {
  const extra = SEGMENT_EXTRA[segment ?? ""] ?? [];
  const names = new Set(extra.map((e) => e.name));
  return [...BUSINESS_BASE.filter((b) => !names.has(b.name)), ...extra];
}

export const SEGMENTS = [
  { value: "restaurant", label: "Restaurante" },
  { value: "barbershop", label: "Barbearia" },
  { value: "store", label: "Loja" },
  { value: "services", label: "Prestador de serviços" },
  { value: "mei", label: "MEI" },
  { value: "retail", label: "Pequeno comércio" },
  { value: "general", label: "Empresa em geral" },
  { value: "custom", label: "Outro segmento" },
] as const;

export const PERSONAL_GOALS = [
  "Organizar minhas finanças", "Sair das dívidas", "Economizar", "Criar uma reserva de emergência", "Planejar uma viagem",
  "Comprar um veículo", "Controlar minhas despesas", "Organizar as finanças do casal", "Investir e construir patrimônio",
];
export const BUSINESS_GOALS = [
  "Entender meu lucro", "Controlar o fluxo de caixa", "Separar finanças pessoais e da empresa", "Organizar contas a pagar e receber",
  "Reduzir custos", "Planejar crescimento", "Controlar o caixa diário",
];

export const ACCOUNT_TYPES = [
  { value: "checking", label: "Conta corrente" },
  { value: "savings", label: "Poupança" },
  { value: "digital", label: "Conta digital" },
  { value: "wallet", label: "Carteira" },
  { value: "cash", label: "Dinheiro em espécie / caixa" },
  { value: "investment", label: "Investimentos" },
  { value: "other", label: "Outra" },
] as const;

export const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "cash", label: "Dinheiro" },
  { value: "debit", label: "Cartão de débito" },
  { value: "credit", label: "Cartão de crédito" },
  { value: "boleto", label: "Boleto" },
  { value: "transfer", label: "Transferência" },
  { value: "app", label: "Aplicativos" },
  { value: "other", label: "Outros" },
] as const;

export const GROUP_LABEL: Record<CategoryGroup, string> = {
  revenue: "Receitas", cost: "Custos operacionais", fixed: "Despesas fixas", variable: "Despesas variáveis",
  investment: "Investimentos", withdrawal: "Retiradas", personal: "Pessoal pago pela empresa", other: "Outros",
};

export const ROLES = [["admin", "Administrador", "Tudo, exceto excluir o ambiente"], ["manager", "Gerente", "Lança, edita e vê relatórios"], ["finance", "Financeiro", "Lança, edita e vê relatórios"], ["employee", "Funcionário", "Registra vendas/despesas e fecha o caixa"], ["viewer", "Visualizador", "Somente leitura"]] as const;
