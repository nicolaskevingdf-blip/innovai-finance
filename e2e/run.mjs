/**
 * Testes de ponta a ponta da Innovai Finance (Playwright).
 * Pré-requisitos: Supabase local (`npx supabase start`) e o app rodando (`npm run build && npm start`).
 * Uso: BASE_URL=http://127.0.0.1:3000 npm run test:e2e
 * Cria usuários de teste próprios a cada execução; não toca em dados existentes.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const results = [];
const step = async (name, fn) => {
  try { await fn(); results.push([name, true]); console.log("  ✓", name); }
  catch (e) {
    results.push([name, false]); console.log("  ✗", name, "—", String(e.message ?? e).split("\n")[0]);
    await p?.screenshot({ path: `e2e/falha-${results.length}.png` }).catch(() => {});
  }
};
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const text = async (sel) => (await p.textContent(sel)).replace(/\u00a0/g, " "); // Intl usa espaço não separável em "R$ 1,00"

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const email = `e2e${Date.now()}@teste.dev`, password = "senha12345";
const dialog = "dialog[open]";
const openSheet = async (name) => { await p.getByRole("button", { name }).first().click(); await p.waitForSelector(dialog); };
let wsP, wsB;

console.log("Fluxo pessoal");
await step("cadastro e onboarding pessoal", async () => {
  await p.goto(BASE + "/cadastro");
  await p.fill("input[name=name]", "Teste E2E"); await p.fill("input[name=email]", email); await p.fill("input[name=password]", password);
  await p.check("input[name=terms]"); await p.click("button[type=submit]");
  await p.waitForURL(/onboarding/, { timeout: 30000 });
  await p.getByRole("button", { name: /^Finanças pessoais/ }).click();
  await p.getByRole("button", { name: "Continuar" }).click();
  await p.getByRole("button", { name: "Continuar" }).click();
  await p.fill("input[name=account_name]", "Banco"); await p.fill("input[name=account_balance]", "1.000,00");
  await p.click("summary");
  await p.fill("input[name=card_name]", "Visa"); await p.fill("input[name=card_limit]", "5000"); await p.fill("input[name=card_closing]", "5"); await p.fill("input[name=card_due]", "12");
  await p.getByRole("button", { name: "Começar a usar" }).click();
  await p.waitForURL(/\/w\/[0-9a-f-]{36}$/, { timeout: 30000 });
  wsP = p.url();
});
await step("primeiros passos guiam o novo usuário", async () => {
  await p.waitForSelector("text=Primeiros passos");
  const body = await text("main");
  expect(body.includes("Registre seu primeiro lançamento"), "guia deveria pedir o primeiro lançamento");
});
await step("lançamento por texto (interpretação + confirmação)", async () => {
  await openSheet("Novo lançamento");
  await p.fill(`${dialog} input[placeholder^="Ex.: gastei"]`, "Gastei 85 reais abastecendo minha moto hoje");
  await p.click(`${dialog} button[aria-label=Interpretar]`);
  await p.waitForSelector(`${dialog} >> text=confira antes de salvar`);
  expect((await p.inputValue(`${dialog} input[name=amount]`)) === "85,00", "valor interpretado incorreto");
  await p.click(`${dialog} button:has-text("Salvar lançamento")`);
  await p.waitForSelector(`${dialog} >> text=Lançamento registrado`);
  await p.keyboard.press("Escape");
});
await step("compra parcelada no cartão gera 3 parcelas", async () => {
  await openSheet("Novo lançamento");
  await p.fill(`${dialog} input[name=amount]`, "300"); await p.fill(`${dialog} input[name=description]`, "Fone");
  await p.selectOption(`${dialog} label:has-text("Pago com") select`, { label: "Visa" });
  await p.click(`${dialog} >> text=+ Parcelas`); await p.selectOption(`${dialog} select[name=installments]`, "3");
  await p.click(`${dialog} button:has-text("Salvar lançamento")`);
  await p.waitForSelector(`${dialog} >> text=3 lançamentos registrados`);
  await p.keyboard.press("Escape");
});
await step("estorno parcial no cartão vira crédito na fatura", async () => {
  await p.goto(wsP + "/movimentacoes?tipo=expense&cartao=");
  await p.getByText("Fone (1/3)", { exact: true }).first().click(); await p.waitForSelector(dialog);
  await p.click(`${dialog} button.chip:has-text("Estornar")`);
  await p.fill(`${dialog} input[name=amount]`, "40");
  await p.click(`${dialog} button:has-text("Registrar estorno")`);
  await p.waitForSelector(`${dialog} >> text=crédito na fatura`, { timeout: 15000 });
});
await step("estorno acima do valor é recusado pelo servidor", async () => {
  await p.goto(wsP + "/movimentacoes");
  await p.getByText("Fone (1/3)", { exact: true }).first().click(); await p.waitForSelector(dialog);
  await p.click(`${dialog} button.chip:has-text("Estornar")`);
  await p.fill(`${dialog} input[name=amount]`, "100");
  await p.click(`${dialog} button:has-text("Registrar estorno")`);
  await p.waitForSelector(`${dialog} >> text=não pode ultrapassar`, { timeout: 15000 });
  await p.keyboard.press("Escape");
});
await step("saldos e fatura refletem o estorno (dashboard e cartões)", async () => {
  await p.goto(wsP + "/cartoes"); await p.waitForSelector("text=Comprometido"); // aguarda o conteúdo (a página é transmitida após o esqueleto)
  const body = await text("main");
  expect(body.includes("R$ 60,00"), "fatura deveria ser R$ 60,00 (100 − 40)");
  expect(body.includes("R$ 260,00"), "limite comprometido deveria ser R$ 260,00 (300 − 40)");
  await p.goto(wsP); await p.waitForSelector("text=Saldo disponível estimado");
  expect((await text("main")).includes("R$ 915,00"), "saldo deveria ser R$ 915,00 (1000 − 85)");
});

console.log("Histórico financeiro");
await step("edição aparece no histórico com antes → depois e autor", async () => {
  await p.goto(wsP + "/movimentacoes");
  await p.getByText("Fone (1/3)", { exact: true }).first().click(); await p.waitForSelector(dialog);
  await p.click(`${dialog} button.chip:has-text("Editar")`);
  await p.fill(`${dialog} textarea[name=notes]`, "nota e2e");
  await p.click(`${dialog} button:has-text("Salvar alterações")`);
  await p.waitForTimeout(1500);
  if (!(await p.$(dialog))) { await p.getByText("Fone (1/3)", { exact: true }).first().click(); await p.waitForSelector(dialog); }
  await p.click(`${dialog} button.chip:has-text("Histórico")`);
  await p.waitForSelector(`${dialog} >> text=Alterou lançamento`, { timeout: 15000 });
  const h = await text(dialog);
  expect(h.includes("nota e2e") && h.includes("Observações") && h.includes("por Você"), "histórico sem campo/valor/autor");
  expect(h.includes("Criou lançamento"), "histórico sem a criação");
  await p.keyboard.press("Escape");
});
await step("página de histórico lista edições e estornos", async () => {
  await p.goto(wsP + "/historico"); await p.waitForSelector("text=Histórico de alterações");
  const body = await text("main");
  expect(body.includes("Registrou estorno") && body.includes("Alterou lançamento"), "histórico do ambiente incompleto");
});
await step("saúde do app inclui o banco", async () => {
  const r = await fetch(BASE + "/api/health"); const j = await r.json();
  expect(r.status === 200 && j.auth === "ok" && j.banco === "ok", "health: " + JSON.stringify(j));
  const c = await fetch(BASE + "/api/client-error", { method: "POST", body: JSON.stringify({ name: "Teste", path: "/x" }) });
  expect(c.status === 204, "registro de erro do cliente deveria aceitar");
});

console.log("Fluxo empresarial");
await step("onboarding empresa + vendas do dia + conta parcial + fechamento", async () => {
  await p.goto(BASE + "/onboarding?tipo=empresa");
  await p.fill("input[name=name]", "Loja E2E"); await p.selectOption("select[name=segment]", "store");
  await p.getByRole("button", { name: "Continuar" }).click(); await p.getByRole("button", { name: "Continuar" }).click();
  await p.fill("input[name=account_name]", "Conta PJ"); await p.fill("input[name=account_balance]", "5000");
  await p.getByRole("button", { name: "Começar a usar" }).click();
  await p.waitForURL(/\/w\/[0-9a-f-]{36}$/); wsB = p.url();
  await p.goto(wsB + "/caixa"); await openSheet("Registrar vendas do dia");
  await p.fill(`${dialog} input[name=m_cash]`, "300"); await p.fill(`${dialog} input[name=m_credit]`, "200");
  await p.click(`${dialog} button:has-text("Registrar faturamento")`);
  await p.waitForSelector(`${dialog} >> text=Faturamento do dia registrado`); await p.keyboard.press("Escape");
  await p.goto(wsB + "/caixa"); await openSheet("Fechar caixa do dia");
  await p.fill(`${dialog} input[name=counted_amount]`, "300");
  await p.click(`${dialog} button:has-text("Fechar caixa")`);
  await p.waitForSelector("text=Caixa fechado", { timeout: 15000 });
});

console.log("Segurança (API real, outro usuário)");
await step("outro usuário não acessa dados de nenhum ambiente alheio", async () => {
  const wsId = wsP.split("/w/")[1];
  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  await sb.auth.signUp({ email: `intruso${Date.now()}@teste.dev`, password });
  const reads = await Promise.all(["transactions", "financial_accounts", "credit_cards", "attachments", "cash_closings"].map((t) => sb.from(t).select("id").eq("workspace_id", wsId)));
  expect(reads.every((r) => (r.data ?? []).length === 0), "leitura indevida");
  const ins = await sb.from("transactions").insert({ workspace_id: wsId, type: "income", amount: 1, description: "x", date: "2026-01-01", competence_date: "2026-01-01", paid_at: "2026-01-01" });
  expect(ins.error, "inserção indevida");
  const up = await sb.storage.from("documents").upload(`${wsId}/x.pdf`, new Blob(["%PDF-1.4"], { type: "application/pdf" }));
  expect(up.error, "upload indevido");
});

console.log("Responsividade (320–430px)");
await step("sem rolagem horizontal e sem valores cortados", async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await ctx.storageState() });
  const mp = await m.newPage();
  const paths = ["", "/movimentacoes", "/planejamento", "/metas", "/inteligencia", "/cartoes", "/relatorios", "/configuracoes", "/historico"];
  const bad = [];
  for (const w of [320, 360, 375, 390, 414, 430]) {
    await mp.setViewportSize({ width: w, height: 800 });
    for (const base of [wsP, wsB]) for (const path of paths) {
      await mp.goto(base + path, { waitUntil: "networkidle" });
      const r = await mp.evaluate(() => ({
        over: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        cut: [...document.querySelectorAll(".num")].filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1).length,
      }));
      if (r.over || r.cut) bad.push(`${w}px ${path || "/"}`);
    }
  }
  await m.close();
  expect(!bad.length, "problemas em: " + bad.join(", "));
});

await step("nenhum erro de JavaScript nas páginas", async () => expect(!errors.length, errors.slice(0, 3).join(" | ")));
await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} cenários passaram`);
process.exit(failed ? 1 : 0);
