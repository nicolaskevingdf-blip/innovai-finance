import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import type { Subscription } from "../plans";

export type Role = "owner" | "admin" | "manager" | "finance" | "employee" | "viewer";
export interface WorkspaceRow { id: string; kind: "personal" | "business" | "shared"; name: string; trade_name: string | null; segment: string | null; settings: Record<string, unknown> }
export interface WorkspaceCtx {
  userId: string;
  email: string;
  ws: WorkspaceRow;
  role: Role;
  canWrite: boolean;
  canOperate: boolean;
  canAdmin: boolean;
  sub: Subscription | null;
  all: { id: string; name: string; kind: string; role: Role }[];
  base: string;
}

export const getUser = cache(async () => {
  const sb = await createClient();
  const { data } = await sb.auth.getUser();
  return data.user;
});

export const listWorkspaces = cache(async () => {
  const sb = await createClient();
  const { data } = await sb.from("workspace_members").select("role, workspaces(id, name, kind)").order("created_at");
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  return (data ?? []).map((m: any) => ({ id: m.workspaces.id, name: m.workspaces.name, kind: m.workspaces.kind, role: m.role as Role }));
});

/** Resolve o ambiente ativo. RLS garante que só ambientes em que o usuário é membro são visíveis. */
export const getWorkspace = cache(async (wsId: string): Promise<WorkspaceCtx> => {
  const user = await getUser();
  if (!user) redirect("/entrar");
  if (!/^[0-9a-f-]{36}$/.test(wsId)) notFound();
  const sb = await createClient();
  const [{ data: ws }, all, { data: sub }] = await Promise.all([
    sb.from("workspaces").select("id, kind, name, trade_name, segment, settings").eq("id", wsId).maybeSingle(),
    listWorkspaces(),
    sb.from("subscriptions").select("plan_code, status, plans(features)").eq("workspace_id", wsId).maybeSingle(),
  ]);
  if (!ws) notFound();
  const role = all.find((w) => w.id === wsId)?.role ?? "viewer";
  return {
    userId: user.id, email: user.email ?? "", ws: ws as WorkspaceRow, role, all,
    canWrite: ["owner", "admin", "manager", "finance"].includes(role),
    canOperate: role !== "viewer",
    canAdmin: role === "owner" || role === "admin",
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    sub: sub ? { plan_code: sub.plan_code, status: sub.status, features: (sub as any).plans?.features ?? [] } : null,
    base: `/w/${wsId}`,
  };
});
