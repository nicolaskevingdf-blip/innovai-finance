# Assinaturas e cobrança: arquitetura proposta (Asaas)

> **Status:** proposta técnica. **Nada foi integrado nem cobrado.** Para implementar, preciso de autorização
> explícita, da conta Asaas (CNPJ) e dos preços definidos. Confirme cada endpoint e evento na documentação
> oficial do Asaas no momento da implementação.

## 1. O que já existe e está pronto para evoluir

| Peça | Onde | Situação |
|---|---|---|
| Catálogo de planos com recursos e limites | tabela `plans` (`features[]`, `limits`) | ✅ em produção |
| Assinatura por ambiente | tabela `subscriptions` (`status`, `trial_ends_at`, `current_period_end`, `provider`, `provider_ref`) | ✅ em produção, todos em `beta` |
| Estados | enum `beta / trialing / active / past_due / canceled` | ✅ |
| Liberação de recursos | `hasFeature()` em `src/lib/plans.ts` | ✅ (IA, relatórios avançados etc.) |
| Limite de usuários por plano | trigger `member_limit` no banco | ✅ não contornável pelo cliente |
| Cota de IA por usuário/dia + tokens | `ai_usage`, `consume_ai_quota`, `record_ai_tokens` | ✅ |

**Decisão:** a assinatura continua **por ambiente** (o dono paga pelo ambiente). Um usuário pode ter o
ambiente pessoal gratuito e a empresa paga, sem misturar cobranças.

## 2. Por que Asaas

- Pix, boleto e cartão com **assinatura recorrente nativa** e cobrança automática.
- **Página de pagamento hospedada** (`invoiceUrl`): os dados de cartão nunca passam pelo nosso servidor, o que tira a Innovai do escopo do PCI-DSS.
- Notificações de cobrança ao cliente (e-mail/SMS/WhatsApp) e gestão de inadimplência.
- Ambiente **sandbox** separado para testar o ciclo completo sem dinheiro real.

## 3. Arquitetura

```
Usuário ── escolhe plano ──► Server Action (servidor Innovai)
                               │ 1. cria/reutiliza cliente no Asaas (CPF/CNPJ)
                               │ 2. cria assinatura (valor do plano, ciclo mensal, trial)
                               │ 3. grava provider_ref + status 'trialing' em subscriptions
                               ▼
                       Página de pagamento do Asaas (Pix / boleto / cartão)
                               │
Asaas ── webhook ──► /api/webhooks/asaas
                      │ a. valida token secreto do cabeçalho
                      │ b. grava evento em billing_events (id único → idempotente)
                      │ c. consulta a cobrança na API do Asaas (não confia só no corpo)
                      │ d. atualiza subscriptions via service role (status, período)
                      ▼
                 App lê subscriptions → hasFeature / modo somente leitura
```

### Novas tabelas (migração futura, aditiva)

- `billing_customers (user_id pk, provider_customer_id, document_type, created_at)`: um cliente Asaas por pagador.
- `billing_events (id pk = id do evento Asaas, event, payment_id, subscription_ref, payload jsonb, received_at, processed_at, error)`: **sem políticas de RLS para usuários**, escrita só pelo servidor (service role). Serve de trilha de auditoria de pagamentos e permite reprocessar.
- Colunas em `subscriptions`: `grace_until timestamptz`, `cancel_at_period_end boolean`, `price_cents int` (valor contratado, para mudanças de preço não afetarem quem já assinou).

### Estados e regras

| Evento Asaas (conferir nomes) | Efeito |
|---|---|
| Assinatura criada | `trialing` até `trial_ends_at` (sugestão: 14 dias, sem cartão) |
| `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` | `active`, `current_period_end` = próximo vencimento |
| `PAYMENT_OVERDUE` | `past_due`, `grace_until` = vencimento + 7 dias. App mostra aviso e link de pagamento |
| Após `grace_until` sem pagamento | **somente leitura**: o usuário vê e exporta tudo, mas não cria lançamentos. **Nunca apagamos dados por inadimplência** |
| `PAYMENT_REFUNDED` / chargeback | volta para `past_due` e registra em `billing_events` |
| Cancelamento pelo usuário | `cancel_at_period_end = true`; acesso pago até `current_period_end`, depois `canceled` (plano gratuito) |
| Troca de plano | upgrade imediato (proporcional no próximo ciclo); downgrade no fim do período, validando limites (usuários, contas) antes |

### Liberação e bloqueio

1. **Leitura:** sempre permitida, inclusive exportação (LGPD, portabilidade).
2. **Escrita:** `can_write(ws)` no banco passa a exigir assinatura em `beta/trialing/active/past_due dentro da carência`. Fica no RLS, então nenhuma tela ou API escapa.
3. **Recursos premium:** `hasFeature()` já existente (servidor) + limites no banco (triggers, como o de usuários).

## 4. Segurança

- `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` só no servidor (variáveis da Vercel), nunca `NEXT_PUBLIC_`.
- Webhook: token em comparação de tempo constante, corpo limitado, idempotência por id do evento, revalidação na API.
- Valor cobrado vem do plano no servidor, nunca do formulário.
- Sandbox e produção com chaves e URLs separadas (`ASAAS_ENV=sandbox|production`).

## 5. Plano de implementação (após autorização)

1. Migração aditiva (`billing_customers`, `billing_events`, colunas em `subscriptions`) + testes SQL.
2. Cliente Asaas no servidor (`src/lib/billing/asaas.ts`) com timeout e erros tipados.
3. Página **Plano e cobrança** em Configurações: plano atual, próximo vencimento, link de pagamento, trocar/cancelar.
4. Webhook + máquina de estados com testes unitários para cada evento.
5. Modo somente leitura no `can_write` + avisos na interface.
6. Ciclo completo no **sandbox** (Pix, boleto, cartão, atraso, cancelamento, troca de plano) antes de qualquer cobrança real.
7. Migração dos ambientes `beta` para `trialing`, com aviso prévio aos usuários.

## 6. Decisões que dependem de você

- Preços de cada plano e se haverá plano anual com desconto.
- Duração do teste grátis (sugestão: 14 dias, sem cartão).
- Carência de inadimplência (sugestão: 7 dias) e política de reembolso (o CDC garante arrependimento em 7 dias para compras online).
- CNPJ/conta Asaas e atualização dos Termos de Uso com as regras de cobrança e cancelamento.
