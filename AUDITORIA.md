# Auditoria técnica — Innovai Finance (26/11/2026)

Ponto de proteção antes das mudanças: branch `backup/pre-auditoria` (commit `a365e10`).

## Prioridades

| Nível | Achado | Situação |
|---|---|---|
| P0 | Formulários sem `method` viravam GET quando o JavaScript falhava: senha ia para a URL (login/cadastro) | Corrigido (`method="post"` em todos os formulários de ação) |
| P0 | Botão travava em "Salvando…" mesmo com o registro salvo → risco de lançamento duplicado | Corrigido (`ActionForm` e onboarding chamam a ação diretamente, com trava contra duplo envio) |
| P0 | Um `UPDATE` podia trocar `workspace_id` de um registro (mover dados entre ambientes) | Bloqueado por trigger em todas as tabelas com tenant |
| P1 | Estorno inexistente: devolução era lançada como receita (inflava receitas) | Novo tipo `refund`: reduz despesa; em conta volta ao saldo; em cartão abate fatura e libera limite. Servidor recusa estorno acima do valor original |
| P1 | Upload confiava na extensão/tipo enviados pelo navegador | Validação por assinatura do arquivo (PDF, PNG, JPEG, WEBP, HEIC) |
| P1 | IA sem limite de uso por usuário (custo ilimitado) | Cota diária no banco (`consume_ai_quota`, padrão 60/dia, `AI_DAILY_LIMIT`) |
| P1 | Limite de usuários do plano não era aplicado | Trigger `member_limit` em convites e membros, lendo `plans.limits.users` |
| P1 | Excluir lançamento/ambiente deixava arquivos órfãos no Storage | Arquivos removidos junto |
| P1 | Arquivar conta com saldo fazia o dinheiro "sumir" dos totais | Bloqueado enquanto o saldo ≠ 0 |
| P2 | Edição de lançamento apagava contato/forma de pagamento não enviados no formulário | Só atualiza campos presentes |
| P2 | Gráficos (Recharts) no bundle inicial de 5 páginas | Carregamento sob demanda: ~245 kB → ~109 kB |
| P2 | Índices faltando em consultas frequentes | 8 índices adicionados |
| P2 | `finance.ts` com ~600 linhas misturando domínios | Dividido em `transactions`, `accounts`, `cards`, `planning`, `business` |
| P3 | Código morto, `date-fns` sem uso, datas formatadas de 3 jeitos | Removidos/unificados (`fmtDateTime`) |
| P3 | Sem endpoint de monitoramento | `GET /api/health` (sem dados sensíveis) |

## Migrações desta auditoria

Todas aditivas, sem apagar ou reescrever dados.

| Migração | O que faz | Rollback |
|---|---|---|
| `0005_refund_enum` | Adiciona `refund` ao enum `tx_type` | Postgres não remove valores de enum; é inofensivo se não usado |
| `0006_audit_hardening` | Regra `refund_shape`, view de saldos com estorno, triggers de tenant, índices, tabela `ai_usage` + `consume_ai_quota` | `drop trigger no_ws_move on <tabela>`; `drop function consume_ai_quota`; `drop table ai_usage`; `drop index ...`; recriar a view da 0001 |
| `0007_plan_limits` | Trigger `member_limit` em `workspace_invites` e `workspace_members` | `drop trigger member_limit on ...`; `drop function enforce_member_limit` |

## Verificações executadas

- `npm run typecheck` — sem erros
- `npx eslint src --max-warnings=0` — sem avisos
- `npm test` — 39/39
- `npm run test:db` — 15/15 (estorno, imutabilidade de tenant, cota de IA, ataques entre usuários, limite do plano)
- `npm run test:e2e` — 10/10 contra build de produção (cadastro, IA por texto, parcelado, estorno, fatura/limite/saldo, fluxo empresa, ataque via API, 320–430 px, erros de JS)
- `npm audit` — 0 vulnerabilidades

## Pendências

- SMTP próprio no Supabase Auth (o envio padrão é limitado por hora)
- Arquivo vetorial oficial da logo (hoje: reprodução em SVG baseada na referência)
- `ANTHROPIC_API_KEY` para IA generativa (sem ela, o assistente usa regras determinísticas)
- Cobrança/assinaturas: estrutura de planos existe; gateway de pagamento não integrado
