import { describe, expect, it } from "vitest";
import { referencedIds, toEntry, type AuditRow } from "./history";

const base: Omit<AuditRow, "action" | "before" | "after" | "changed"> = { id: 1, entity: "transactions", entity_id: "t1", user_id: "u1", actor: "Ana", at: "2026-11-26T15:00:00Z" };
const names = new Map([["c1", "Mercado"], ["c2", "Restaurante"]]);

describe("histórico financeiro", () => {
  it("edição mostra valor e categoria antes → depois", () => {
    const e = toEntry({ ...base, action: "update", changed: ["amount", "category_id"], before: { amount: 300, category_id: "c1" }, after: { amount: 350.5, category_id: "c2" } }, names, "u2");
    expect(e.title).toBe("Alterou lançamento");
    expect(e.who).toBe("Ana");
    expect(e.changes.map((c) => [c.label, c.from, c.to].join("|").replace(/ /g, " "))).toEqual(["Valor|R$ 300,00|R$ 350,50", "Categoria|Mercado|Restaurante"]);
  });
  it("criação de estorno é identificada e oculta campos técnicos", () => {
    const e = toEntry({ ...base, action: "insert", changed: null, before: null, after: { type: "refund", amount: 50, description: "Estorno", source: "manual", created_by: "u1", notes: null } }, names, "u1");
    expect(e.title).toBe("Registrou estorno");
    expect(e.who).toBe("Você");
    expect(e.changes.map((c) => c.label)).toEqual(["Valor", "Descrição", "Tipo"]);
  });
  it("exclusão guarda o valor anterior; ação sem usuário é do sistema", () => {
    const e = toEntry({ ...base, user_id: null, actor: null, action: "delete", changed: null, before: { amount: 10, status: "paid", category_id: "zz" }, after: null }, names, "u1");
    expect(e.who).toBe("Sistema");
    expect(e.changes.find((c) => c.field === "status")?.from).toBe("Efetivado");
    expect(e.changes.find((c) => c.field === "category_id")?.from).toBe("(removido)");
  });
  it("coleta ids citados para buscar nomes", () => {
    expect(referencedIds([{ ...base, action: "update", changed: ["category_id"], before: { category_id: "c1", parent_id: "p" }, after: { category_id: "c2" } }]).sort()).toEqual(["c1", "c2"]);
  });
});
