"use client";
import { useEffect, useRef, useState } from "react";
import type { ActionState } from "@/app/actions/_util";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Loader2, User } from "lucide-react";
import clsx from "clsx";
import { createWorkspace } from "@/app/actions/workspace";
import { MoneyInput } from "@/components/client";
import { ACCOUNT_TYPES, BUSINESS_GOALS, PAYMENT_METHODS, PERSONAL_GOALS, SEGMENTS } from "@/lib/templates";

type Kind = "personal" | "business";

function Chips({ name, options, max }: { name: string; options: string[]; max?: number }) {
  const [sel, setSel] = useState<string[]>([]);
  return (
    <div className="flex flex-wrap gap-2">
      <input type="hidden" name={name} value={sel.join("|")} />
      {options.map((o) => (
        <button type="button" key={o} data-active={sel.includes(o)} className="chip h-10" onClick={() => setSel((s) => (s.includes(o) ? s.filter((x) => x !== o) : max && s.length >= max ? s : [...s, o]))}>{o}</button>
      ))}
    </div>
  );
}

// Definido fora do componente para não remontar (e apagar) os campos a cada renderização.
function Hidden({ show, children }: { show: boolean; children: React.ReactNode }) {
  return <div className={clsx(!show && "hidden", "space-y-5 animate-fade-up")}>{children}</div>;
}

