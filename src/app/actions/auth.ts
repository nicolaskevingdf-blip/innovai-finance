"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fail, formObject, type ActionState } from "./_util";

const safeNext = (n: string | undefined) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/inicio");

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const f = formObject(fd);
  const p = z.object({ email: z.string().email("E-mail inválido"), password: z.string().min(1, "Informe a senha") }).safeParse(f);
  if (!p.success) return fail(p.error);
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword(p.data);
  if (error) {
    if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message))
      return { error: "Seu e-mail ainda não foi confirmado. Abra o e-mail de confirmação que enviamos e clique no link; depois volte aqui e entre normalmente." };
    if (error.status === 429) return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
    return { error: "E-mail ou senha incorretos." };
  }
  redirect(safeNext(f.next));
}

export async function signUp(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = z.object({
    name: z.string().trim().min(2, "Informe seu nome").max(80),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres").regex(/[A-Za-z]/, "Use letras e números").regex(/\d/, "Use letras e números"),
    terms: z.literal("on", { message: "Aceite os termos e a política de privacidade" }),
  }).safeParse(formObject(fd));
  if (!p.success) return fail(p.error);
  const sb = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await sb.auth.signUp({ email: p.data.email, password: p.data.password, options: { data: { full_name: p.data.name }, emailRedirectTo: `${origin}/auth/callback?next=/onboarding` } });
  if (error) {
    if (/registered/i.test(error.message)) return { error: "Este e-mail já possui conta." };
    if (error.status === 429 || /rate limit/i.test(error.message)) return { error: "Muitos cadastros neste momento. Aguarde alguns minutos e tente novamente." };
    return { error: "Não foi possível criar a conta agora. Tente novamente." };
  }
  // Supabase devolve usuário sem identidades quando o e-mail já existe (proteção contra enumeração)
  if (data.user && data.user.identities?.length === 0) return { error: "Este e-mail já possui conta." };
  if (!data.session) return { ok: true, message: "Conta criada! Enviamos um link de confirmação para o seu e-mail. Clique nele e depois volte para entrar com seu e-mail e senha." };
  redirect("/onboarding");
}

export async function signOut() {
  const sb = await createClient();
  await sb.auth.signOut();
  redirect("/entrar");
}

export async function requestReset(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = z.object({ email: z.string().email("E-mail inválido") }).safeParse(formObject(fd));
  if (!p.success) return fail(p.error);
  const sb = await createClient();
  const origin = (await headers()).get("origin") ?? "";
  await sb.auth.resetPasswordForEmail(p.data.email, { redirectTo: `${origin}/auth/callback?next=/recuperar-senha/nova` });
  // resposta idêntica exista ou não o e-mail (evita enumeração)
  return { ok: true, message: "Se houver uma conta com este e-mail, você receberá um link para redefinir a senha." };
}

export async function updatePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const p = z.object({ password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres") }).safeParse(formObject(fd));
  if (!p.success) return fail(p.error);
  const sb = await createClient();
  const { error } = await sb.auth.updateUser({ password: p.data.password });
  if (error) return { error: error.message };
  redirect("/inicio");
}
