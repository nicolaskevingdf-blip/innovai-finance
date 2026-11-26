"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Loader2, Mic, MicOff, Sparkles, Wand2 } from "lucide-react";
import { ActionForm, Submit } from "./client";
import { createTransaction } from "@/app/actions/finance";
import { interpretEntry, type EntrySuggestion } from "@/app/actions/ai";
import { formatBRL } from "@/lib/finance/money";
import { fmtDate } from "@/lib/finance/dates";
import { PAYMENT_METHODS } from "@/lib/templates";

export interface FormRefs {
  ws: string;
  kind: string;
  today: string;
  accounts: { id: string; name: string }[];
  cards: { id: string; name: string }[];
  categories: { id: string; name: string; kind: "income" | "expense"; parentId: string | null }[];
  contacts: { id: string; name: string; kind: "client" | "supplier" }[];
  canWrite: boolean;
}

type T = "expense" | "income" | "transfer";

export function CategorySelect({ categories, kind, value, onChange, name = "category_id" }: { categories: FormRefs["categories"]; kind: "income" | "expense"; value?: string; onChange?: (v: string) => void; name?: string }) {
  const parents = categories.filter((c) => c.kind === kind && !c.parentId);
  return (
    <select name={name} className="input" {...(onChange ? { value: value ?? "", onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) } : { defaultValue: value ?? "" })}>
      <option value="">Sem categoria</option>
      {parents.map((p) => {
        const kids = categories.filter((c) => c.parentId === p.id);
        return kids.length ? (
          <optgroup key={p.id} label={p.name}>
            <option value={p.id}>{p.name} (geral)</option>
            {kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </optgroup>
        ) : <option key={p.id} value={p.id}>{p.name}</option>;
      })}
    </select>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function TransactionForm({ refs, defaultType = "expense", defaultStatus = "paid", allowAI = true, onlyType }: { refs: FormRefs; defaultType?: T; defaultStatus?: "paid" | "pending"; allowAI?: boolean; onlyType?: boolean }) {
  const [type, setType] = useState<T>(defaultType);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("");
  const [date, setDate] = useState(refs.today);
  const [status, setStatus] = useState<"paid" | "pending">(defaultStatus);
  const [source, setSource] = useState(refs.accounts[0] ? `acc:${refs.accounts[0].id}` : "");
  const [method, setMethod] = useState("");
  const [inst, setInst] = useState("1");
  const [more, setMore] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<{ s: EntrySuggestion } | { error: string } | null>(null);
  const [listening, setListening] = useState(false);
  const rec = useRef<any>(null);
  const isCard = source.startsWith("card:");
  // Detectado após montar para não divergir do HTML do servidor (hidratação).
  const [speechOK, setSpeechOK] = useState(false);
  useEffect(() => { setSpeechOK("webkitSpeechRecognition" in window || "SpeechRecognition" in window); }, []);

  const interpret = async (t = text) => {
    if (t.trim().length < 3) return;
    setBusy(true); setHint(null);
    const r = await interpretEntry(refs.ws, t);
    setBusy(false);
    if (!r.ok) { setHint({ error: r.error }); return; }
    const s = r.suggestion;
    if (s.type) setType(s.type);
    if (s.amount) setAmount((s.amount / 100).toFixed(2).replace(".", ","));
    setDesc(s.description);
    setCat(s.categoryId ?? "");
    setDate(s.date);
    if (s.paymentMethod) setMethod(s.paymentMethod);
    if (s.installments) { setInst(String(s.installments)); setMore(true); }
    if (s.paymentMethod === "credit" && refs.cards[0]) setSource(`card:${refs.cards[0].id}`);
    if (s.date > refs.today) setStatus("pending");
    setHint({ s });
  };

  const toggleVoice = () => {
    if (listening) { rec.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "pt-BR"; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e: any) => { const t = e.results[0][0].transcript; setText(t); interpret(t); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; r.start(); setListening(true);
  };

  const accountId = source.startsWith("acc:") ? source.slice(4) : "";
  const cardId = isCard ? source.slice(5) : "";
  const contacts = useMemo(() => refs.contacts.filter((c) => (type === "income" ? c.kind === "client" : c.kind === "supplier")), [refs.contacts, type]);

  if (!refs.canWrite) return <p className="pb-4 text-muted">Seu perfil neste ambiente é somente leitura.</p>;
  if (!refs.accounts.length) return <p className="pb-4 text-muted">Cadastre uma conta antes de registrar movimentações.</p>;

  return (
    <div className="pb-2">
      {allowAI && (
        <div className="mb-5 rounded-2xl border border-line bg-surface-2 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[12.5px] text-muted"><Sparkles size={14} className="text-lime" /> Lançamento rápido por texto{speechOK ? " ou voz" : ""}</div>
          <div className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); interpret(); } }} placeholder="Ex.: gastei 85 reais abastecendo a moto hoje" className="input h-11 flex-1 bg-surface" />
            {speechOK && <button type="button" onClick={toggleVoice} className={clsx("btn-secondary w-11 px-0", listening && "border-lime text-lime")} aria-label={listening ? "Parar gravação" : "Falar"}>{listening ? <MicOff size={18} /> : <Mic size={18} />}</button>}
            <button type="button" onClick={() => interpret()} disabled={busy || text.trim().length < 3} className="btn-secondary w-11 px-0" aria-label="Interpretar">{busy ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}</button>
          </div>
          {hint && "error" in hint && <p className="mt-2 text-[12.5px] text-neg">{hint.error}</p>}
          {hint && "s" in hint && (
            <p className="mt-2 text-[12.5px] text-muted">
              Sugestão preenchida abaixo — <b className="text-fg">confira antes de salvar</b>.
              {hint.s.missing.includes("amount") && <span className="text-warn"> Não identifiquei o valor.</span>}
              {hint.s.missing.includes("type") && <span className="text-warn"> Confirme se é receita ou despesa.</span>}
              {hint.s.amount && <> {hint.s.type === "income" ? "Receita" : "Despesa"} de {formatBRL(hint.s.amount)} em {fmtDate(hint.s.date)}{hint.s.categoryName ? `, ${hint.s.categoryName}` : ""}.</>}
              <span className="ml-1 text-faint">({hint.s.engine === "claude" ? "IA" : "interpretação local"})</span>
            </p>
          )}
        </div>
      )}

      <ActionForm action={createTransaction}>
        <input type="hidden" name="ws" value={refs.ws} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="status" value={type === "transfer" || isCard ? "paid" : status} />
        <input type="hidden" name="account_id" value={accountId} />
        <input type="hidden" name="card_id" value={type === "expense" ? cardId : ""} />
        <input type="hidden" name="source" value={hint && "s" in hint ? (listening ? "voice" : "ai_text") : "manual"} />

        {!onlyType && (
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
            {([["expense", "Despesa"], ["income", "Receita"], ["transfer", "Transferência"]] as const).map(([k, l]) => (
              <button type="button" key={k} onClick={() => { setType(k); setCat(""); if (k !== "expense" && isCard && refs.accounts[0]) setSource(`acc:${refs.accounts[0].id}`); }} className={clsx("h-9 rounded-lg text-[14px] font-medium transition", type === k ? (k === "income" ? "bg-lime text-lime-ink" : k === "expense" ? "bg-fg text-bg" : "bg-surface-3 text-fg") : "text-muted")}>{l}</button>
            ))}
          </div>
        )}

        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-faint">R$</span>
          <input name="amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" placeholder="0,00" autoComplete="off" className="input num h-16 pl-12 text-[28px] font-semibold" aria-label="Valor" />
        </div>
        <label className="block"><span className="label">Descrição</span><input name="description" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={140} className="input" placeholder={type === "income" ? "Ex.: Salário" : type === "transfer" ? "Ex.: Reserva" : "Ex.: Mercado"} /></label>

        {type !== "transfer" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label">Categoria</span><CategorySelect categories={refs.categories} kind={type} value={cat} onChange={setCat} /></label>
            <label className="block"><span className="label">{type === "income" ? "Recebido em" : "Pago com"}</span>
              <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
                <optgroup label="Contas">{refs.accounts.map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}</optgroup>
                {type === "expense" && refs.cards.length > 0 && <optgroup label="Cartões de crédito">{refs.cards.map((c) => <option key={c.id} value={`card:${c.id}`}>{c.name}</option>)}</optgroup>}
              </select>
            </label>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label">De</span><select className="input" value={accountId} onChange={(e) => setSource(`acc:${e.target.value}`)}>{refs.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            <label className="block"><span className="label">Para</span><select name="to_account_id" className="input" defaultValue={refs.accounts[1]?.id ?? ""}>{refs.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
            <p className="text-[12.5px] text-faint sm:col-span-2">Transferências entre contas não contam como receita nem despesa.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="label">{isCard ? "Data da compra" : "Data"}</span><input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" /></label>
          {type !== "transfer" && !isCard && (
            <div><span className="label">Situação</span>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
                {([["paid", type === "income" ? "Recebido" : "Pago"], ["pending", type === "income" ? "A receber" : "A pagar"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setStatus(k)} className={clsx("h-9 rounded-lg text-[14px]", status === k ? "bg-surface-3 font-medium text-fg" : "text-muted")}>{l}</button>)}
              </div>
            </div>
          )}
        </div>
        {status === "pending" && type !== "transfer" && !isCard && <label className="block"><span className="label">Vencimento</span><input type="date" name="due_date" defaultValue={date} className="input" /></label>}

        {type !== "transfer" && (
          <button type="button" onClick={() => setMore((m) => !m)} className="text-[13.5px] text-muted hover:text-fg">{more ? "− Menos opções" : "+ Parcelas, recorrência, forma de pagamento, observações"}</button>
        )}
        <div className={clsx("space-y-4", !(more && type !== "transfer") && "hidden")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label">Parcelas</span>
              <select name="installments" className="input" value={inst} onChange={(e) => setInst(e.target.value)}>{Array.from({ length: 24 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? "À vista" : `${n}x`}</option>)}</select>
              {Number(inst) > 1 && amount && <span className="mt-1 block text-[12.5px] text-faint">Valor total dividido em {inst} parcelas{isCard ? ", lançadas nas próximas faturas" : " mensais (pendentes)"}.</span>}
            </label>
            {!isCard && <label className="block"><span className="label">Repetir</span>
              <select name="recurrence" className="input" defaultValue="" disabled={Number(inst) > 1}><option value="">Não repetir</option><option value="monthly">Todo mês</option><option value="weekly">Toda semana</option><option value="yearly">Todo ano</option></select>
              <span className="mt-1 block text-[12.5px] text-faint">Gera as próximas 12 ocorrências como pendentes.</span>
            </label>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {!isCard && <label className="block"><span className="label">Forma de pagamento</span><select name="payment_method" className="input" value={method} onChange={(e) => setMethod(e.target.value)}><option value="">—</option>{PAYMENT_METHODS.filter((p) => p.value !== "credit").map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>}
            {refs.kind === "business" && contacts.length > 0 && <label className="block"><span className="label">{type === "income" ? "Cliente" : "Fornecedor"}</span><select name="contact_id" className="input" defaultValue=""><option value="">—</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
          </div>
          <label className="block"><span className="label">Tags <span className="text-faint">(separadas por vírgula)</span></span><input name="tags" className="input" placeholder="viagem, trabalho" /></label>
          <label className="block"><span className="label">Observações</span><textarea name="notes" rows={2} className="input" /></label>
        </div>

        <Submit className="w-full h-12">Salvar lançamento</Submit>
      </ActionForm>
    </div>
  );
}
