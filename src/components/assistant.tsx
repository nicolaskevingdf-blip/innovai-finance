"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import clsx from "clsx";
import { askAssistant, type ChatTurn } from "@/app/actions/ai";

export function Assistant({ ws, suggestions, mode }: { ws: string; suggestions: string[]; mode: "claude" | "local" }) {
  const [turns, setTurns] = useState<(ChatTurn & { engine?: string })[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [turns, busy]);
  const ask = async (text: string) => {
    if (!text.trim() || busy) return;
    const history = turns.map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: "user", content: text }]); setQ(""); setBusy(true);
    try {
      const r = await askAssistant(ws, text, history);
      setTurns((t) => [...t, { role: "assistant", content: r.answer, engine: r.engine }]);
    } catch {
      setTurns((t) => [...t, { role: "assistant", content: "Não foi possível responder agora. Tente novamente.", engine: "none" }]);
    } finally { setBusy(false); }
  };
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-64 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {!turns.length && (
          <div>
            <div className="flex items-center gap-2 text-[14px] text-muted"><Sparkles size={16} className="text-lime" /> Pergunte sobre suas finanças. As respostas usam apenas os dados deste ambiente.</div>
            <div className="mt-4 flex flex-wrap gap-2">{suggestions.map((s) => <button key={s} onClick={() => ask(s)} className="chip h-auto py-2 text-left text-[13px]">{s}</button>)}</div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={clsx("flex", t.role === "user" ? "justify-end" : "justify-start")}>
            <div className={clsx("max-w-[88%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed", t.role === "user" ? "bg-lime text-lime-ink" : "border border-line bg-surface-2")}>
              {t.content}
              {t.role === "assistant" && t.engine && t.engine !== "none" && <div className="mt-1.5 text-[11px] text-faint">{t.engine === "claude" ? "IA · baseado nos dados do ambiente" : "Cálculo do sistema"}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-[13px] text-muted"><Loader2 size={14} className="animate-spin" /> Analisando seus dados…</div>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2 border-t border-line p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder={mode === "claude" ? "Pergunte qualquer coisa sobre suas finanças…" : "Ex.: quanto gastei com alimentação este mês?"} className="input flex-1" />
        <button disabled={busy || !q.trim()} className="btn-primary w-11 px-0" aria-label="Enviar"><ArrowUp size={18} /></button>
      </form>
    </div>
  );
}
