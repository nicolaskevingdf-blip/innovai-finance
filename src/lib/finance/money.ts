/** Todos os cálculos usam centavos inteiros para evitar erros de ponto flutuante. */
export type Cents = number;

export function toCents(v: number | string | null | undefined): Cents {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export const fromCents = (c: Cents): number => Math.round(c) / 100;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatBRL(c: Cents, opts: { signed?: boolean; compact?: boolean } = {}): string {
  if (opts.compact && Math.abs(c) >= 1_000_000) {
    const v = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(c / 100);
    return opts.signed && c > 0 ? `+${v}` : v;
  }
  const s = brl.format(c / 100);
  return opts.signed && c > 0 ? `+${s}` : s;
}

/** Converte entradas como "1.234,56", "1234.56", "R$ 85" em centavos. Retorna null se inválido. */
export function parseMoneyInput(raw: string): Cents | null {
  let s = raw.replace(/[R$\s]/g, "").trim();
  if (!s) return null;
  const neg = s.startsWith("-");
  s = s.replace(/^-/, "");
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s) || /^\d+(,\d{1,2})$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)) {
    s = s.replace(/,/g, "");
  } else if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return null;
  }
  const c = Math.round(Number(s) * 100);
  return Number.isFinite(c) ? (neg ? -c : c) : null;
}
