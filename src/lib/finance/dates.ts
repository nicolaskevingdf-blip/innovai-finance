/** Datas são manipuladas como strings ISO "YYYY-MM-DD" (sem fuso) para evitar deslocamentos. */
export type ISODate = string;

export const TZ = "America/Sao_Paulo";

export function todayISO(tz = TZ, now = new Date()): ISODate {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return p; // en-CA => YYYY-MM-DD
}

export function parts(d: ISODate) {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, d: day };
}
export function iso(y: number, m: number, d: number): ISODate {
  // normaliza mês fora do intervalo
  const yy = y + Math.floor((m - 1) / 12);
  const mm = ((((m - 1) % 12) + 12) % 12) + 1;
  return `${yy}-${String(mm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function monthStart(d: ISODate): ISODate {
  const { y, m } = parts(d);
  return iso(y, m, 1);
}
export function monthEnd(d: ISODate): ISODate {
  const { y, m } = parts(d);
  return iso(y, m, daysInMonth(y, m));
}
/** Soma meses preservando o dia quando possível (31/01 + 1 => 28/02 ou 29/02). */
export function addMonths(d: ISODate, n: number): ISODate {
  const { y, m, d: day } = parts(d);
  const target = iso(y, m + n, 1);
  const t = parts(target);
  return iso(t.y, t.m, Math.min(day, daysInMonth(t.y, t.m)));
}
export function addDays(d: ISODate, n: number): ISODate {
  const { y, m, d: day } = parts(d);
  const dt = new Date(Date.UTC(y, m - 1, day + n));
  return dt.toISOString().slice(0, 10);
}
export function diffDays(a: ISODate, b: ISODate): number {
  const pa = parts(a), pb = parts(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}
export function monthsBetween(a: ISODate, b: ISODate): number {
  const pa = parts(a), pb = parts(b);
  return (pb.y - pa.y) * 12 + (pb.m - pa.m);
}
export function weekday(d: ISODate): number {
  const { y, m, d: day } = parts(d);
  return new Date(Date.UTC(y, m - 1, day)).getUTCDay();
}
/** Início da semana (segunda-feira). */
export function weekStart(d: ISODate): ISODate {
  const wd = weekday(d);
  return addDays(d, wd === 0 ? -6 : 1 - wd);
}
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export function fmtDate(d: ISODate | null | undefined): string {
  if (!d) return "—";
  const { y, m, d: day } = parts(d);
  return `${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}
export function fmtDayMonth(d: ISODate): string {
  const { m, d: day } = parts(d);
  return `${String(day).padStart(2, "0")} ${MONTHS[m - 1]}`;
}
export function fmtMonth(d: ISODate, long = false): string {
  const { y, m } = parts(d);
  return long ? `${MONTHS_LONG[m - 1]} de ${y}` : `${MONTHS[m - 1]}/${String(y).slice(2)}`;
}
export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parts(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** Data/hora de um timestamp (timestamptz) no fuso de Brasília: "26/11/2026 21:40". */
export function fmtDateTime(ts: string | null | undefined, withTime = true): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(d).replace(",", "");
}

/** Primeira letra maiúscula ("novembro de 2026" → "Novembro de 2026"). */
export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
