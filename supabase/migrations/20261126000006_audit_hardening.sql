-- =====================================================================
-- Auditoria: estornos, imutabilidade do tenant, índices e cota de IA.
-- Não destrutiva: apenas adiciona regras/objetos. Dados existentes preservados.
-- =====================================================================

-- 1) Estorno (refund)
--    * com card_id: crédito na fatura (abate a fatura e libera limite)
--    * com account_id: dinheiro devolvido na conta
--    Em ambos os casos reduz a despesa da categoria (não é receita).
alter table public.transactions drop constraint if exists refund_shape;
alter table public.transactions add constraint refund_shape check (
  type <> 'refund' or (
    (card_id is not null and account_id is null and invoice_month is not null) or
    (account_id is not null and card_id is null)
  )
);

create or replace view public.account_balances with (security_invoker = true) as
select a.id as account_id, a.workspace_id,
  a.opening_balance
  + coalesce(sum(case
      when t.status <> 'paid' then 0
      when t.type = 'income' and t.account_id = a.id then t.amount
      when t.type = 'refund' and t.account_id = a.id then t.amount
      when t.type = 'expense' and t.account_id = a.id then -t.amount
      when t.type = 'card_payment' and t.account_id = a.id then -t.amount
      when t.type = 'adjustment' and t.account_id = a.id then t.amount
      when t.type = 'transfer' and t.account_id = a.id then -t.amount
      when t.type = 'transfer' and t.to_account_id = a.id then t.amount
      else 0 end), 0) as balance
from public.financial_accounts a
left join public.transactions t
  on (t.account_id = a.id or t.to_account_id = a.id) and t.workspace_id = a.workspace_id
group by a.id;

-- 2) Um registro nunca muda de ambiente (impede mover dados entre tenants via UPDATE)
create or replace function public.tx_check_same_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.workspace_id is distinct from old.workspace_id then
    raise exception 'Não é permitido mover registros entre ambientes';
  end if;
  if new.account_id is not null and not exists (select 1 from financial_accounts where id = new.account_id and workspace_id = new.workspace_id) then
    raise exception 'Conta não pertence ao ambiente';
  end if;
  if new.to_account_id is not null and not exists (select 1 from financial_accounts where id = new.to_account_id and workspace_id = new.workspace_id) then
    raise exception 'Conta de destino não pertence ao ambiente';
  end if;
  if new.card_id is not null and not exists (select 1 from credit_cards where id = new.card_id and workspace_id = new.workspace_id) then
    raise exception 'Cartão não pertence ao ambiente';
  end if;
  if new.category_id is not null and not exists (select 1 from categories where id = new.category_id and workspace_id = new.workspace_id) then
    raise exception 'Categoria não pertence ao ambiente';
  end if;
  if new.contact_id is not null and not exists (select 1 from contacts where id = new.contact_id and workspace_id = new.workspace_id) then
    raise exception 'Contato não pertence ao ambiente';
  end if;
  if new.parent_id is not null and not exists (select 1 from transactions where id = new.parent_id and workspace_id = new.workspace_id) then
    raise exception 'Lançamento de origem não pertence ao ambiente';
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke execute on function public.tx_check_same_workspace() from public, anon, authenticated;

create or replace function public.prevent_workspace_move()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'Não é permitido mover registros entre ambientes';
  end if;
  return new;
end $$;
revoke execute on function public.prevent_workspace_move() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['financial_accounts','categories','contacts','credit_cards','budgets','income_plans','goals',
                           'goal_contributions','debts','debt_payments','assets','asset_values','cash_closings','attachments',
                           'recurrences','workspace_invites','workspace_members','subscriptions'] loop
    execute format('drop trigger if exists no_ws_move on public.%I', t);
    execute format('create trigger no_ws_move before update on public.%I for each row execute function public.prevent_workspace_move()', t);
  end loop;
end $$;

-- 3) Índices para as consultas mais frequentes (listagem por data, contatos, recorrências)
create index if not exists transactions_ws_date_idx on public.transactions (workspace_id, date desc);
create index if not exists transactions_contact_idx on public.transactions (contact_id) where contact_id is not null;
create index if not exists transactions_parent_idx on public.transactions (parent_id) where parent_id is not null;
create index if not exists transactions_recurrence_idx on public.transactions (recurrence_id) where recurrence_id is not null;
create index if not exists attachments_tx_idx on public.attachments (transaction_id);
create index if not exists goal_contributions_goal_idx on public.goal_contributions (goal_id);
create index if not exists debt_payments_debt_idx on public.debt_payments (debt_id);
create index if not exists asset_values_asset_idx on public.asset_values (asset_id, date desc);

-- 4) Cota diária de uso da IA generativa (controle de custo e abuso)
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  requests int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
create policy ai_usage_self_read on public.ai_usage for select using (user_id = auth.uid());

-- Retorna true e contabiliza se o usuário ainda tem cota no dia (fuso de Brasília)
create or replace function public.consume_ai_quota(p_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d date := (now() at time zone 'America/Sao_Paulo')::date; n int;
begin
  if uid is null then return false; end if;
  insert into ai_usage (user_id, day, requests) values (uid, d, 1)
  on conflict (user_id, day) do update set requests = ai_usage.requests + 1
  where ai_usage.requests < greatest(p_limit, 0)
  returning requests into n;
  return n is not null;
end $$;
revoke execute on function public.consume_ai_quota(int) from public, anon;
grant execute on function public.consume_ai_quota(int) to authenticated;
