# Innovai Finance

Plataforma de gestão financeira inteligente com dois segmentos no mesmo ecossistema:
**Finanças Pessoais** (pessoas, casais, famílias) e **Finanças Empresariais** (MEI, restaurantes,
barbearias, lojas, prestadores de serviço). Ambientes isolados, identidade visual Innovai
(preto, verde‑lima, branco, cinza), mobile‑first e instalável como PWA.

> Princípio central: **cálculos financeiros são determinísticos e testados**. A IA interpreta,
> explica e sugere — nunca substitui a regra financeira nem grava dados sem confirmação.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend / servidor | Next.js 15 (App Router, Server Components, Server Actions), React 19, TypeScript |
| UI | Tailwind CSS v4 (tokens da marca), lucide-react, Recharts |
| Banco / Auth / Arquivos | Supabase (Postgres 17 + RLS, Auth, Storage privado) |
| Validação | Zod em todas as ações do servidor |
| IA (opcional) | Anthropic Claude (`claude-opus-5-5`) com fallback no servidor; motor local determinístico quando não configurada |
| Testes | Vitest (motor financeiro e assistente), testes SQL de RLS, Playwright (E2E manual) |

## Arquitetura

```
src/
├─ lib/finance/        ← MOTOR FINANCEIRO (puro, sem I/O, 100% testável)
│   ├─ money.ts           centavos inteiros, parsing pt-BR
│   ├─ dates.ts           datas ISO sem fuso (America/Sao_Paulo)
│   ├─ ledger.ts          saldos, resumo por competência, grupos gerenciais, caixa realizado
│   ├─ cards.ts           faturas, fechamento/vencimento, parcelas, limite
│   ├─ obligations.ts     contas a pagar/receber, status, pagamento parcial
│   ├─ cashflow.ts        previsão a partir de dados cadastrados + projeção diária/semanal/mensal
│   ├─ planning.ts        orçamento e alertas, metas, dívidas (avalanche/bola de neve, Price)
│   ├─ snapshot.ts        indicadores do dashboard pessoal e empresarial
│   ├─ insights.ts        motor de insights por regras (Inteligência Innovai)
│   ├─ summary.ts         resumos semanais/mensais em linguagem natural
│   └─ parser.ts          interpretação de texto ("gastei 85 reais de gasolina hoje")
├─ lib/ai/             ← camada de IA (contexto agregado, intents determinísticas, cliente Claude)
├─ lib/data/           ← acesso a dados (sempre com a sessão do usuário → RLS)
├─ app/actions/        ← Server Actions validadas (auth, ambientes, finanças, IA, conta/LGPD)
├─ app/w/[ws]/…        ← páginas por ambiente (cada ambiente tem sua própria URL)
└─ components/         ← design system (ui.tsx, client.tsx, formulários, gráficos, navegação)
supabase/
├─ migrations/         ← esquema, RLS, triggers de integridade, view de saldos, RPCs, storage
└─ tests/              ← testes SQL de isolamento multi‑tenant e regras de saldo
```

### Regras financeiras (resumo)

- **Transferência** move valor entre contas e nunca é receita nem despesa.
- **Compra no cartão** é despesa na competência da fatura e **não** altera saldo bancário.
  O **pagamento da fatura** (`card_payment`) sai da conta e quita o cartão, mas **não** é
  despesa → sem duplicidade.
- **Parcelamento**: o total é dividido em N parcelas (centavos de diferença na 1ª), cada uma
  na fatura correspondente; o limite comprometido considera parcelas futuras.
- **Ajuste de saldo** é registrado como movimentação própria (auditável), fora dos relatórios.
- **Pagamento parcial** divide o lançamento: a parte paga vira um lançamento vinculado e o
  restante continua em aberto (marcado como “parcialmente paga”).
- **Indicadores pessoais**: saldo bancário ≠ saldo total ≠ comprometido ≠ saldo previsto ≠
  saldo disponível estimado — cada um com explicação na interface.
- **Indicadores empresariais**: faturamento (competência) ≠ recebido (caixa); custos, despesas,
  investimentos e retiradas separados; “resultado estimado” nunca é apresentado como lucro contábil.
- **Projeções** usam apenas saldos atuais, contas cadastradas e faturas; itens vencidos entram “hoje”.
- Os saldos vêm da view SQL `account_balances` (histórico completo, `security_invoker`), espelhada
  pela função `balanceEffect` em TypeScript (testada).

### Multi‑tenant e segurança

- Toda tabela de dados tem `workspace_id` e **RLS habilitado** (25/25 tabelas).
- Perfis por ambiente: proprietário, administrador, gerente, financeiro, funcionário, visualizador.
  Funcionário só registra receitas/despesas, edita o que criou e fecha o caixa.
- Triggers impedem referências cruzadas entre ambientes (conta/categoria/cartão de outro ambiente).
- Documentos em bucket privado `documents/{workspace_id}/…`, acesso por URL assinada de 60s.
- Auditoria (`audit_log`) registra quem criou/alterou/excluiu — **sem valores financeiros**.
- O app nunca usa a chave de serviço, exceto na exclusão definitiva de conta (LGPD).
- Cabeçalhos de segurança no middleware; exportação CSV protegida contra injeção de fórmulas.
- A IA recebe somente agregados do **ambiente ativo** e respeita o plano/permissões.

