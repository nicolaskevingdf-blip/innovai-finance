import { NextResponse, type NextRequest } from "next/server";
import { queryTransactions } from "@/lib/data/tx-query";
import { createClient } from "@/lib/supabase/server";

const TYPE: Record<string, string> = { income: "Receita", expense: "Despesa", transfer: "Transferência", adjustment: "Ajuste", card_payment: "Pagamento de fatura", refund: "Estorno" };
const STATUS: Record<string, string> = { paid: "Efetivado", pending: "Pendente", canceled: "Cancelado" };
const cell = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[;"\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };

/** CSV com separador ";" e BOM UTF-8 — abre corretamente no Excel em português. */
export async function GET(req: NextRequest) {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  if (!/^[0-9a-f-]{36}$/.test(sp.ws ?? "")) return NextResponse.json({ error: "Ambiente inválido" }, { status: 400 });
  const sb = await createClient();
  const { data: ws } = await sb.from("workspaces").select("name").eq("id", sp.ws).maybeSingle();
  if (!ws) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  const { rows } = await queryTransactions(sp.ws, sp, 20000);
  const head = ["Data", "Vencimento", "Pagamento", "Descrição", "Tipo", "Situação", "Categoria", "Conta", "Conta destino", "Cartão", "Fatura", "Parcela", "Contato", "Forma de pagamento", "Valor", "Tags", "Observações"];
  const lines = rows.map((r) => [r.date, r.dueDate, r.paidAt, r.description, TYPE[r.type], STATUS[r.status], r.category, r.account, r.toAccount, r.card, r.invoiceMonth?.slice(0, 7), r.installment, r.contact, r.paymentMethod,
    ((r.type === "expense" || r.type === "card_payment" ? -1 : 1) * r.amount / 100).toFixed(2).replace(".", ","), r.tags.join(", "), r.notes].map(cell).join(";"));
  const csv = "﻿" + [head.join(";"), ...lines].join("\r\n");
  const name = `innovai-${ws.name.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase()}-movimentacoes.csv`;
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}
