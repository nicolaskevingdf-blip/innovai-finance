/** Controle de recursos por plano. Durante o beta todos os recursos do plano ficam liberados. */
export type Feature =
  | "transactions" | "categories" | "dashboard" | "budget" | "goals_basic" | "goals_advanced" | "ai" | "reports_advanced"
  | "cards" | "imports" | "shared" | "payables" | "receivables" | "cashflow_basic" | "projections" | "cash_closing"
  | "contacts" | "documents" | "multi_unit" | "permissions_advanced" | "integrations";

export interface Subscription { plan_code: string; status: "beta" | "trialing" | "active" | "past_due" | "canceled"; features: string[] }

export function hasFeature(sub: Subscription | null, f: Feature): boolean {
  if (!sub) return false;
  if (sub.status === "canceled") return ["transactions", "categories", "dashboard"].includes(f);
  return sub.features.includes(f);
}

export const STATUS_LABEL: Record<Subscription["status"], string> = {
  beta: "Beta — acesso completo", trialing: "Período de teste", active: "Ativa", past_due: "Pagamento pendente", canceled: "Cancelada",
};