Verificado (local): leitura, escrita, auto‑inclusão como membro, alteração de ambiente,
listagem de membros e upload/listagem de arquivos de outro ambiente → **todos bloqueados**.

### SaaS / planos

Tabelas `plans` e `subscriptions` com recursos por plano (`hasFeature`). Todos os ambientes
nascem em status **beta** (acesso completo, sem cobrança). Planos previstos: Pessoal Gratuito /
Premium; Empresas Inicial / Profissional / Avançado. **Nenhum preço foi definido** — depende de
validação comercial. Gateway de pagamento: estrutura pronta (`provider`, `provider_ref`), integração pendente.

---

## Executar localmente

Pré‑requisitos: Node 20+, Docker.

```bash
npm install
npx supabase start            # sobe Postgres, Auth, Storage locais e aplica as migrações
cp .env.example .env.local    # preencha com a URL e a publishable key exibidas pelo comando acima
npm run dev                   # http://localhost:3000
```

```bash
npm test                      # motor financeiro, assistente e histórico (43 testes)
npm run typecheck && npm run lint
npm run test:db               # regras, segurança e histórico no banco local (23 verificações)
npm run build && npm start &  # depois:
npm run test:e2e              # 14 cenários ponta a ponta no navegador
```

Teste de RLS em SQL puro (sem Docker, qualquer Postgres 15+):

```bash
psql -d banco_vazio -f supabase/tests/auth_shim.sql -f supabase/migrations/20261126000001_foundation.sql
psql -d banco_vazio -f supabase/tests/rls_test.sql
```

## Produção

- App: https://innovai-finance.vercel.app (Vercel, funções em `gru1` — São Paulo)
- Banco: Supabase `innovai-finance` (`iuxqxkyjbrekxhrodybv`, `sa-east-1`), migrações 0001–0008 aplicadas
- Saúde: `GET /api/health`
- Auditoria técnica: veja [AUDITORIA.md](AUDITORIA.md)
- Operação (monitoramento, backup, custos da IA): [docs/OPERACAO.md](docs/OPERACAO.md)
- Assinaturas (proposta Asaas): [docs/ASSINATURAS.md](docs/ASSINATURAS.md)
- Beta: checklists e critérios em [docs/LANCAMENTO-BETA.md](docs/LANCAMENTO-BETA.md)
- Deploy automático a cada push na `main`

## Publicar (do zero)

1. Crie um projeto Supabase (região `sa-east-1` recomendada para LGPD/latência).
2. `npx supabase link --project-ref <ref>` e `npx supabase db push` para aplicar as migrações.
3. Em Auth → URL Configuration, configure o domínio e `/auth/callback` como redirect.
4. Configure SMTP próprio no Supabase Auth (o envio padrão tem limite baixo).
5. Publique o Next.js (ex.: Vercel) com as variáveis do `.env.example`.

---

## Status por fase

| Fase | Situação |
|---|---|
| 1 — Fundação | ✅ Login, cadastro, recuperação de senha, onboarding progressivo, ambientes, RLS, navegação adaptativa (sidebar/bottom bar), PWA |
| 2 — Pessoal | ✅ Dashboard, movimentações (filtros, busca, edição, exclusão por parcela/recorrência), categorias/subcategorias, contas e ajustes, transferências, cartões (faturas, parcelas, pagamento), recorrências, planejamento com alertas, metas, dívidas, patrimônio, relatórios, compartilhamento por ambiente + convites |
| 3 — Empresas | ✅ Dashboard, receitas/vendas, contas a pagar/receber com pagamento parcial, clientes/fornecedores, fluxo de caixa (7–90 dias e personalizado), vendas do dia por forma de pagamento, fechamento de caixa, retiradas/limites, resultado gerencial, documentos, usuários e permissões |
| 4 — Inteligência | ✅ Lançamento por texto e voz (com confirmação), insights por regras, resumos, assistente com respostas calculadas · ⏳ IA generativa requer `ANTHROPIC_API_KEY` |
| 5–7 | Validação com usuários, comercialização e integrações — **não iniciadas** |

### Pendências conhecidas (não simuladas)

- **IA generativa**: sem `ANTHROPIC_API_KEY`, o assistente responde às perguntas frequentes com o
  motor local e informa isso na tela. Com a chave, perguntas abertas usam Claude com os dados agregados.
- **Extração de dados de documentos** (OCR/IA) e **importação OFX/CSV**: não implementadas.
- **E-mail transacional** (convites, resumos por e-mail): convites geram link para compartilhar.
- **Notificações push**: alertas aparecem na Inteligência e no dashboard; push depende de provedor.
- **Exportação**: Excel via CSV (UTF‑8 com BOM, separador `;`) e PDF via impressão do navegador.
- **Limites legais do MEI**: não implementados — exigem fonte oficial atualizada.
- **Open Finance, PDV, maquininhas, delivery, WhatsApp**: arquitetura preparada, sem integração.
- **Políticas de privacidade e termos**: rascunhos técnicos, exigem revisão jurídica.
