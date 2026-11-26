"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { PERSONAL_CATEGORIES, businessCategories, type CatTpl } from "@/lib/templates";
import { parseMoneyInput } from "@/lib/finance/money";
import { check, db, fail, formObject, type ActionState } from "./_util";

async function seedCategories(sb: Awaited<ReturnType<typeof createClient>>, ws: string, tpl: CatTpl[]) {
  const parents = check(await sb.from("categories").insert(tpl.map((c) => ({ workspace_id: ws, name: c.name, kind: c.kind, grp: c.grp, icon: c.icon }))).select("id, name, kind"));
  const children = tpl.flatMap((c) => (c.children ?? []).map((name) => ({ workspace_id: ws, name, kind: c.kind, grp: c.grp, icon: c.icon, parent_id: parents.find((p) => p.name === c.name && p.kind === c.kind)!.id })));
  if (children.length) check(await sb.from("categories").insert(children));
}

const Onboarding = z.object({
  kind: z.enum(["personal", "business"]),
  name: z.string().trim().min(1, "Informe um nome").max(80),
  trade_name: z.string().trim().max(80).optional(),
  segment: z.string().max(30).optional(),
  full_name: z.string().trim().max(80).optional(),
  objectives: z.string().max(1000).optional(),
  income: z.string().optional(),
  income_type: z.string().max(30).optional(),
  team_size: z.string().max(10).optional(),
  receive_methods: z.string().max(200).optional(),
  account_name: z.string().trim().max(60).optional(),
  account_type: z.enum(["checking", "savings", "wallet", "cash", "digital", "investment", "other"]).optional(),
  account_balance: z.string().optional(),
  card_name: z.string().trim().max(60).optional(),
  card_limit: z.string().optional(),
  card_closing: z.string().optional(),
  card_due: z.string().optional(),
  min_cash: z.string().optional(),
});

export async function createWorkspace(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = Onboarding.parse(formObject(fd));
    const sb = await createClient();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) redirect("/entrar");
    const settings: Record<string, unknown> = {
      objectives: f.objectives ? f.objectives.split("|").filter(Boolean).slice(0, 10) : [],
      budget_thresholds: [50, 75, 90],
    };
    const income = f.income ? parseMoneyInput(f.income) : null;
    if (income) settings.approx_income = income;
    if (f.income_type) settings.income_type = f.income_type;
    if (f.team_size) settings.team_size = f.team_size;
    if (f.receive_methods) settings.receive_methods = f.receive_methods.split("|").filter(Boolean);
    const minCash = f.min_cash ? parseMoneyInput(f.min_cash) : null;
    if (minCash !== null) settings.min_cash = minCash;

    const { data: wsId, error } = await sb.rpc("create_workspace", { p_kind: f.kind, p_name: f.name, p_trade_name: f.trade_name || null, p_segment: f.kind === "business" ? f.segment || "general" : null, p_settings: settings });
    if (error) throw new Error(error.message);
    const ws = wsId as string;
    try {
    await seedCategories(sb, ws, f.kind === "personal" ? PERSONAL_CATEGORIES : businessCategories(f.segment ?? null));

    const accounts: Record<string, unknown>[] = [];
    if (f.account_name) accounts.push({ workspace_id: ws, name: f.account_name, type: f.account_type ?? "checking", opening_balance: db(parseMoneyInput(f.account_balance ?? "0") ?? 0) });
    if (f.kind === "business") accounts.push({ workspace_id: ws, name: "Caixa da loja", type: "cash", opening_balance: 0 });
    else accounts.push({ workspace_id: ws, name: "Carteira", type: "wallet", opening_balance: 0 });
    check(await sb.from("financial_accounts").insert(accounts));

    if (f.card_name && f.card_limit) {
      const lim = parseMoneyInput(f.card_limit);
      const cl = Number(f.card_closing), du = Number(f.card_due);
      if (lim && cl >= 1 && cl <= 28 && du >= 1 && du <= 28) check(await sb.from("credit_cards").insert({ workspace_id: ws, name: f.card_name, limit_amount: db(lim), closing_day: cl, due_day: du }));
    }
    } catch (seedErr) {
      // mantém o onboarding atômico: remove o ambiente parcialmente criado
      await sb.from("workspaces").delete().eq("id", ws);
      throw seedErr;
    }
    if (f.full_name) await sb.from("profiles").update({ full_name: f.full_name, onboarded_at: new Date().toISOString() }).eq("id", u.user.id);
    else await sb.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", u.user.id);
    revalidatePath("/", "layout");
    return { ok: true, data: { id: ws } };
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect
    return fail(e);
  }
}