export function Wizard({ initialKind, fullName, first, hasPersonal }: { initialKind: Kind | null; fullName: string; first: boolean; hasPersonal: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind | null>(initialKind);
  const [step, setStep] = useState(initialKind ? 1 : 0);
  const [state, setState] = useState<ActionState>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Chamada direta: libera o botão quando o servidor responde e impede criar o ambiente duas vezes
  const submit = async () => {
    if (pending || !formRef.current) return;
    setPending(true);
    try { setState(await createWorkspace(null, new FormData(formRef.current))); }
    catch { setState({ error: "Não foi possível concluir. Verifique sua conexão e tente novamente." }); }
    finally { setPending(false); }
  };
  useEffect(() => { if (state?.ok) router.replace(`/w/${(state.data as { id: string }).id}`); }, [state, router]);
  const steps = 3;

  return (
    <form ref={formRef} method="post" className="flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); if (step === steps) void submit(); else if (step > 0) setStep((s) => s + 1); }}>
      <input type="hidden" name="kind" value={kind ?? ""} />
      {step > 0 && (
        <div className="mb-8 flex gap-1.5">{Array.from({ length: steps }, (_, i) => <div key={i} className={clsx("h-1 flex-1 rounded-full", i < step ? "bg-lime" : "bg-surface-3")} />)}</div>
      )}

      <Hidden show={step === 0}>
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{first ? `Olá${fullName ? `, ${fullName.split(" ")[0]}` : ""}! Vamos organizar suas finanças.` : "Novo ambiente financeiro"}</h1>
          <p className="mt-2 text-muted">Cada ambiente tem seus próprios dados, categorias e relatórios. Nada se mistura.</p>
        </div>
        <div className="grid gap-3">
          {([["personal", User, "Finanças pessoais", "Para você, seu casal ou sua família."], ["business", Building2, "Finanças da empresa", "MEI, comércio, restaurante, barbearia, serviços…"]] as const).map(([k, Icon, t, d]) => (
            <button type="button" key={k} onClick={() => { setKind(k); setStep(1); }} className={clsx("card flex items-center gap-4 p-5 text-left transition hover:border-lime/50", k === "personal" && hasPersonal && "opacity-80")}>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-lime-soft text-lime"><Icon size={22} /></span>
              <span className="flex-1"><span className="block font-semibold">{t}</span><span className="text-[14px] text-muted">{d}</span></span>
              <ArrowRight size={18} className="text-faint" />
            </button>
          ))}
        </div>
      </Hidden>

      {/* Passo 1 — identificação */}
      <Hidden show={step === 1 && kind === "personal"}>
        <h2 className="text-2xl font-semibold tracking-tight">Sobre você</h2>
        {first && <label className="block"><span className="label">Como podemos te chamar?</span><input name={kind === "personal" ? "full_name" : "_f1"} defaultValue={fullName} className="input" /></label>}
        <label className="block"><span className="label">Nome do ambiente</span><input name={kind === "personal" ? "name" : "_n1"} defaultValue={hasPersonal ? "Finanças da casa" : "Minhas finanças"} className="input" /></label>
        <div><span className="label">Quais são seus objetivos? <span className="text-faint">(opcional)</span></span><Chips name={kind === "personal" ? "objectives" : "_o1"} options={PERSONAL_GOALS} max={5} /></div>
      </Hidden>
      <Hidden show={step === 1 && kind === "business"}>
        <h2 className="text-2xl font-semibold tracking-tight">Sobre o negócio</h2>
        <label className="block"><span className="label">Nome da empresa</span><input name={kind === "business" ? "name" : "_n2"} placeholder="Ex.: Barbearia Silva" className="input" /></label>
        <label className="block"><span className="label">Nome fantasia <span className="text-faint">(opcional)</span></span><input name="trade_name" className="input" /></label>
        <label className="block"><span className="label">Segmento</span>
          <select name="segment" className="input" defaultValue="general">{SEGMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          <span className="mt-1 block text-[12.5px] text-faint">Usamos o segmento para sugerir categorias adequadas. Tudo pode ser personalizado.</span>
        </label>
        {first && <label className="block"><span className="label">Seu nome</span><input name={kind === "business" ? "full_name" : "_f2"} defaultValue={fullName} className="input" /></label>}
      </Hidden>

      {/* Passo 2 — perfil financeiro */}
      <Hidden show={step === 2 && kind === "personal"}>
        <h2 className="text-2xl font-semibold tracking-tight">Sua renda</h2>
        <p className="-mt-3 text-muted">Ajuda a montar seu planejamento. Pode pular.</p>
        <label className="block"><span className="label">Renda mensal aproximada</span><MoneyInput name="income" /></label>
        <label className="block"><span className="label">Tipo de renda</span>
          <select name="income_type" className="input" defaultValue=""><option value="">Prefiro não informar</option><option value="clt">Salário fixo (CLT)</option><option value="autonomo">Autônomo / variável</option><option value="empresario">Empresário</option><option value="aposentado">Aposentadoria</option><option value="misto">Mais de uma fonte</option></select>
        </label>
      </Hidden>
      <Hidden show={step === 2 && kind === "business"}>
        <h2 className="text-2xl font-semibold tracking-tight">Como o negócio funciona</h2>
        <label className="block"><span className="label">Quantas pessoas vão usar o sistema?</span>
          <select name="team_size" className="input" defaultValue="1"><option value="1">Só eu</option><option value="2-3">2 a 3</option><option value="4-10">4 a 10</option><option value="10+">Mais de 10</option></select>
        </label>
        <div><span className="label">Formas de recebimento</span><Chips name="receive_methods" options={PAYMENT_METHODS.map((p) => p.label)} /></div>
        <div><span className="label">Objetivos <span className="text-faint">(opcional)</span></span><Chips name={kind === "business" ? "objectives" : "_o2"} options={BUSINESS_GOALS} max={4} /></div>
      </Hidden>

      {/* Passo 3 — contas */}
      <Hidden show={step === 3}>
        <h2 className="text-2xl font-semibold tracking-tight">{kind === "business" ? "Conta principal da empresa" : "Sua conta principal"}</h2>
        <p className="-mt-3 text-muted">Informe o saldo atual para começar com números corretos. {kind === "business" ? "Criaremos também um “Caixa da loja”." : "Criaremos também uma “Carteira”."}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="label">Nome</span><input name="account_name" placeholder={kind === "business" ? "Ex.: Conta PJ" : "Ex.: Nubank"} className="input" /></label>
          <label className="block"><span className="label">Tipo</span><select name="account_type" className="input" defaultValue={kind === "business" ? "checking" : "digital"}>{ACCOUNT_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select></label>
        </div>
        <label className="block"><span className="label">Saldo atual</span><MoneyInput name="account_balance" allowNegative /></label>
        {kind === "personal" ? (
          <details className="card p-4">
            <summary className="cursor-pointer text-[14px] font-medium">Adicionar um cartão de crédito <span className="text-faint">(opcional)</span></summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2"><span className="label">Nome do cartão</span><input name="card_name" placeholder="Ex.: Visa Platinum" className="input" /></label>
              <label className="block sm:col-span-2"><span className="label">Limite</span><MoneyInput name="card_limit" /></label>
              <label className="block"><span className="label">Dia de fechamento</span><input name="card_closing" type="number" min={1} max={28} className="input" /></label>
              <label className="block"><span className="label">Dia de vencimento</span><input name="card_due" type="number" min={1} max={28} className="input" /></label>
            </div>
          </details>
        ) : (
          <label className="block"><span className="label">Caixa mínimo de segurança <span className="text-faint">(opcional)</span></span><MoneyInput name="min_cash" /><span className="mt-1 block text-[12.5px] text-faint">Você será alertado quando o caixa projetado ficar abaixo desse valor.</span></label>
        )}
      </Hidden>

      {state?.error && <p role="alert" className="mt-5 rounded-xl border border-neg/25 bg-neg-soft px-3.5 py-2.5 text-[13.5px] text-neg">{state.error}</p>}

      {step > 0 && (
        <div className="sticky bottom-0 mt-auto flex items-center gap-3 bg-bg/90 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
          <button type="button" className="btn-ghost" onClick={() => setStep((s) => (s === 1 && !initialKind ? 0 : Math.max(1, s - 1)))}><ArrowLeft size={18} /> Voltar</button>
          <div className="flex-1" />
          {step < steps && step > 1 && <button type="button" className="btn-ghost" onClick={() => setStep(steps)}>Pular</button>}
          {step < steps ? (
            <button key="next" type="button" className="btn-primary" onClick={() => setStep((s) => s + 1)}>Continuar <ArrowRight size={18} /></button>
          ) : (
            <button key="submit" type="button" className="btn-primary" disabled={pending} onClick={() => void submit()}>{pending ? <><Loader2 size={16} className="animate-spin" /> Preparando…</> : "Começar a usar"}</button>
          )}
        </div>
      )}
    </form>
  );
}
