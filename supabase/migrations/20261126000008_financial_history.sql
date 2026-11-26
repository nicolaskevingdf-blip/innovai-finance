-- =====================================================================
-- Histórico financeiro confiável + telemetria de custo da IA + checagem de saúde.
-- Aditiva: apenas novas colunas, funções e triggers. Nenhum dado é alterado.
--
-- Rollback:
--   drop trigger audit_append_only on public.audit_log; drop function public.audit_append_only();
--   (a função audit_trigger pode ser restaurada da migração 0001)
--   alter table public.audit_log drop column before, drop column after, drop column changed, drop column actor;
--   drop function public.record_ai_tokens(int, int); alter table public.ai_usage drop column input_tokens, drop column output_tokens;
--   drop function public.health_check();
-- =====================================================================

-- 1) Valores anteriores/posteriores, campos alterados e nome de quem fez
alter table public.audit_log
  add column if not exists before jsonb,
  add column if not exists after jsonb,
  add column if not exists changed text[],
  add column if not exists actor text;

create index if not exists audit_log_entity_idx on public.audit_log (entity_id, at desc);

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec record;
  o jsonb;
  n jsonb;
  ch text[];
  who text;
begin
  rec := coalesce(new, old);
  -- exclusão em cascata do ambiente inteiro (LGPD): o histórico vai junto, nada a registrar
  if tg_op = 'DELETE' and not exists (select 1 from workspaces w where w.id = rec.workspace_id) then
    return null;
  end if;
  if tg_op <> 'INSERT' then o := to_jsonb(old) - 'updated_at' - 'created_at' - 'workspace_id'; end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new) - 'updated_at' - 'created_at' - 'workspace_id'; end if;

  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into ch
    from jsonb_object_keys(n) as k where n -> k is distinct from o -> k;
    if ch is null then return null; end if;            -- atualização sem mudança real: não registra
    select jsonb_object_agg(k, o -> k), jsonb_object_agg(k, n -> k) into o, n from unnest(ch) as k;
  end if;

  if auth.uid() is not null then
    select coalesce(nullif(p.full_name, ''), u.email) into who
    from auth.users u left join profiles p on p.id = u.id where u.id = auth.uid();
  end if;

  insert into audit_log (workspace_id, user_id, action, entity, entity_id, before, after, changed, actor)
  values (rec.workspace_id, auth.uid(), lower(tg_op), tg_table_name, rec.id, o, n, ch, who);
  return null;
end $$;
revoke execute on function public.audit_trigger() from public, anon, authenticated;

-- 2) Somente acréscimo: ninguém altera o histórico. Exclusão só acontece junto com o
--    ambiente inteiro (exclusão de conta/ambiente — LGPD), quando o ambiente já não existe.
create or replace function public.audit_append_only()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'O histórico de auditoria não pode ser alterado';
  end if;
  if exists (select 1 from workspaces w where w.id = old.workspace_id) then
    raise exception 'O histórico de auditoria não pode ser apagado';
  end if;
  return old;
end $$;
revoke execute on function public.audit_append_only() from public, anon, authenticated;
drop trigger if exists audit_append_only on public.audit_log;
create trigger audit_append_only before update or delete on public.audit_log
  for each row execute function public.audit_append_only();

-- 3) Telemetria de custo da IA (somente contagem de tokens; nenhum conteúdo é guardado)
alter table public.ai_usage
  add column if not exists input_tokens bigint not null default 0,
  add column if not exists output_tokens bigint not null default 0;

create or replace function public.record_ai_tokens(p_in int, p_out int)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if uid is null then return; end if;
  update ai_usage set input_tokens = input_tokens + greatest(p_in, 0), output_tokens = output_tokens + greatest(p_out, 0)
  where user_id = uid and day = d;
end $$;
revoke execute on function public.record_ai_tokens(int, int) from public, anon;
grant execute on function public.record_ai_tokens(int, int) to authenticated;

-- 4) Checagem de saúde do banco via API (não lê nenhuma tabela)
create or replace function public.health_check()
returns boolean language sql stable set search_path = public as $$ select true $$;
grant execute on function public.health_check() to anon, authenticated;
