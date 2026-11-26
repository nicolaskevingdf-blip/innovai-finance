"use server";
import { sniffType } from "@/lib/files";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, formObject, refresh, type ActionState } from "./_util";

// ---------- Documentos ----------
const MAX_FILE = 10 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic"];



export async function uploadAttachment(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const ws = z.string().uuid().parse(fd.get("ws"));
    const txId = z.string().uuid().optional().or(z.literal("").transform(() => undefined)).parse(fd.get("transaction_id") ?? "");
    const kind = z.enum(["invoice", "boleto", "receipt", "proof", "contract", "bill", "purchase", "other"]).parse(fd.get("kind") ?? "other");
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Selecione um arquivo." };
    if (file.size > MAX_FILE) return { error: "Arquivo maior que 10 MB." };
    const real = sniffType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
    if (!real || !ALLOWED.includes(real)) return { error: "Formato não suportado ou arquivo inválido. Envie PDF, PNG, JPG, WEBP ou HEIC." };
    const sb = await createClient();
    const { data: u } = await sb.auth.getUser();
    const safe = file.name.normalize("NFD").replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${ws}/${crypto.randomUUID()}-${safe}`;
    const up = await sb.storage.from("documents").upload(path, file, { contentType: real, upsert: false });
    if (up.error) throw new Error(up.error.message);
    const ins = await sb.from("attachments").insert({ workspace_id: ws, transaction_id: txId ?? null, kind, path, file_name: file.name.slice(0, 200), mime_type: real, size_bytes: file.size, uploaded_by: u.user!.id });
    if (ins.error) { await sb.storage.from("documents").remove([path]); throw new Error(ins.error.message); }
    refresh(ws);
    return { ok: true, message: "Documento anexado." };
  } catch (e) { return fail(e); }
}

export async function deleteAttachment(fd: FormData) {
  const f = z.object({ ws: z.string().uuid(), id: z.string().uuid() }).parse(formObject(fd));
  const sb = await createClient();
  const { data } = await sb.from("attachments").select("path").eq("id", f.id).eq("workspace_id", f.ws).single();
  if (data) {
    await sb.storage.from("documents").remove([data.path]);
    await sb.from("attachments").delete().eq("id", f.id);
  }
  refresh(f.ws);
}
