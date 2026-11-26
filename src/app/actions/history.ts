"use server";
import { z } from "zod";
import { getWorkspace } from "@/lib/data/workspace";
import { entityHistory } from "@/lib/data/history";
import type { HistoryEntry } from "@/lib/history";

/** Histórico de alterações de um lançamento (somente administradores do ambiente). */
export async function loadEntityHistory(wsId: string, entityId: string): Promise<{ ok: true; entries: HistoryEntry[] } | { ok: false; error: string }> {
  const p = z.object({ ws: z.string().uuid(), id: z.string().uuid() }).safeParse({ ws: wsId, id: entityId });
  if (!p.success) return { ok: false, error: "Registro inválido." };
  const ctx = await getWorkspace(p.data.ws);
  if (!ctx.canAdmin) return { ok: false, error: "Somente administradores do ambiente veem o histórico." };
  return { ok: true, entries: await entityHistory(p.data.ws, p.data.id, ctx.userId) };
}
