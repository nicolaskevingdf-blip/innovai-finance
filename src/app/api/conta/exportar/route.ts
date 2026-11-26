import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TABLES = ["financial_accounts", "categories", "contacts", "credit_cards", "transactions", "budgets", "income_plans", "goals", "goal_contributions", "debts", "debt_payments", "assets", "asset_values", "cash_closings", "attachments"];

/** Portabilidade (LGPD art. 18, V): exporta todos os dados acessíveis ao titular em JSON. */
export async function GET() {
  const sb = await createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { data: profile } = await sb.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
  const { data: members } = await sb.from("workspace_members").select("role, workspaces(*)").eq("user_id", u.user.id);
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), user: { id: u.user.id, email: u.user.email, created_at: u.user.created_at }, profile, workspaces: [] as unknown[] };
  for (const m of members ?? []) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const ws = (m as any).workspaces;
    const data: Record<string, unknown> = {};
    for (const t of TABLES) {
      const rows: unknown[] = [];
      for (let from = 0; ; from += 1000) {
        const { data: page } = await sb.from(t).select("*").eq("workspace_id", ws.id).range(from, from + 999);
        rows.push(...(page ?? []));
        if (!page || page.length < 1000) break;
      }
      data[t] = rows;
    }
    (out.workspaces as unknown[]).push({ role: m.role, workspace: ws, data });
  }
  return new NextResponse(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="innovai-meus-dados.json"`, "Cache-Control": "no-store" } });
}
