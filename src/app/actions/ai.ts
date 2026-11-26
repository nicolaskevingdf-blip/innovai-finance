"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/data/workspace";
import { loadLedger } from "@/lib/data/ledger";
import { hasFeature } from "@/lib/plans";
import { matchCategory, parseEntryText } from "@/lib/finance/parser";
import { isISODate } from "@/lib/finance/dates";
import { goalProjection } from "@/lib/finance/planning";
import { toCents } from "@/lib/finance/money";
import { summarize } from "@/lib/finance/ledger";
import { monthEnd, monthStart, todayISO } from "@/lib/finance/dates";
import { answerDeterministic } from "@/lib/ai/intents";
import { buildFinancialContext } from "@/lib/ai/context";
import { claude, consumeQuota, FALLBACK, MODEL, textOf } from "@/lib/ai/claude";

export interface EntrySuggestion {
  type: "income" | "expense" | null;
  amount: number | null;
  date: string;
  description: string;
  categoryId: string | null;
  categoryName: string | null;
  paymentMethod: string | null;
  installments: number | null;
  confidence: "high" | "medium" | "low";
  engine: "local" | "claude";
  missing: string[];
}

/** Interpreta texto livre e devolve uma SUGESTÃO. Nunca grava nada: o usuário confirma no formulário. */
export async function interpretEntry(wsId: string, text: string): Promise<{ ok: true; suggestion: EntrySuggestion } | { ok: false; error: string }> {
  const input = z.string().trim().min(3).max(300).safeParse(text);
  if (!input.success) return { ok: false, error: "Escreva uma frase curta, como “gastei 85 reais de gasolina hoje”." };
  const ctx = await getWorkspace(wsId);
  const sb = await createClient();
  const { data: cats } = await sb.from("categories").select("id,name,kind").eq("workspace_id", wsId).eq("archived", false);
  const categories = cats ?? [];
  const today = todayISO();
  const p = parseEntryText(input.data, today);
  let s: EntrySuggestion = { ...p, categoryId: null, categoryName: null, engine: "local" };
  const cat = matchCategory(p.categoryHint, p.type, categories);
  if (cat) { s.categoryId = cat.id; s.categoryName = cat.name; }

  const ai = hasFeature(ctx.sub, "ai") ? claude() : null;
  // só consome cota (e custo) quando a interpretação local não foi suficiente
  if (ai && (p.confidence !== "high" || !cat) && (await consumeQuota())) {
    try {
      const schema = {
        type: "object", additionalProperties: false,
        required: ["type", "amount", "date", "description", "category", "payment_method", "installments"],
        properties: {
          type: { type: ["string", "null"], enum: ["income", "expense", null] },
          amount: { type: ["number", "null"], description: "Valor em reais. null se não informado." },
          date: { type: "string", description: "YYYY-MM-DD" },
          description: { type: "string" },
          category: { type: ["string", "null"], description: "Exatamente um nome da lista fornecida, ou null." },
          payment_method: { type: ["string", "null"], enum: ["cash", "pix", "debit", "credit", "boleto", "transfer", "app", "other", null] },
          installments: { type: ["integer", "null"] },
        },
      };
      const msg = await ai.beta.messages.create({
        model: MODEL, max_tokens: 1024, ...FALLBACK,
        output_config: { effort: "low", format: { type: "json_schema", schema } },
        system: "Você extrai dados de um lançamento financeiro descrito em português do Brasil. Não invente valores: se o valor não estiver no texto, use null. A categoria deve ser exatamente um dos nomes listados ou null.",
        messages: [{ role: "user", content: `Hoje é ${today}.\nCategorias de despesa: ${categories.filter((c) => c.kind === "expense").map((c) => c.name).join(", ")}\nCategorias de receita: ${categories.filter((c) => c.kind === "income").map((c) => c.name).join(", ")}\n\nTexto: """${input.data}"""` }],
      });
      if (msg.stop_reason === "end_turn") {
        const j = JSON.parse(textOf(msg));
        const c2 = categories.find((c) => c.name === j.category);
        const amount = typeof j.amount === "number" && j.amount > 0 ? toCents(j.amount) : null;
        s = {
          type: j.type ?? s.type, amount: amount ?? s.amount, date: isISODate(j.date) ? j.date : s.date,
          description: String(j.description || s.description).slice(0, 140), categoryId: c2?.id ?? s.categoryId, categoryName: c2?.name ?? s.categoryName,
          paymentMethod: j.payment_method ?? s.paymentMethod, installments: j.installments && j.installments >= 2 ? j.installments : s.installments,
          confidence: amount && j.type ? "high" : "medium", engine: "claude", missing: [...(amount ? [] : ["amount"]), ...(j.type ? [] : ["type"])],
        };
      }
    } catch (e) {
      console.error("interpretEntry: falha na IA, usando interpretação local", (e as Error).name);
    }
  }
  return { ok: true, suggestion: s };
}

export interface ChatTurn { role: "user" | "assistant"; content: string }

