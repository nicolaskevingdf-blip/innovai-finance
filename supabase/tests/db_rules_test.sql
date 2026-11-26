-- Testes de regras no banco (rodar contra um Supabase local; tudo é desfeito no final).
-- psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/db_rules_test.sql
begin;
insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000000a1','t-a@innovai.test','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b1','t-b@innovai.test','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
create temp table r(k text, ok boolean, detail text);
do $$
declare ws uuid; ws2 uuid; a1 uuid; c uuid; p uuid; b numeric; n int; q boolean;
begin
  ws := public.create_workspace('personal','A');
  ws2 := public.create_workspace('business','A empresa');
  insert into financial_accounts (workspace_id,name,type,opening_balance) values (ws,'Banco','digital',1000) returning id into a1;
  insert into credit_cards (workspace_id,name,limit_amount,closing_day,due_day) values (ws,'Visa',5000,5,12) returning id into c;
  -- compra em conta + estorno em conta
  insert into transactions (workspace_id,type,amount,description,account_id,date,competence_date,paid_at) values (ws,'expense',300,'Compra',a1,'2026-11-05','2026-11-05','2026-11-05') returning id into p;
  insert into transactions (workspace_id,type,amount,description,account_id,parent_id,date,competence_date,paid_at) values (ws,'refund',100,'Estorno',a1,p,'2026-11-06','2026-11-06','2026-11-06');
  -- estorno no cartão não mexe no saldo
  insert into transactions (workspace_id,type,amount,description,card_id,invoice_month,date,competence_date) values (ws,'refund',50,'Estorno cartão',c,'2026-12-01','2026-11-20','2026-12-01');
  select balance into b from account_balances where account_id = a1;
  insert into r values ('saldo com estorno = 800', b = 800, b::text);
  -- estorno precisa de conta OU cartão
  begin insert into transactions (workspace_id,type,amount,description,date,competence_date,paid_at) values (ws,'refund',1,'x',current_date,current_date,current_date); insert into r values ('estorno sem conta/cartão bloqueado', false, 'aceitou');
  exception when check_violation then insert into r values ('estorno sem conta/cartão bloqueado', true, sqlerrm); end;
  -- mover lançamento para outro ambiente (mesmo sendo membro dos dois)
  begin update transactions set workspace_id = ws2 where id = p; insert into r values ('mover lançamento entre ambientes bloqueado', false, 'moveu');
  exception when others then insert into r values ('mover lançamento entre ambientes bloqueado', true, sqlerrm); end;
  begin update financial_accounts set workspace_id = ws2 where id = a1; insert into r values ('mover conta entre ambientes bloqueado', false, 'moveu');
  exception when others then insert into r values ('mover conta entre ambientes bloqueado', true, sqlerrm); end;
  -- cota de IA
  q := public.consume_ai_quota(2); q := public.consume_ai_quota(2) and q; 
  insert into r values ('cota de IA permite até o limite', q, '');
  insert into r values ('cota de IA bloqueia acima do limite', not public.consume_ai_quota(2), '');
  -- outro usuário
  perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
  select count(*) into n from transactions; insert into r values ('B não lê lançamentos de A', n = 0, n::text);
  select count(*) into n from account_balances; insert into r values ('B não lê saldos de A', n = 0, n::text);
  select count(*) into n from ai_usage; insert into r values ('B não lê uso de IA de A', n = 0, n::text);
  update transactions set amount = 1 where workspace_id = ws; get diagnostics n = row_count;
  insert into r values ('B não altera lançamentos de A', n = 0, n::text);
  delete from financial_accounts where workspace_id = ws; get diagnostics n = row_count;
  insert into r values ('B não exclui contas de A', n = 0, n::text);
  begin insert into transactions (workspace_id,type,amount,description,date,competence_date,paid_at) values (ws,'income',1,'x',current_date,current_date,current_date); insert into r values ('B não insere no ambiente de A', false, 'inseriu');
  exception when others then insert into r values ('B não insere no ambiente de A', true, sqlerrm); end;
  begin insert into workspace_members values (ws, '00000000-0000-0000-0000-0000000000b1', 'owner'); insert into r values ('B não se adiciona como membro', false, 'entrou');
  exception when others then insert into r values ('B não se adiciona como membro', true, sqlerrm); end;
end $$;
-- Limite de usuários do plano (Empresas Inicial = 2 usuários)
reset role;
update subscriptions set plan_code = 'business_starter' where workspace_id = (select id from workspaces where name = 'A empresa' and created_by = '00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$
declare w uuid := (select id from workspaces where name = 'A empresa');
begin
  insert into workspace_invites (workspace_id, email, role, invited_by) values (w, 'x1@innovai.test', 'viewer', '00000000-0000-0000-0000-0000000000a1');
  insert into r values ('convite dentro do limite do plano', true, '');
  begin
    insert into workspace_invites (workspace_id, email, role, invited_by) values (w, 'x2@innovai.test', 'viewer', '00000000-0000-0000-0000-0000000000a1');
    insert into r values ('convite acima do limite do plano bloqueado', false, 'aceitou');
  exception when others then insert into r values ('convite acima do limite do plano bloqueado', true, sqlerrm); end;
end $$;
select case when ok then 'PASS' else 'FAIL' end as resultado, k as teste from r;
select count(*) filter (where not ok) as falhas from r;
rollback;
