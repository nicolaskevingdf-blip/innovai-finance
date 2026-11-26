import { addDays, iso, parts, type ISODate } from "./dates";
import type { PaymentMethod } from "./types";

export interface ParsedEntry {
  type: "income" | "expense" | null;
  amount: number | null; // centavos
  date: ISODate;
  description: string;
  categoryHint: string | null; // nome de categoria sugerido
  paymentMethod: PaymentMethod | null;
  installments: number | null;
  confidence: "high" | "medium" | "low";
  missing: ("amount" | "type")[];
}

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Palavras-chave → categoria padrão (pessoal e empresarial). Ordem importa: mais específicas primeiro. */
const CATEGORY_KEYWORDS: [RegExp, string][] = [
  [/\b(abastec|gasolina|etanol|alcool|diesel|combustivel|posto)/, "Combustível"],
  [/\b(uber|99|taxi|onibus|metro|passagem|estacionamento|pedagio)/, "Transporte"],
  [/\b(oficina|mecanic|pneu|revisao|ipva|licenciamento|seguro do carro|moto|carro)/, "Veículos"],
  [/\b(mercado|supermercado|feira|acougue|padaria|hortifruti)/, "Alimentação"],
  [/\b(ifood|restaurante|lanche|almoco|jantar|pizza|hamburguer|cafe|bar\b)/, "Alimentação"],
  [/\b(aluguel|condominio|iptu)/, "Moradia"],
  [/\b(luz|energia|agua|internet|telefone|celular|gas\b)/, "Contas"],
  [/\b(farmacia|remedio|medic|consulta|dentista|exame|plano de saude|academia)/, "Saúde"],
  [/\b(netflix|spotify|assinatura|prime|disney|youtube|icloud)/, "Assinaturas"],
  [/\b(curso|faculdade|escola|livro|mensalidade)/, "Educação"],
  [/\b(cinema|show|viagem|hotel|passeio|lazer|ingresso)/, "Lazer"],
  [/\b(roupa|tenis|sapato|loja|shopping|presente|compra)/, "Compras"],
  [/\b(investi|aplic|tesouro|cdb|acoes)/, "Investimentos"],
  [/\b(fornecedor|mercadoria|estoque|insumo|materia.prima|ingrediente)/, "Mercadorias"],
  [/\b(embalag)/, "Embalagens"],
  [/\b(salario|folha|funcionari)/, "Salários"],
  [/\b(pro.labore|retirada)/, "Retirada do proprietário"],
  [/\b(taxa|maquininha|tarifa)/, "Taxas"],
  [/\b(marketing|anuncio|impulsion|ads\b)/, "Marketing"],
];

const INCOME_VERBS = /\b(recebi|ganhei|vendi|entrou|entrada|faturei|faturamento|caiu|deposit|pix recebido|salario recebido|reembolso)/;
const EXPENSE_VERBS = /\b(gastei|paguei|comprei|pago|gasto|saida|despesa|abasteci|abastecendo|abastecer|debitou|transferi para|conta de)/;

const NUM_WORDS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, doze: 12 };

function parseAmount(t: string): number | null {
  // "1.234,56" | "85,90" | "85.90" | "85" | "1,2 mil" | "2 mil"
  const mil = t.match(/(\d+(?:[.,]\d+)?)\s*mil\b/);
  if (mil) return Math.round(Number(mil[1].replace(",", ".")) * 1000 * 100);
  const m = t.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+,\d{1,2}|\d+\.\d{1,2}(?!\d)|\d+)(?:\s*(?:reais|real|r\$|conto|pila))?/g);
  if (!m) return null;
  // prioriza número próximo de "reais"/"r$"
  const withCurrency = t.match(/(?:r\$\s*)(\d[\d.,]*)|(\d[\d.,]*)\s*(?:reais|real|conto|pila)/);
  const raw = withCurrency ? (withCurrency[1] ?? withCurrency[2]) : m.map((x) => x.replace(/[^\d.,]/g, "")).find((x) => !/^\d{1,2}$/.test(x) || m.length === 1) ?? m[0];
  let s = raw.replace(/[^\d.,]/g, "");
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const v = Number(s);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null;
}

