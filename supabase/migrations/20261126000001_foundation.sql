-- =====================================================================
-- Innovai Finance — Fundação multi-tenant
-- Todas as tabelas de dados pertencem a um "workspace" (ambiente).
-- O isolamento é garantido por RLS com base em workspace_members.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type workspace_kind as enum ('personal', 'business', 'shared');
create type member_role as enum ('owner', 'admin', 'manager', 'finance', 'employee', 'viewer');
create type subscription_status as enum ('beta', 'trialing', 'active', 'past_due', 'canceled');
create type account_type as enum ('checking', 'savings', 'wallet', 'cash', 'digital', 'investment', 'other');
create type category_kind as enum ('income', 'expense');
-- Agrupamento gerencial (principalmente empresarial). Retiradas e investimentos
-- ficam fora do resultado operacional.
create type category_group as enum ('revenue', 'cost', 'fixed', 'variable', 'investment', 'withdrawal', 'personal', 'other');
create type tx_type as enum ('income', 'expense', 'transfer', 'adjustment', 'card_payment');
create type tx_status as enum ('pending', 'paid', 'canceled');
create type payment_method as enum ('cash', 'pix', 'debit', 'credit', 'boleto', 'transfer', 'app', 'other');
create type contact_kind as enum ('client', 'supplier');

-- ---------- Perfis ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  onboarded_at timestamptz
);

-- ---------- Planos (estrutura SaaS — sem preços definitivos) ----------
create table public.plans (
  code text primary key,
  name text not null,
  audience workspace_kind not null,
  features text[] not null default '{}',
  limits jsonb not null default '{}',
  sort int not null default 0
);

-- ---------- Ambientes ----------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  kind workspace_kind not null,
  name text not null check (char_length(name) between 1 and 80),
  trade_name text,
  segment text,                         -- restaurant, barbershop, store, services, mei, retail, general, custom
  settings jsonb not null default '{}', -- limites de alerta, caixa mínimo, objetivos etc.
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on public.workspace_members (user_id);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role member_role not null check (role <> 'owner'),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by uuid not null references auth.users(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  plan_code text not null references public.plans(code),
  status subscription_status not null default 'beta',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  provider text,           -- futuro gateway de pagamento
  provider_ref text,
  updated_at timestamptz not null default now()
);

-- ---------- Funções de autorização ----------
create or replace function public.member_role_in(ws uuid)
returns member_role language sql stable security definer set search_path = public as $$
  select role from public.workspace_members where workspace_id = ws and user_id = auth.uid()
$$;

create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members where workspace_id = ws and user_id = auth.uid())
$$;

-- Pode lançar/editar dados financeiros
create or replace function public.can_write(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.member_role_in(ws) in ('owner','admin','manager','finance'), false)
$$;

-- Pode operar o caixa / registrar vendas (inclui funcionário)
create or replace function public.can_operate(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.member_role_in(ws) in ('owner','admin','manager','finance','employee'), false)
$$;

create or replace function public.can_admin(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.member_role_in(ws) in ('owner','admin'), false)
$$;

-- ---------- Contas financeiras ----------
create table public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  type account_type not null,
  institution text,
  opening_balance numeric(14,2) not null default 0,
  opening_date date not null default current_date,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.financial_accounts (workspace_id);

-- ---------- Categorias ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 50),
  kind category_kind not null,
  grp category_group not null default 'other',
  icon text,
  color text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, kind, parent_id, name)
);
create index on public.categories (workspace_id);

-- ---------- Clientes e fornecedores ----------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind contact_kind not null,
  name text not null check (char_length(name) between 1 and 100),
  phone text,
  email text,
  document text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.contacts (workspace_id, kind);

-- ---------- Cartões de crédito ----------
create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  bank text,
  limit_amount numeric(14,2) not null check (limit_amount >= 0),
  closing_day smallint not null check (closing_day between 1 and 28),
  due_day smallint not null check (due_day between 1 and 28),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.credit_cards (workspace_id);

