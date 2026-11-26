import "server-only";
import { createClient } from "../supabase/server";
import { referencedIds, toEntry, type AuditRow, type HistoryEntry } from "../history";

const COLS = "id, action, entity, entity_id, user_id, actor, at, before, after, changed";

/** Resolve nomes de contas, cartões, categorias e contatos citados no histórico (dentro do ambiente). */
async function namesFor(wsId: string, rows: AuditRow[]) {
  const ids = referencedIds(rows);
  const names = new Map<string, string>();
  if (!ids.length) return names;
  const sb = await createClient();
  const res = await Promise.all(["financial_accounts", "credit_cards", "categories", "contacts"].map((t) =>
    sb.from(t).select("id,name").eq("workspace_id", wsId).in("id", ids)));
  for (const r of res) for (const x of (r.data ?? []) as { id: string; name: string }[]) names.set(x.id, x.name);
  return names;
}

/** Histórico de um registro. A leitura é limitada pelo banco (RLS) a administradores do ambiente. */
export async function entityHistory(wsId: string, entityId: string, me: string): Promise<HistoryEntry[]> {
  const sb = await createClient();
  const { data } = await sb.from("audit_log").select(COLS).eq("workspace_id", wsId).eq("entity_id", entityId).order("at", { ascending: false }).limit(100);
  const rows = (data ?? []) as AuditRow[];
  const names = await namesFor(wsId, rows);
  return rows.map((r) => toEntry(r, names, me));
}

export const HISTORY_PAGE = 30;

/** Página do histórico do ambiente, mais recentes primeiro. */
export async function workspaceHistory(wsId: string, me: string, opts: { page: number; entity?: string; action?: string }) {
  const sb = await createClient();
  let q = sb.from("audit_log").select(COLS).eq("workspace_id", wsId);
  if (opts.entity) q = q.eq("entity", opts.entity);
  if (opts.action) q = q.eq("action", opts.action);
  const from = opts.page * HISTORY_PAGE;
  const { data } = await q.order("at", { ascending: false }).order("id", { ascending: false }).range(from, from + HISTORY_PAGE); // 1 a mais para saber se há próxima página
  const rows = (data ?? []) as AuditRow[];
  const page = rows.slice(0, HISTORY_PAGE);
  const names = await namesFor(wsId, page);
  return { entries: page.map((r) => toEntry(r, names, me)), hasMore: rows.length > HISTORY_PAGE };
}
