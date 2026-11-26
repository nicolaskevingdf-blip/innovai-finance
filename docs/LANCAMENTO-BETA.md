# Preparação para o beta: checklists e critérios

Legenda: ✅ feito e verificado · 🔧 depende de configuração externa · 👤 depende de você · ⬜ a fazer

## Prioridades

### P0: impedem o lançamento do beta
- 🔧 SMTP próprio no Supabase Auth (sem ele, cadastros simultâneos ficam sem e-mail de confirmação)
- 🔧 Supabase Pro (backup diário, sem pausa por inatividade) antes de aceitar dados reais
- 🔧 Monitor externo em `/api/health`
- 🔧 Conferir no Supabase: confirmação de e-mail ligada, Site URL e redirects corretos
- ✅ Exclusão de ambiente/conta com lançamentos falhava (bug do registro de auditoria): **corrigido** na migração 0008
- ✅ Histórico financeiro confiável e imutável

### P1: necessário antes de cobrar
- 👤 Autorizar a integração Asaas, definir preços, teste grátis e carência (ver `docs/ASSINATURAS.md`)
- 🔧 Vercel Pro (uso comercial)
- 🔧 Proteção contra senhas vazadas + CAPTCHA no cadastro
- 👤 Revisão jurídica de Termos e Política de Privacidade (cobrança, cancelamento, reembolso, IA, operadores de dados: Supabase, Vercel, Anthropic, Asaas)
- 🔧 Domínio próprio + e-mail remetente no mesmo domínio
- 🔧 `ANTHROPIC_API_KEY` e limite de gasto mensal no Console da Anthropic

### P2: crescimento
- Sentry ou drain de logs (retenção maior que a da Vercel)
- Backup lógico semanal adicional (`pg_dump` criptografado)
- Importação de extrato (OFX/CSV) e conciliação
- Paginação no servidor para históricos muito longos de movimentações
- Painel interno de métricas (cadastros, ativação, uso da IA, custo)

### P3: futuro
- Open Finance, app nativo, multiunidades, relatórios em PDF, notificações por WhatsApp

## Checklist de segurança
- ✅ RLS em todas as tabelas; isolamento entre ambientes testado (SQL + ataque real via API no E2E)
- ✅ Registros não podem mudar de ambiente (trigger)
- ✅ Histórico de auditoria somente acréscimo (nem update nem delete, testado)
- ✅ Formulários via POST (senha nunca na URL)
- ✅ Upload validado pelo conteúdo real do arquivo
- ✅ Chaves secretas só no servidor; `.env` fora do Git
- ✅ Cabeçalhos de segurança (HSTS, X-Frame-Options DENY, nosniff, Permissions-Policy)
- ✅ Logs sem dados pessoais ou financeiros
- ✅ `npm audit`: 0 vulnerabilidades
- 🔧 Proteção contra senhas vazadas · CAPTCHA · MFA para administradores (P2)

## Checklist de cadastro e acesso
- ✅ Cadastro com aceite de termos, senha forte (8+, letras e números)
- ✅ Mensagens claras para e-mail já cadastrado, limite de tentativas e e-mail não confirmado
- ✅ **Reenviar e-mail de confirmação** na tela de login
- ✅ Recuperação de senha sem revelar se o e-mail existe; link expirado com mensagem clara
- ✅ Mesma regra de senha no cadastro e na redefinição
- ✅ Links de e-mail usam `NEXT_PUBLIC_SITE_URL` (não dependem do cabeçalho da requisição)
- 🔧 Testar com e-mail real após configurar SMTP: confirmação, recuperação, troca de e-mail

## Checklist de funcionalidades (manual, com conta nova)
- ✅ (E2E) Cadastro → onboarding pessoal → primeiros passos aparecem
- ✅ (E2E) Lançamento por texto com confirmação · compra parcelada · estorno parcial · estorno acima do valor recusado
- ✅ (E2E) Saldos, fatura e limite corretos após estorno
- ✅ (E2E) Edição aparece no histórico com antes → depois e autor
- ✅ (E2E) Fluxo empresarial: vendas do dia, conta parcial, fechamento de caixa
- ⬜ Convidar um segundo usuário real e conferir permissões por papel
- ⬜ Excluir um ambiente de teste com dados (após a migração 0008 em produção)
- ⬜ Exportar dados (CSV e exportação completa) e abrir no Excel/Google Planilhas

## Checklist mobile (aparelho real, não só emulador)
- ✅ (E2E) 320–430 px sem rolagem horizontal nem valores cortados, incluindo o histórico
- ⬜ iPhone (Safari) e Android (Chrome): instalar como app (PWA), abrir pelo ícone
- ⬜ Teclado numérico nos valores; teclado não cobre o botão de salvar
- ⬜ Lançamento por voz (permissão de microfone)
- ⬜ Rede lenta (3G) e sem rede: tela offline e mensagens de erro

## Checklist de pagamentos (quando autorizado)
- ⬜ Sandbox: Pix pago, boleto pago, cartão aprovado e recusado
- ⬜ Atraso → aviso → carência → somente leitura → pagamento → volta ao normal
- ⬜ Cancelamento no fim do período · troca de plano para cima e para baixo
- ⬜ Webhook repetido não duplica efeito (idempotência)
- ⬜ Reembolso e estorno de cartão

## Checklist de recuperação
- ⬜ Fazer um rollback de deploy de teste na Vercel (sabendo onde clicar antes de precisar)
- ⬜ Restaurar um backup em projeto de teste (após Supabase Pro)
- ✅ Migrações com instruções de rollback
- ✅ Tela de erro mostra código para o suporte; erro registrado no log

## Critérios para receber os primeiros usuários (beta fechado, 10 a 30 pessoas)
1. Todos os itens **P0** concluídos.
2. Testes automatizados verdes: tipos, lint, unitários, banco e E2E.
3. Um ciclo completo feito por você em celular real: cadastro com e-mail real, lançamentos, cartão, empresa.
4. Monitor de disponibilidade ativo e alerta testado.
5. Canal de suporte definido (e-mail ou WhatsApp) e informado no app.
6. Beta **gratuito**: cobrança só depois dos itens P1.