-- ---------- Recorrências ----------
create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  frequency text not null check (frequency in ('weekly','monthly','yearly')),
  start_date date not null,
  end_date date,
  generated_until date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Movimentações ----------
-- Regras:
--  * income/expense com account_id e status 'paid' alteram saldo.
--  * expense com card_id é compra no cartão: NÃO altera saldo bancário;
--    compõe a fatura (invoice_month). O pagamento da fatura é 'card_payment'
--    (sai da conta, abate o cartão) e NÃO é despesa — evita duplicidade.
--  * transfer move valor entre contas e não é receita nem despesa.
--  * adjustment corrige saldo (valor com sinal) e fica fora dos relatórios.
--  * competence_date: mês de referência (para cartão = mês da fatura).
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  type tx_type not null,
  status tx_status not null default 'paid',
  amount numeric(14,2) not null,
  description text not null check (char_length(description) between 1 and 140),
  category_id uuid references public.categories(id) on delete restrict,
  account_id uuid references public.financial_accounts(id) on delete restrict,
  to_account_id uuid references public.financial_accounts(id) on delete restrict,
  card_id uuid references public.credit_cards(id) on delete restrict,
  invoice_month date,
  contact_id uuid references public.contacts(id) on delete set null,
  date date not null,
  competence_date date not null,
  due_date date,
  paid_at date,
  payment_method payment_method,
  notes text,
  tags text[] not null default '{}',
  installment_group uuid,
  installment_number smallint,
  installment_total smallint,
  recurrence_id uuid references public.recurrences(id) on delete set null,
  parent_id uuid references public.transactions(id) on delete set null,
  source text not null default 'manual' check (source in ('manual','ai_text','voice','import','recurrence','cash_closing')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint amount_sign check ((type = 'adjustment' and amount <> 0) or (type <> 'adjustment' and amount > 0)),
  constraint transfer_shape check (type <> 'transfer' or (account_id is not null and to_account_id is not null and account_id <> to_account_id and card_id is null)),
  constraint card_payment_shape check (type <> 'card_payment' or (account_id is not null and card_id is not null and invoice_month is not null)),
  constraint card_purchase_shape check (not (type = 'expense' and card_id is not null) or (account_id is null and invoice_month is not null)),
  constraint income_shape check (type <> 'income' or card_id is null),
  constraint paid_shape check (status <> 'paid' or paid_at is not null or card_id is not null),
  constraint invoice_month_first check (invoice_month is null or extract(day from invoice_month) = 1),
  constraint installments_shape check (
    (installment_group is null and installment_number is null and installment_total is null) or
    (installment_group is not null and installment_number between 1 and installment_total and installment_total between 2 and 72))
);
create index on public.transactions (workspace_id, competence_date);
create index on public.transactions (workspace_id, status, due_date);
create index on public.transactions (account_id);
create index on public.transactions (to_account_id);
create index on public.transactions (card_id, invoice_month);
create index on public.transactions (installment_group);

-- ---------- Anexos (Storage bucket 'documents', caminho {workspace_id}/...) ----------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete cascade,
  kind text not null default 'other' check (kind in ('invoice','boleto','receipt','proof','contract','bill','purchase','other')),
  path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint path_in_workspace check (split_part(path, '/', 1) = workspace_id::text)
);
create index on public.attachments (workspace_id);

-- ---------- Planejamento ----------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount numeric(14,2) not null check (amount >= 0),
  unique (workspace_id, category_id, month)
);

create table public.income_plans (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  expected_income numeric(14,2) not null default 0 check (expected_income >= 0),
  savings_target numeric(14,2) not null default 0 check (savings_target >= 0),
  primary key (workspace_id, month)
);

