"use client";
import Link from "next/link";
import { ActionForm, Submit } from "@/components/client";
import { signIn, signUp, requestReset, updatePassword } from "@/app/actions/auth";

export function SignInForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signIn}>
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block"><span className="label">E-mail</span><input name="email" type="email" autoComplete="email" required className="input" /></label>
      <label className="block"><span className="label">Senha</span><input name="password" type="password" autoComplete="current-password" required className="input" /></label>
      <div className="flex justify-end"><Link href="/recuperar-senha" className="text-[13px] text-muted hover:text-fg">Esqueci minha senha</Link></div>
      <Submit className="w-full" pendingText="Entrando…">Entrar</Submit>
    </ActionForm>
  );
}

export function SignUpForm() {
  return (
    <ActionForm action={signUp} keepOpen>
      {(s) => s?.ok ? null : (
        <>
          <label className="block"><span className="label">Seu nome</span><input name="name" autoComplete="name" required className="input" /></label>
          <label className="block"><span className="label">E-mail</span><input name="email" type="email" autoComplete="email" required className="input" /></label>
          <label className="block"><span className="label">Senha</span><input name="password" type="password" autoComplete="new-password" minLength={8} required className="input" /><span className="mt-1 block text-[12.5px] text-faint">Mínimo de 8 caracteres, com letras e números.</span></label>
          <label className="flex items-start gap-2.5 text-[13px] text-muted"><input type="checkbox" name="terms" className="mt-0.5 size-4 accent-[var(--color-lime)]" required /> <span>Li e aceito os <Link href="/termos" className="text-fg underline">termos de uso</Link> e a <Link href="/privacidade" className="text-fg underline">política de privacidade</Link>.</span></label>
          <Submit className="w-full" pendingText="Criando conta…">Criar conta</Submit>
        </>
      )}
    </ActionForm>
  );
}

export function ResetForm() {
  return (
    <ActionForm action={requestReset} keepOpen>
      <label className="block"><span className="label">E-mail da conta</span><input name="email" type="email" required className="input" /></label>
      <Submit className="w-full" pendingText="Enviando…">Enviar link</Submit>
    </ActionForm>
  );
}

export function NewPasswordForm() {
  return (
    <ActionForm action={updatePassword}>
      <label className="block"><span className="label">Nova senha</span><input name="password" type="password" autoComplete="new-password" minLength={8} required className="input" /></label>
      <Submit className="w-full">Salvar nova senha</Submit>
    </ActionForm>
  );
}