const Settings = z.object({
  ws: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  trade_name: z.string().trim().max(80).optional(),
  t1: z.coerce.number().int().min(1).max(99), t2: z.coerce.number().int().min(1).max(99), t3: z.coerce.number().int().min(1).max(100),
  min_cash: z.string().optional(),
  withdrawal_limit: z.string().optional(),
  reserve_target: z.string().optional(),
  insight_frequency: z.enum(["all", "important", "off"]).optional(),
  weekly_summary: z.string().optional(),
});

export async function updateSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = Settings.parse(formObject(fd));
    const th = [f.t1, f.t2, f.t3].sort((a, b) => a - b);
    if (new Set(th).size !== 3) return { error: "Use três percentuais diferentes para os alertas." };
    const sb = await createClient();
    const { data: cur } = await sb.from("workspaces").select("settings").eq("id", f.ws).single();
    const settings = { ...(cur?.settings ?? {}), budget_thresholds: th } as Record<string, unknown>;
    const setMoney = (k: string, v?: string) => { const c = v ? parseMoneyInput(v) : null; if (c === null) delete settings[k]; else settings[k] = c; };
    setMoney("min_cash", f.min_cash);
    setMoney("withdrawal_limit", f.withdrawal_limit);
    setMoney("reserve_target", f.reserve_target);
    settings.insight_frequency = f.insight_frequency ?? "all";
    settings.weekly_summary = f.weekly_summary === "on";
    check(await sb.from("workspaces").update({ name: f.name, trade_name: f.trade_name || null, settings }).eq("id", f.ws).select("id").single());
    revalidatePath(`/w/${f.ws}`, "layout");
    return { ok: true, message: "Configurações salvas." };
  } catch (e) { return fail(e); }
}

export async function inviteMember(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ ws: z.string().uuid(), email: z.string().email("E-mail inválido"), role: z.enum(["admin", "manager", "finance", "employee", "viewer"]) }).parse(formObject(fd));
    const sb = await createClient();
    const { data: u } = await sb.auth.getUser();
    const inv = check(await sb.from("workspace_invites").insert({ workspace_id: f.ws, email: f.email.toLowerCase(), role: f.role, invited_by: u.user!.id }).select("token").single());
    revalidatePath(`/w/${f.ws}/usuarios`);
    // Envio de e-mail transacional depende de provedor externo (pendente): o link é exibido para compartilhar.
    return { ok: true, message: "Convite criado. Compartilhe o link com a pessoa convidada.", data: { token: inv.token } };
  } catch (e) { return fail(e); }
}

export async function updateMemberRole(fd: FormData) {
  const f = z.object({ ws: z.string().uuid(), user: z.string().uuid(), role: z.enum(["admin", "manager", "finance", "employee", "viewer"]) }).parse(formObject(fd));
  const sb = await createClient();
  await sb.from("workspace_members").update({ role: f.role }).eq("workspace_id", f.ws).eq("user_id", f.user);
  revalidatePath(`/w/${f.ws}/usuarios`);
}

export async function removeMember(fd: FormData) {
  const f = z.object({ ws: z.string().uuid(), user: z.string().uuid() }).parse(formObject(fd));
  const sb = await createClient();
  await sb.from("workspace_members").delete().eq("workspace_id", f.ws).eq("user_id", f.user);
  revalidatePath(`/w/${f.ws}/usuarios`);
}

export async function revokeInvite(fd: FormData) {
  const f = z.object({ ws: z.string().uuid(), id: z.string().uuid() }).parse(formObject(fd));
  const sb = await createClient();
  await sb.from("workspace_invites").delete().eq("id", f.id).eq("workspace_id", f.ws);
  revalidatePath(`/w/${f.ws}/usuarios`);
}

export async function acceptInvite(token: string): Promise<ActionState> {
  const sb = await createClient();
  const { data, error } = await sb.rpc("accept_invite", { p_token: token });
  if (error) return { error: error.message };
  redirect(`/w/${data}`);
}

export async function deleteWorkspace(fd: FormData) {
  const f = z.object({ ws: z.string().uuid(), confirm: z.string() }).parse(formObject(fd));
  const sb = await createClient();
  const { data: ws } = await sb.from("workspaces").select("name").eq("id", f.ws).single();
  if (!ws || ws.name !== f.confirm) redirect(`/w/${f.ws}/configuracoes?erro=confirmacao`);
  check(await sb.from("workspaces").delete().eq("id", f.ws).select("id"));
  redirect("/inicio");
}

export async function dismissInsight(fd: FormData) {
  const f = z.object({ ws: z.string().uuid(), key: z.string().max(200) }).parse(formObject(fd));
  const sb = await createClient();
  const { data: u } = await sb.auth.getUser();
  await sb.from("insight_dismissals").upsert({ workspace_id: f.ws, user_id: u.user!.id, insight_key: f.key });
  revalidatePath(`/w/${f.ws}`, "layout");
}
