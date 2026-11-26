# Operação: monitoramento, backup, recuperação e custos

Estrutura enxuta para a fase beta: gratuita ou barata, sem servidores extras.

## 1. Monitoramento

| O que vigiar | Como | Onde já está pronto |
|---|---|---|
| App fora do ar / banco indisponível | Monitor externo (UptimeRobot ou Better Stack, plano gratuito) chamando `GET /api/health` a cada 5 min, com alerta por e-mail/Telegram | `/api/health` verifica autenticação **e** banco; responde 503 se algo falhar |
| Erros no servidor (páginas, ações, APIs) | Logs da Vercel, filtro `"event":"server.error"` | `src/instrumentation.ts` (`onRequestError`) |
| Erros no navegador | Logs da Vercel, filtro `"event":"client.error"` | telas de erro chamam `/api/client-error`; a tela mostra um código para o suporte |
| Falhas da IA | filtro `"event":"ai.failure"` (tipo e status HTTP do erro) | `src/lib/ai/claude.ts` |
| Consumo da IA | `"event":"ai.call"` (tokens, tempo) + tabela `ai_usage` | consulta abaixo |
| Erros de autenticação | Supabase → Logs → Auth | nativo |
| Saúde do banco e segurança | Supabase → Advisors (security/performance) | nativo |
| Pagamentos (futuro) | tabela `billing_events` com `error` preenchido | ver `docs/ASSINATURAS.md` |

Os logs **não contêm** valores, e-mails, nomes, perguntas ou respostas: apenas códigos e contagens (`src/lib/log.ts`).

**Limitação:** a retenção de logs no plano gratuito da Vercel é curta. Quando houver usuários reais,
recomendo um drain de logs (ex.: Better Stack, Axiom) ou o Sentry gratuito para erros (P2).

### Custo da IA por dia (SQL no Supabase)

```sql
-- Opus 5.5: US$ 4 por milhão de tokens de entrada, US$ 20 por milhão de saída (conferir tabela vigente)
select day, count(*) usuarios, sum(requests) chamadas, sum(input_tokens) entrada, sum(output_tokens) saida,
       round((sum(input_tokens) * 4 + sum(output_tokens) * 20) / 1e6, 2) as custo_usd
from ai_usage group by day order by day desc limit 30;
```

## 2. Modelo de uso da IA (custo previsível)

1. **Cálculo primeiro:** perguntas que o sistema sabe calcular (saldo, gastos por categoria, contas, fluxo, metas)
   são respondidas pelo motor determinístico, **sem custo e sem gastar cota**.
2. **Lançamento por texto:** o interpretador local resolve a maioria das frases; a IA só é chamada quando ele
   não tem confiança, e o resultado é sempre uma **sugestão para o usuário confirmar**.
3. **Cota diária por usuário:** `AI_DAILY_LIMIT` (padrão 30), aplicada no banco. Excedeu → respostas calculadas continuam funcionando.
4. **Limites técnicos:** timeout de 25 s, 1 nova tentativa, `max_tokens` 1024/2000, histórico de 6 mensagens.
5. **Ordem de grandeza (estimativa, conferir com `ai_usage`):** interpretação ≈ US$ 0,005; pergunta aberta ≈ US$ 0,02–0,04.
   Pior caso de um usuário que esgota a cota todo dia: ≈ US$ 1/dia. Uso típico esperado: bem menor.
6. **Proteção extra (recomendado):** defina um limite de gasto mensal no Console da Anthropic.
7. **Privacidade:** a IA recebe apenas um resumo financeiro calculado do ambiente ativo (totais, categorias, contas),
   nunca dados de outros ambientes. Nenhum conteúdo de conversa é armazenado.

## 3. Backup e recuperação

| Camada | Situação atual | Recomendação |
|---|---|---|
| Banco (Supabase) | Plano gratuito: sem backup restaurável pelo painel; projeto pode ser **pausado por inatividade** | **Supabase Pro antes do beta com dados reais** (backups diários automáticos; PITR opcional) |
| Exportação pelo usuário | ✅ CSV de movimentações e exportação completa da conta (LGPD) | — |
| Código | ✅ GitHub + branch `backup/pre-auditoria` | — |
| Deploy | ✅ Vercel mantém deploys anteriores: **rollback instantâneo** pelo painel | — |
| Migrações | ✅ todas aditivas, com rollback documentado em cada arquivo | — |
| Backup lógico extra (P2) | — | `pg_dump` semanal via GitHub Actions para armazenamento criptografado (precisa da senha do banco como segredo) |

### Roteiro de recuperação

1. **Deploy quebrado:** Vercel → Deployments → deploy anterior → *Instant Rollback*.
2. **Migração com problema:** aplicar o bloco "Rollback" do arquivo da migração (todas são aditivas, então dados não se perdem).
3. **Dados apagados por engano:** o histórico (`audit_log`) guarda o valor anterior de lançamentos, contas e cartões, o que permite reconstruir registros. Perda ampla → restaurar backup (requer plano Pro).
4. **Banco indisponível:** `/api/health` dispara o alerta; acompanhar status.supabase.com; o app mostra tela de erro amigável.

## 4. Configurações externas pendentes

| Onde | O quê | Prioridade |
|---|---|---|
| Supabase → Auth → Providers → Email | Confirmação de e-mail **ligada**; "Secure email change" ligado | P0 (verificar) |
| Supabase → Auth → SMTP | SMTP próprio (Resend, Brevo…) com domínio verificado; o envio padrão é limitado a poucos e-mails/hora | **P0** |
| Supabase → Auth → URL Configuration | Site URL e redirects do domínio final | P0 (verificar) |
| Supabase → Auth → Attack Protection | **Proteção contra senhas vazadas** (hoje **desligada**, confirmado pelo Advisor; requer plano Pro) e CAPTCHA (Turnstile) | P1 |
| Supabase → plano | **Pro** (backups, sem pausa por inatividade) | **P0 para dados reais** |
| Vercel → plano | **Pro**: o plano Hobby é só para uso não comercial; obrigatório antes de cobrar | P1 |
| Vercel → env | `ANTHROPIC_API_KEY` (IA), `AI_DAILY_LIMIT` (opcional) | P1 |
| Monitor externo | UptimeRobot/Better Stack em `/api/health` | P0 |
| Domínio próprio | ex.: `app.innovai.com.br` + e-mails do mesmo domínio | P1 |