function parseDate(t: string, today: ISODate): ISODate {
  if (/\banteontem\b/.test(t)) return addDays(today, -2);
  if (/\bontem\b/.test(t)) return addDays(today, -1);
  if (/\bamanha\b/.test(t)) return addDays(today, 1);
  const dm = t.match(/\b(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  const { y, m } = parts(today);
  if (dm) {
    const yy = dm[3] ? (dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3])) : y;
    const d = iso(yy, Number(dm[2]), Number(dm[1]));
    return d;
  }
  const dia = t.match(/\bdia\s+(\d{1,2})\b/);
  if (dia) {
    const n = Number(dia[1]);
    if (n >= 1 && n <= 31) {
      const cand = iso(y, m, n);
      return cand > today ? iso(y, m - 1, n) : cand; // "dia 28" no dia 5 => mês anterior
    }
  }
  return today;
}

function parseMethod(t: string): PaymentMethod | null {
  if (/\bpix\b/.test(t)) return "pix";
  if (/\b(no|cartao de)\s*credito\b|\bcredito\b/.test(t)) return "credit";
  if (/\bdebito\b/.test(t)) return "debit";
  if (/\bdinheiro|especie\b/.test(t)) return "cash";
  if (/\bboleto\b/.test(t)) return "boleto";
  if (/\bifood|rappi|app\b/.test(t) && /\b(vend|recebi)/.test(t)) return "app";
  return null;
}

function parseInstallments(t: string): number | null {
  const m = t.match(/\b(?:em\s+)?(\d{1,2}|[a-z]+)\s*(?:x|vezes|parcelas)\b/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM_WORDS[m[1]];
  return n && n >= 2 && n <= 72 ? n : null;
}

function buildDescription(original: string, category: string | null): string {
  let d = original
    .replace(/\b(?:no\s+|em\s+)?dia\s+\d{1,2}(?:\/\d{1,2}(?:\/\d{2,4})?)?\b/gi, " ")
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ")
    .replace(/(?:r\$\s*)?\d[\d.,]*\s*(?:mil\b)?\s*(?:reais|real|conto|pila)?/gi, " ")
    .replace(/\b(hoje|ontem|anteontem|amanhã|amanha)\b/gi, " ")
    .replace(/\b(gastei|paguei|comprei|recebi|ganhei|vendi|entrou|faturei)\b/gi, " ")
    .replace(/\b(no|na|com|de|do|da|em|um|uma|o|a|os|as|meu|minha|para|pra|pro|no pix|via)\b/gi, " ")
    .replace(/\b\d{1,2}\s*(x|vezes|parcelas)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/abastec/i.test(original)) {
    const veh = original.match(/\b(moto|carro|caminhonete|van)\b/i);
    d = `Abastecimento${veh ? ` da ${veh[1].toLowerCase()}` : ""}`;
  }
  if (!d) d = category ?? "Lançamento";
  return d.charAt(0).toUpperCase() + d.slice(1, 140);
}

export function parseEntryText(text: string, today: ISODate): ParsedEntry {
  const t = strip(text);
  const forAmount = t
    .replace(/\b(?:dia\s+)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, " ")
    .replace(/\bdia\s+\d{1,2}\b/g, " ")
    .replace(/\b\d{1,2}\s*(?:x|vezes|parcelas)\b/g, " ");
  const amount = parseAmount(forAmount);
  let type: ParsedEntry["type"] = null;
  if (INCOME_VERBS.test(t)) type = "income";
  else if (EXPENSE_VERBS.test(t)) type = "expense";
  let categoryHint: string | null = null;
  for (const [re, name] of CATEGORY_KEYWORDS) if (re.test(t)) { categoryHint = name; break; }
  if (!type && categoryHint) type = "expense";
  if (type === "income") categoryHint = /\bsalario\b/.test(t) ? "Salário" : /\bvend|faturei|faturamento/.test(t) ? "Vendas" : /\bservic/.test(t) ? "Serviços" : categoryHint && /Invest/.test(categoryHint) ? categoryHint : null;
  const missing: ParsedEntry["missing"] = [];
  if (amount === null) missing.push("amount");
  if (type === null) missing.push("type");
  const confidence = missing.length ? "low" : categoryHint ? "high" : "medium";
  return { type, amount, date: parseDate(t, today), description: buildDescription(text, categoryHint), categoryHint, paymentMethod: parseMethod(t), installments: parseInstallments(t), confidence, missing };
}

/** Associa a sugestão a uma categoria existente do ambiente (comparação sem acentos). */
export function matchCategory<T extends { id: string; name: string; kind: string }>(hint: string | null, kind: "income" | "expense" | null, categories: T[]): T | null {
  if (!hint) return null;
  const h = strip(hint);
  const pool = categories.filter((c) => !kind || c.kind === kind);
  return pool.find((c) => strip(c.name) === h) ?? pool.find((c) => strip(c.name).includes(h) || h.includes(strip(c.name))) ?? null;
}
