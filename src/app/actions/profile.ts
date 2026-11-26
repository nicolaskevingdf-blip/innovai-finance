"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { fail, formObject, type ActionState } from "./_util";

export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const f = z.object({ full_name: z.string().trim().min(2, "Informe seu nome").max(80) }).parse(formObject(fd));
    const sb = await createClient();
    const { data: u } = await sb.auth.getUser();
    await sb.from("profiles").update({ full_name: f.full_name }).eq("id", u.user!.id);
    revalidatePath("/conta");
    return { ok: true, message: "Perfil atualizado." };
  } catch (e) { return fail(e); }
}

/**
 * Exclusão da conta (LGPD art. 18, VI): remove os ambientes dos quais o usuário é
 * proprietário único, sai dos demais e apaga o usuário de autenticação.
 * A remoção do login exige SUPABASE_SERVICE_ROLE_KEY no servidor.
 */
export async function deleteAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const f = formObject(fd);
  if (f.confirm !== "EXCLUIR") return { error: "Digite EXCLUIR para confirmar." };
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { error: "A exclusão automática ainda não está habilitada neste servidor. Solicite a exclusão ao suporte; seus dados podem ser exportados agora." };
  const sb = await createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) redirect("/entrar");
  const { data: owned } = await sb.from("workspace_members").select("workspace_id").eq("user_id", u.user.id).eq("role", "owner");
  for (const w of owned ?? []) await sb.from("workspaces").delete().eq("id", w.workspace_id);
  await sb.from("workspace_members").delete().eq("user_id", u.user.id);
  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });
  // remove arquivos dos ambientes excluídos
  for (const w of owned ?? []) {
    const { data: files } = await admin.storage.from("documents").list(w.workspace_id, { limit: 1000 });
    if (files?.length) await admin.storage.from("documents").remove(files.map((x) => `${w.workspace_id}/${x.name}`));
  }
  const { error } = await admin.auth.admin.deleteUser(u.user.id);
  if (error) return { error: "Não foi possível concluir a exclusão. Tente novamente." };
  await sb.auth.signOut();
  redirect("/?conta=excluida");
}
