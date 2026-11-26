-- Testes de isolamento multi-tenant e regras de saldo.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','ana@test.dev'),
 ('00000000-0000-0000-0000-00000000000b','bruno@test.dev'),
 ('00000000-0000-0000-0000-00000000000c','caio@test.dev');

set role authenticated;
-- Ana cria ambiente pessoal
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000a', false);
select public.create_workspace('personal','Ana Pessoal') as ws_a \gset
insert into financial_accounts (workspace_id,name,type,opening_balance) values (:'ws_a','Nubank','digital',1000) returning id as acc1 \gset
insert into financial_accounts (workspace_id,name,type,opening_balance) values (:'ws_a','Carteira','wallet',0) returning id as acc2 \gset
insert into credit_cards (workspace_id,name,limit_amount,closing_day,due_day) values (:'ws_a','Visa',5000,5,12) returning id as card \gset
insert into transactions (workspace_id,type,amount,description,account_id,date,competence_date,paid_at) values
 (:'ws_a','income',3000,'Salário',:'acc1','2026-11-05','2026-11-05','2026-11-05'),
 (:'ws_a','expense',200,'Mercado',:'acc1','2026-11-06','2026-11-06','2026-11-06');
insert into transactions (workspace_id,type,amount,description,account_id,to_account_id,date,competence_date,paid_at) values
 (:'ws_a','transfer',100,'Saque',:'acc1',:'acc2','2026-11-07','2026-11-07','2026-11-07');
-- Pendente não altera saldo
insert into transactions (workspace_id,type,status,amount,description,account_id,date,competence_date,due_date) values
 (:'ws_a','expense','pending',999,'Aluguel',:'acc1','2026-11-30','2026-11-30','2026-11-30');
-- Compra no cartão não altera saldo; pagamento da fatura sim
insert into transactions (workspace_id,type,amount,description,card_id,invoice_month,date,competence_date) values
 (:'ws_a','expense',300,'Tênis',:'card','2026-12-01','2026-11-10','2026-12-01');
insert into transactions (workspace_id,type,amount,description,account_id,card_id,invoice_month,date,competence_date,paid_at) values
 (:'ws_a','card_payment',300,'Fatura Visa',:'acc1',:'card','2026-12-01','2026-12-12','2026-12-12','2026-12-12');

do $$
declare b1 numeric; b2 numeric;
begin
  select balance into b1 from account_balances ab join financial_accounts a on a.id=ab.account_id where a.name='Nubank';
  select balance into b2 from account_balances ab join financial_accounts a on a.id=ab.account_id where a.name='Carteira';
  -- 1000 + 3000 - 200 - 100 - 300(fatura) = 3400 ; carteira = 100
  if b1 <> 3400 then raise exception 'saldo Nubank incorreto: %', b1; end if;
  if b2 <> 100 then raise exception 'saldo Carteira incorreto: %', b2; end if;
  raise notice 'OK saldos: % / %', b1, b2;
end $$;

-- Bruno não vê nada da Ana
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  if (select count(*) from transactions) <> 0 then raise exception 'VAZAMENTO: Bruno vê transações'; end if;
  if (select count(*) from workspaces) <> 0 then raise exception 'VAZAMENTO: Bruno vê ambientes'; end if;
  if (select count(*) from account_balances) <> 0 then raise exception 'VAZAMENTO: Bruno vê saldos'; end if;
  raise notice 'OK isolamento de leitura';
end $$;
-- Bruno não consegue inserir no ambiente da Ana
do $$ begin
  begin
    insert into transactions (workspace_id,type,amount,description,date,competence_date,paid_at)
      values ((select id from public.workspaces limit 1),'income',1,'x',current_date,current_date,current_date);
    raise exception 'sem ws visível — esperado';
  exception when others then raise notice 'OK (%)', sqlerrm; end;
end $$;
\set ON_ERROR_STOP off
insert into transactions (workspace_id,type,amount,description,date,competence_date,paid_at) values (:'ws_a','income',1,'hack',current_date,current_date,current_date);
\set ON_ERROR_STOP on

-- Bruno cria empresa e tenta usar conta da Ana (deve falhar pela trigger)
select public.create_workspace('business','Barbearia do Bruno',null,'barbershop') as ws_b \gset
\set ON_ERROR_STOP off
insert into transactions (workspace_id,type,amount,description,account_id,date,competence_date,paid_at) values (:'ws_b','income',1,'cross',:'acc1',current_date,current_date,current_date);
\set ON_ERROR_STOP on

-- Bruno convida Caio como funcionário (simula aceite direto pelo owner via membro)
reset role;
insert into workspace_members values (:'ws_b','00000000-0000-0000-0000-00000000000c','employee');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c', false);
\set ON_ERROR_STOP off
insert into financial_accounts (workspace_id,name,type) values (:'ws_b','Caixa','cash');  -- deve falhar (employee)
select count(*) as caio_ve_tx_da_ana from transactions where workspace_id = :'ws_a';
