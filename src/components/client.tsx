"use client";
import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X, Loader2, Check } from "lucide-react";
import clsx from "clsx";
import type { ActionState } from "@/app/actions/_util";

const SheetCtx = createContext<{ close: () => void } | null>(null);
export const useSheet = () => useContext(SheetCtx);

/** Bottom sheet no celular, diálogo centralizado no desktop. */
export function Sheet({ trigger, title, children, wide, defaultOpen, onClose }: { trigger?: ReactNode; title: string; children: ReactNode; wide?: boolean; defaultOpen?: boolean; onClose?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(!!defaultOpen);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const close = () => { setOpen(false); onClose?.(); };
  return (
    <>
      {trigger && <span onClick={() => setOpen(true)} className="contents">{trigger}</span>}
      <dialog ref={ref} className="sheet" onClose={close} onClick={(e) => { if (e.target === ref.current) close(); }}>
        <div role="document" className={clsx("fixed inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-[1.75rem] border-t border-line-strong bg-surface sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[88dvh] sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[1.5rem] sm:border sm:pb-0", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}>
          <div className="sticky top-0 z-10 border-b border-line bg-surface/95 px-5 pb-3 pt-2.5 backdrop-blur sm:pt-4">
            <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
            <div className="flex items-center justify-between gap-3">
              <h2 className="min-w-0 truncate text-[16.5px] font-semibold">{title}</h2>
              <button type="button" onClick={close} className="btn-ghost size-10 shrink-0 rounded-full p-0 sm:size-9" aria-label="Fechar"><X size={19} /></button>
            </div>
          </div>
          <div className="px-5 pb-5 pt-4">{open && <SheetCtx.Provider value={{ close }}>{children}</SheetCtx.Provider>}</div>
        </div>
      </dialog>
    </>
  );
}

const PendingCtx = createContext(false);

export function Submit({ children, className, pendingText = "Salvando…", inline }: { children: ReactNode; className?: string; pendingText?: string; inline?: boolean }) {
  const pending = useContext(PendingCtx);
  const inSheet = useContext(SheetCtx) !== null;
  const btn = (
    <button type="submit" disabled={pending} className={clsx("btn-primary", className)}>
      {pending ? <><Loader2 size={16} className="animate-spin" /> {pendingText}</> : children}
    </button>
  );
  // Dentro de um sheet, o botão principal fica fixo no rodapé (sempre visível, inclusive com o teclado aberto)
  return inSheet && !inline ? <div className="sheet-actions">{btn}</div> : btn;
}

/** Formulário com feedback de erro/sucesso. Fecha o sheet ao concluir com sucesso. */
export function ActionForm({ action, children, className, keepOpen, onDone, resetOnSuccess }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; children: ReactNode | ((s: ActionState) => ReactNode); className?: string; keepOpen?: boolean; onDone?: (s: ActionState) => void; resetOnSuccess?: boolean }) {
  const [state, formAction, pending] = useActionState(action, null);
  const sheet = useSheet();
  const ref = useRef<HTMLFormElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state?.error || state?.message) feedback.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (state?.ok) {
      onDone?.(state);
      if (resetOnSuccess) ref.current?.reset();
      if (!keepOpen && sheet) { const t = setTimeout(sheet.close, 450); return () => clearTimeout(t); }
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    // Envio manual (em vez de action={...}) para o React não limpar os campos quando há erro de validação.
    <form ref={ref} className={clsx("space-y-4", className)} noValidate
      onSubmit={(e) => { e.preventDefault(); if (pending) return; const fd = new FormData(e.currentTarget); startTransition(() => formAction(fd)); }}>
      <PendingCtx.Provider value={pending}>{typeof children === "function" ? children(state) : children}</PendingCtx.Provider>
      <div ref={feedback} />
      {state?.error && <p role="alert" className="rounded-xl border border-neg/25 bg-neg-soft px-3.5 py-2.5 text-[13.5px] text-neg">{state.error}</p>}
      {state?.ok && state.message && <p role="status" className="flex animate-[pop_0.4s_ease-out] items-center gap-2 rounded-xl border border-lime/25 bg-lime-soft px-3.5 py-2.5 text-[13.5px] text-lime"><Check size={15} className="shrink-0" /> {state.message}</p>}
    </form>
  );
}

/** Campo monetário com teclado numérico no celular. */
export function MoneyInput({ name, defaultValue, placeholder = "0,00", autoFocus, large, required, allowNegative }: { name: string; defaultValue?: string; placeholder?: string; autoFocus?: boolean; large?: boolean; required?: boolean; allowNegative?: boolean }) {
  const [v, setV] = useState(defaultValue ?? "");
  return (
    <div className="relative">
      <span className={clsx("pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint", large ? "text-xl" : "text-[15px]")}>R$</span>
      <input name={name} value={v} required={required} autoFocus={autoFocus} placeholder={placeholder} inputMode="decimal" autoComplete="off"
        onChange={(e) => setV(e.target.value.replace(allowNegative ? /[^\d.,-]/g : /[^\d.,]/g, ""))}
        className={clsx("input num", large ? "h-16 pl-12 text-[28px] font-semibold" : "pl-10")} />
    </div>
  );
}

/** Botão que confirma antes de enviar uma ação destrutiva. */
export function ConfirmSubmit({ children, message, className }: { children: ReactNode; message: string; className?: string }) {
  return <button type="submit" className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>{children}</button>;
}

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return <button type="button" className="btn-secondary btn-sm" onClick={async () => { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}>{ok ? "Copiado" : label}</button>;
}
