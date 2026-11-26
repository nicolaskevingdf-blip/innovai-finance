-- Limite de usuários por plano aplicado no banco (não contornável pelo cliente).
-- Conta membros + convites pendentes válidos. Planos sem "users" em limits não têm limite.
-- Rollback: drop trigger member_limit on workspace_invites; drop trigger member_limit on workspace_members; drop function enforce_member_limit();
create or replace function public.enforce_member_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim int; used int; joining_email text;
begin
  select (p.limits->>'users')::int into lim
  from subscriptions s join plans p on p.code = s.plan_code
  where s.workspace_id = new.workspace_id;
  if lim is null then return new; end if;
  -- ao aceitar um convite, o próprio convite pendente não conta em dobro
  if tg_table_name = 'workspace_members' then
    select email into joining_email from auth.users where id = new.user_id;
  end if;
  select (select count(*) from workspace_members m where m.workspace_id = new.workspace_id)
       + (select count(*) from workspace_invites i where i.workspace_id = new.workspace_id and i.accepted_at is null
          and i.expires_at > now() and (joining_email is null or lower(i.email) <> lower(joining_email)))
    into used;
  if used >= lim then
    raise exception 'Limite de % usuários do plano atingido', lim using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.enforce_member_limit() from public, anon, authenticated;
drop trigger if exists member_limit on public.workspace_invites;
create trigger member_limit before insert on public.workspace_invites for each row execute function public.enforce_member_limit();
drop trigger if exists member_limit on public.workspace_members;
create trigger member_limit before insert on public.workspace_members for each row execute function public.enforce_member_limit();
