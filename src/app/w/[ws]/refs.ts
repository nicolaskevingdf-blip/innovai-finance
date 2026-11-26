import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/finance/dates";
import type { FormRefs } from "@/components/tx-form";
import type { WorkspaceCtx } from "@/lib/data/workspace";

/** Listas leves usadas pelos formulários (contas, cartões, categorias, contatos). */
export const loadRefs = cache(async (ctx: WorkspaceCtx): Promise<FormRefs> => {
  const sb = await createClient();
  const id = ctx.ws.id;
  const [a, c, k, ct] = await Promise.all([
    sb.from("financial_accounts").select("id,name").eq("workspace_id", id).eq("archived", false).order("created_at"),
    sb.from("credit_cards").select("id,name").eq("workspace_id", id).eq("archived", false).order("created_at"),
    sb.from("categories").select("id,name,kind,parent_id").eq("workspace_id", id).eq("archived", false).order("name"),
    ctx.ws.kind === "business" ? sb.from("contacts").select("id,name,kind").eq("workspace_id", id).eq("archived", false).order("name") : Promise.resolve({ data: [] as { id: string; name: string; kind: "client" | "supplier" }[] }),
  ]);
  return {
    ws: id, kind: ctx.ws.kind, today: todayISO(), canWrite: ctx.canOperate, canAudit: ctx.canAdmin,
    accounts: a.data ?? [], cards: c.data ?? [],
    categories: (k.data ?? []).map((x) => ({ id: x.id, name: x.name, kind: x.kind, parentId: x.parent_id })),
    contacts: (ct.data ?? []) as FormRefs["contacts"],
  };
});
