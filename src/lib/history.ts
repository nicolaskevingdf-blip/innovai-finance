import { fmtDate } from "./finance/dates";
import { formatBRL, toCents } from "./finance/money";
import { PAYMENT_METHODS } from "./templates";

/**
 * Tradução do registro de auditoria (gravado pelo banco, somente acréscimo) para texto legível.
 * Funções puras: usadas na aba "Histórico" do lançamento e na página de histórico.
 */
export interface AuditRow {
  id: number;
  action: "insert" | "update" | "delete";
  entity: string;
  entity_id: string | null;
  user_id: string | null;
  actor: string | null;
  at: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changed: string[] | null;
}

export interface HistoryChange { field: string; label: string; from: string; to: string }
export interface HistoryEntry { id: number; at: string; who: string; title: string; entity: string; changes: HistoryChange[] }

export const ENTITY_LABEL: Record<string, string> = {
  transactions: "lançamento", financial_accounts: "conta", credit_cards: "cartão", cash_closings: "fechamento de caixa", attachments: "documento",
};

const FIELD_LABEL: Record<string, string> = {
  amount: "Valor", description: "Descrição", type: "Tipo", status: "Situação", date: "Data", competence_date: "Competência",
  due_date: "Vencimento", paid_at: "Pago em", category_id: "Categoria", account_id: "Conta", to_account_id: "Conta de destino",
  card_id: "Cartão", invoice_month: "Fatura", contact_id: "Contato", payment_method: "Forma de pagamento", notes: "Observações",
  tags: "Tags", installment_number: "Parcela", installment_total: "Total de parcelas", parent_id: "Lançamento de origem",
  name: "Nome", opening_balance: "Saldo inicial", limit_amount: "Limite", closing_day: "Dia de fechamento", due_day: "Dia de vencimento",
  archived: "Arquivado", expected_cash: "Caixa esperado", counted_cash: "Caixa contado", file_name: "Arquivo",
};
/** Ordem de leitura natural (a ordem do objeto é a do banco). */
const ORDER = Object.keys(FIELD_LABEL);
/** Campos técnicos que não interessam ao usuário. */
const HIDDEN = new Set(["id", "parent_id", "created_by", "installment_group", "recurrence_id", "source", "storage_path", "transaction_id", "size_bytes", "mime_type"]);
const MONEY = new Set(["amount", "opening_balance", "limit_amount", "expected_cash", "counted_cash", "difference"]);
const DATES = new Set(["date", "competence_date", "due_date", "paid_at"]);
const TYPE: Record<string, string> = { income: "Receita", expense: "Despesa", transfer: "Transferência", adjustment: "Ajuste de saldo", card_payment: "Pagamento de fatura", refund: "Estorno" };
const STATUS: Record<string, string> = { pending: "Pendente", paid: "Efetivado", canceled: "Cancelado" };

function fmt(field: string, v: unknown, names: Map<string, string>): string {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return "—";
  if (MONEY.has(field)) return formatBRL(toCents(v as number | string));
  if (DATES.has(field)) return fmtDate(String(v));
  if (field === "invoice_month") { const s = String(v); return `${s.slice(5, 7)}/${s.slice(0, 4)}`; }
  if (field === "type") return TYPE[String(v)] ?? String(v);
  if (field === "status") return STATUS[String(v)] ?? String(v);
  if (field === "payment_method") return PAYMENT_METHODS.find((p) => p.value === v)?.label ?? String(v);
  if (field.endsWith("_id")) return names.get(String(v)) ?? "(removido)";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

/** IDs de contas, cartões, categorias e contatos citados — para buscar os nomes de uma vez. */
export function referencedIds(rows: AuditRow[]): string[] {
  const ids = new Set<string>();
  for (const r of rows) for (const d of [r.before, r.after]) if (d) for (const [k, v] of Object.entries(d)) if (k.endsWith("_id") && k !== "parent_id" && typeof v === "string") ids.add(v);
  return [...ids];
}

export function toEntry(r: AuditRow, names: Map<string, string>, me: string): HistoryEntry {
  const data = r.after ?? r.before ?? {};
  const isRefund = data.type === "refund";
  const what = ENTITY_LABEL[r.entity] ?? r.entity;
  const title = r.action === "insert" ? (isRefund ? "Registrou estorno" : `Criou ${what}`) : r.action === "delete" ? `Excluiu ${what}` : `Alterou ${what}`;
  const fields = (r.action === "update" ? r.changed ?? [] : Object.keys(data)).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const changes = fields
    .filter((f) => !HIDDEN.has(f) && FIELD_LABEL[f])
    .map((f) => ({
      field: f, label: FIELD_LABEL[f],
      from: r.action === "insert" ? "" : fmt(f, r.before?.[f], names),
      to: r.action === "delete" ? "" : fmt(f, r.after?.[f], names),
    }))
    .filter((c) => r.action === "update" || (r.action === "insert" ? c.to !== "—" : c.from !== "—"));
  const who = r.user_id === me ? "Você" : r.actor ?? (r.user_id ? "Membro" : "Sistema");
  return { id: r.id, at: r.at, who, title, entity: r.entity, changes };
}
