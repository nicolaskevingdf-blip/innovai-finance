import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Gera URL assinada de curta duração. RLS garante que só membros do ambiente acessam. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Inválido" }, { status: 400 });
  const sb = await createClient();
  const { data } = await sb.from("attachments").select("path").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const { data: signed, error } = await sb.storage.from("documents").createSignedUrl(data.path, 60);
  if (error || !signed) return NextResponse.json({ error: "Não foi possível abrir o documento" }, { status: 403 });
  return NextResponse.redirect(signed.signedUrl);
}