-- ---------- Metas ----------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  kind text not null default 'custom',
  target_amount numeric(14,2) not null check (target_amount > 0),
  target_date date,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  amount numeric(14,2) not null check (amount <> 0),
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- Dívidas ----------
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  creditor text not null,
  description text,
  total_amount numeric(14,2) not null check (total_amount > 0),
  monthly_interest_rate numeric(7,4),           -- % a.m., somente quando conhecida
  installments_total smallint,
  installment_amount numeric(14,2),
  due_day smallint check (due_day between 1 and 31),
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active','renegotiating','paid','canceled')),
  created_at timestamptz not null default now()
);

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  debt_id uuid not null references public.debts(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ---------- Patrimônio (valores informados pelo usuário — nunca estimados) ----------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  side text not null check (side in ('asset','liability')),
  type text not null check (type in ('property','vehicle','investment','good','account','other','loan','financing')),
  name text not null,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.asset_values (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  value numeric(14,2) not null check (value >= 0),
  date date not null default current_date,
  unique (asset_id, date)
);

-- ---------- Fechamento de caixa ----------
create table public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  account_id uuid not null references public.financial_accounts(id) on delete restrict,
  date date not null,
  opening_amount numeric(14,2) not null,
  cash_in numeric(14,2) not null,
  cash_out numeric(14,2) not null,
  expected_amount numeric(14,2) not null,
  counted_amount numeric(14,2) not null,
  difference numeric(14,2) generated always as (counted_amount - expected_amount) stored,
  sales_by_method jsonb not null default '{}',
  justification text,
  closed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (account_id, date),
  constraint justify_difference check (counted_amount = expected_amount or coalesce(char_length(justification), 0) >= 3)
);

-- ---------- Inteligência / notificações ----------
create table public.insight_dismissals (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_key text not null,
  dismissed_at timestamptz not null default now(),
  primary key (workspace_id, user_id, insight_key)
);

create table public.notification_prefs (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}',
  primary key (workspace_id, user_id)
);

-- ---------- Auditoria (sem valores financeiros) ----------
create table public.audit_log (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  at timestamptz not null default now()
);
create index on public.audit_log (workspace_id, at desc);

-- =====================================================================
-- Integridade entre tenants: referências devem pertencer ao mesmo ambiente
-- =====================================================================
create or replace function public.tx_check_same_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
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
  new.updated_at := now();
  return new;
end $$;
create trigger tx_same_workspace before insert or update on public.transactions
  for each row execute function public.tx_check_same_workspace();

create or replace function public.child_check_same_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent_ws uuid;
begin
  if tg_table_name = 'goal_contributions' then select workspace_id into parent_ws from goals where id = new.goal_id;
  elsif tg_table_name = 'debt_payments' then select workspace_id into parent_ws from debts where id = new.debt_id;
  elsif tg_table_name = 'asset_values' then select workspace_id into parent_ws from assets where id = new.asset_id;
  elsif tg_table_name = 'budgets' then select workspace_id into parent_ws from categories where id = new.category_id;
  elsif tg_table_name = 'cash_closings' then select workspace_id into parent_ws from financial_accounts where id = new.account_id;
  elsif tg_table_name = 'attachments' then
    if new.transaction_id is null then return new; end if;
    select workspace_id into parent_ws from transactions where id = new.transaction_id;
  elsif tg_table_name = 'categories' then
    if new.parent_id is null then return new; end if;
    select workspace_id into parent_ws from categories where id = new.parent_id;
  end if;
  if parent_ws is distinct from new.workspace_id then
    raise exception 'Referência fora do ambiente';
  end if;
  return new;
end $$;
create trigger same_ws before insert or update on public.goal_contributions for each row execute function public.child_check_same_workspace();
create trigger same_ws before insert or update on public.debt_payments for each row execute function public.child_check_same_workspace();
create trigger same_ws before insert or update on public.asset_values for each row execute function public.child_check_same_workspace();
create trigger same_ws before insert or update on public.budgets for each row execute function public.child_check_same_workspace();
create trigger same_ws before insert or update on public.cash_closings for each row execute function public.child_check_same_workspace();
create trigger same_ws before insert or update on public.attachments for each row execute function public.child_check_same_workspace();
create trigger same_ws before insert or update on public.categories for each row execute function public.child_check_same_workspace();