/** Assistente financeiro contextual — responde apenas com dados do ambiente ativo. */
export async function askAssistant(wsId: string, question: string, history: ChatTurn[]): Promise<{ answer: string; engine: "local" | "claude" | "none" }> {
  const q = z.string().trim().min(2).max(500).safeParse(question);
  if (!q.success) return { answer: "Escreva sua pergunta em uma frase.", engine: "none" };
  const ctx = await getWorkspace(wsId);
  const L = await loadLedger(wsId);
  const sb = await createClient();
  const [{ data: goals }, { data: contribs }, { data: budgets }] = await Promise.all([
    sb.from("goals").select("id,name,target_amount,target_date").eq("workspace_id", wsId).eq("archived", false),
    sb.from("goal_contributions").select("goal_id,amount,date").eq("workspace_id", wsId),
    sb.from("budgets").select("category_id,amount").eq("workspace_id", wsId).eq("month", monthStart(L.today)),
  ]);
  const goalsP = (goals ?? []).map((g) => {
    const pr = goalProjection({ target: toCents(g.target_amount), contributions: (contribs ?? []).filter((c) => c.goal_id === g.id).map((c) => ({ amount: toCents(c.amount), date: c.date })), targetDate: g.target_date, today: L.today });
    return { name: g.name, target: toCents(g.target_amount), saved: pr.saved, remaining: pr.remaining, targetDate: g.target_date, monthlyNeeded: pr.monthlyNeeded, projectedDate: pr.projectedDate, pct: pr.pct };
  });
  const settings = ctx.ws.settings as { min_cash?: number; withdrawal_limit?: number };
  const kind = ctx.ws.kind === "business" ? "business" : "personal";
  const deterministic = answerDeterministic(q.data, { kind, today: L.today, accounts: L.accounts, categories: L.categories, cards: L.cards, txs: L.txs, balances: L.balances, goals: goalsP, minCash: settings.min_cash ?? null, withdrawalLimit: settings.withdrawal_limit ?? null });

  const ai = hasFeature(ctx.sub, "ai") ? claude() : null;
  if (ai && !(await consumeQuota())) {
    return { answer: (deterministic ?? "Você atingiu o limite diário de perguntas abertas à IA.") + "\n\n(Limite diário da IA generativa atingido — respostas calculadas pelo sistema continuam disponíveis.)", engine: deterministic ? "local" : "none" };
  }
  if (!ai) {
    return deterministic
      ? { answer: deterministic, engine: "local" }
      : { answer: "Ainda não sei responder essa pergunta com o motor local. Tente perguntas sobre gastos por categoria, maiores despesas, contas a pagar ou receber, saldo, fluxo de caixa, metas ou comparação com o mês passado.\n\n(Para perguntas abertas, a IA generativa precisa estar configurada pelo administrador da plataforma.)", engine: "none" };
  }
  const spentNow = summarize(L.txs, monthStart(L.today), monthEnd(L.today), { includePending: true }).byCategory;
  const names = new Map(L.categories.map((c) => [c.id, c.name]));
  const fin = buildFinancialContext(kind, L, { goals: goalsP, budgets: (budgets ?? []).map((b) => ({ category: names.get(b.category_id) ?? "?", amount: toCents(b.amount), spent: spentNow.get(b.category_id) ?? 0 })), minCash: settings.min_cash ?? null, withdrawalLimit: settings.withdrawal_limit ?? null });
  const system = `Você é a Inteligência Innovai, analista financeira do ambiente ${kind === "personal" ? "pessoal" : "empresarial"} do usuário. Responda em português do Brasil, de forma clara, curta e prática.
Regras obrigatórias:
- Use SOMENTE os números do bloco <dados_financeiros> e do <calculo_do_sistema> quando presente. Nunca invente valores, lançamentos ou taxas.
- Se os dados não forem suficientes, diga exatamente o que falta.
- Diferencie valores registrados de estimativas; projeções consideram apenas lançamentos cadastrados.
- Ao recomendar, explique as premissas. Não dê recomendações de investimento específicas (ativos, corretoras).
- "Resultado estimado" não é lucro contábil oficial.
- Valores em reais no formato R$ 1.234,56.`;
  const messages = [
    ...history.slice(-6).map((h) => ({ role: h.role, content: h.content.slice(0, 2000) })),
    { role: "user" as const, content: `<dados_financeiros>\n${JSON.stringify(fin)}\n</dados_financeiros>${deterministic ? `\n<calculo_do_sistema>\n${deterministic}\n</calculo_do_sistema>` : ""}\n\nPergunta: ${q.data}` },
  ];
  try {
    const msg = await ai.beta.messages.create({ model: MODEL, max_tokens: 2000, ...FALLBACK, output_config: { effort: "medium" }, system, messages });
    if (msg.stop_reason === "refusal") return { answer: deterministic ?? "Não consegui responder essa pergunta.", engine: deterministic ? "local" : "none" };
    const text = textOf(msg);
    return { answer: text || deterministic || "Não consegui responder.", engine: "claude" };
  } catch (e) {
    console.error("askAssistant: falha na IA", (e as Error).name);
    return deterministic ? { answer: deterministic, engine: "local" } : { answer: "O serviço de IA está indisponível no momento. Tente novamente em instantes.", engine: "none" };
  }
}