-- Auditoria genérica
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  rec := coalesce(new, old);
  insert into audit_log (workspace_id, user_id, action, entity, entity_id)
  values (rec.workspace_id, auth.uid(), lower(tg_op), tg_table_name, rec.id);
  return null;
end $$;
create trigger audit after insert or update or delete on public.transactions for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.financial_accounts for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.credit_cards for each row execute function public.audit_trigger();
create trigger audit after insert or update or delete on public.cash_closings for each row execute function public.audit_trigger();
create trigger audit after insert or delete on public.attachments for each row execute function public.audit_trigger();

-- =====================================================================
-- Saldos por conta (view com security_invoker => respeita RLS)
-- =====================================================================
create or replace view public.account_balances with (security_invoker = true) as
select a.id as account_id, a.workspace_id,
  a.opening_balance
  + coalesce(sum(case
      when t.status <> 'paid' then 0
      when t.type = 'income' and t.account_id = a.id then t.amount
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

-- =====================================================================
-- RPC: criar ambiente (cria membro owner + assinatura beta)
-- =====================================================================
create or replace function public.create_workspace(p_kind workspace_kind, p_name text, p_trade_name text default null, p_segment text default null, p_settings jsonb default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare ws uuid; uid uuid := auth.uid(); n int;
begin
  if uid is null then raise exception 'Não autenticado'; end if;
  select count(*) into n from workspace_members where user_id = uid and role = 'owner';
  if n >= 10 then raise exception 'Limite de ambientes atingido'; end if;
  insert into workspaces (kind, name, trade_name, segment, settings, created_by)
  values (p_kind, p_name, p_trade_name, p_segment, coalesce(p_settings, '{}'), uid) returning id into ws;
  insert into workspace_members (workspace_id, user_id, role) values (ws, uid, 'owner');
  insert into subscriptions (workspace_id, plan_code, status)
  values (ws, case when p_kind = 'business' then 'business_pro' else 'personal_premium' end, 'beta');
  return ws;
end $$;

-- Aceitar convite
create or replace function public.accept_invite(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv workspace_invites; email text;
begin
  select u.email into email from auth.users u where u.id = auth.uid();
  select * into inv from workspace_invites where token = p_token and accepted_at is null and expires_at > now();
  if inv.id is null then raise exception 'Convite inválido ou expirado'; end if;
  if lower(inv.email) <> lower(email) then raise exception 'Convite destinado a outro e-mail'; end if;
  insert into workspace_members (workspace_id, user_id, role) values (inv.workspace_id, auth.uid(), inv.role)
    on conflict (workspace_id, user_id) do nothing;
  update workspace_invites set accepted_at = now() where id = inv.id;
  return inv.workspace_id;
end $$;

-- Perfil automático ao cadastrar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_log enable row level security;
alter table public.recurrences enable row level security;

create policy profiles_self on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy plans_read on public.plans for select to authenticated using (true);

create policy ws_read on public.workspaces for select using (public.is_member(id));
create policy ws_update on public.workspaces for update using (public.can_admin(id)) with check (public.can_admin(id));
create policy ws_delete on public.workspaces for delete using (public.member_role_in(id) = 'owner');

create policy wm_read on public.workspace_members for select using (public.is_member(workspace_id));
create policy wm_admin_update on public.workspace_members for update using (public.can_admin(workspace_id) and role <> 'owner') with check (public.can_admin(workspace_id) and role <> 'owner');
create policy wm_admin_delete on public.workspace_members for delete using ((public.can_admin(workspace_id) and role <> 'owner') or user_id = auth.uid() and role <> 'owner');

create policy inv_admin on public.workspace_invites for all using (public.can_admin(workspace_id)) with check (public.can_admin(workspace_id) and invited_by = auth.uid());
create policy sub_read on public.subscriptions for select using (public.is_member(workspace_id));
create policy audit_read on public.audit_log for select using (public.can_admin(workspace_id));

-- Tabelas financeiras: leitura para membros; escrita para papéis financeiros.
do $$
declare t text;
begin
  foreach t in array array['financial_accounts','categories','contacts','credit_cards','budgets','income_plans',
                           'goals','goal_contributions','debts','debt_payments','assets','asset_values','recurrences'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (public.is_member(workspace_id))', t || '_read', t);
    execute format('create policy %I on public.%I for insert with check (public.can_write(workspace_id))', t || '_ins', t);
    execute format('create policy %I on public.%I for update using (public.can_write(workspace_id)) with check (public.can_write(workspace_id))', t || '_upd', t);
    execute format('create policy %I on public.%I for delete using (public.can_write(workspace_id))', t || '_del', t);
  end loop;
end $$;

-- Movimentações: funcionário pode registrar receitas/despesas em conta, mas só edita as próprias.
alter table public.transactions enable row level security;
create policy tx_read on public.transactions for select using (public.is_member(workspace_id));
create policy tx_ins on public.transactions for insert with check (
  public.can_write(workspace_id) or (public.can_operate(workspace_id) and type in ('income','expense') and created_by = auth.uid()));
create policy tx_upd on public.transactions for update using (
  public.can_write(workspace_id) or (public.can_operate(workspace_id) and created_by = auth.uid()))
  with check (public.can_write(workspace_id) or (public.can_operate(workspace_id) and created_by = auth.uid()));
create policy tx_del on public.transactions for delete using (public.can_write(workspace_id));

alter table public.attachments enable row level security;
create policy att_read on public.attachments for select using (public.is_member(workspace_id));
create policy att_ins on public.attachments for insert with check (public.can_operate(workspace_id) and uploaded_by = auth.uid());
create policy att_del on public.attachments for delete using (public.can_write(workspace_id));

alter table public.cash_closings enable row level security;
create policy cc_read on public.cash_closings for select using (public.is_member(workspace_id));
create policy cc_ins on public.cash_closings for insert with check (public.can_operate(workspace_id) and closed_by = auth.uid());
create policy cc_del on public.cash_closings for delete using (public.can_admin(workspace_id));

alter table public.insight_dismissals enable row level security;
create policy idm_self on public.insight_dismissals for all using (user_id = auth.uid() and public.is_member(workspace_id)) with check (user_id = auth.uid() and public.is_member(workspace_id));
alter table public.notification_prefs enable row level security;
create policy np_self on public.notification_prefs for all using (user_id = auth.uid() and public.is_member(workspace_id)) with check (user_id = auth.uid() and public.is_member(workspace_id));

-- Funções: somente usuários autenticados
revoke execute on function public.create_workspace(workspace_kind, text, text, text, jsonb) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.create_workspace(workspace_kind, text, text, text, jsonb) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;

-- =====================================================================
-- Planos iniciais (sem preço: a definir após validação comercial)
-- =====================================================================
insert into public.plans (code, name, audience, features, limits, sort) values
 ('personal_free', 'Pessoal Gratuito', 'personal', array['transactions','categories','dashboard','budget','goals_basic'], '{"accounts":3,"goals":2}', 1),
 ('personal_premium', 'Pessoal Premium', 'personal', array['transactions','categories','dashboard','budget','goals_basic','goals_advanced','ai','reports_advanced','cards','imports','shared'], '{"accounts":50,"goals":50}', 2),
 ('business_starter', 'Empresas Inicial', 'business', array['transactions','categories','dashboard','payables','receivables','cashflow_basic'], '{"users":2}', 3),
 ('business_pro', 'Empresas Profissional', 'business', array['transactions','categories','dashboard','payables','receivables','cashflow_basic','ai','projections','reports_advanced','cash_closing','contacts','documents'], '{"users":10}', 4),
 ('business_advanced', 'Empresas Avançado', 'business', array['transactions','categories','dashboard','payables','receivables','cashflow_basic','ai','projections','reports_advanced','cash_closing','contacts','documents','multi_unit','permissions_advanced','integrations'], '{"users":50}', 5);
