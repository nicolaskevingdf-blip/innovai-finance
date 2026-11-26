-- Lista de membros com e-mail, visível apenas para quem é membro do ambiente.
create or replace function public.workspace_member_list(p_ws uuid)
returns table (user_id uuid, role member_role, full_name text, email text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.role, p.full_name, u.email::text, m.created_at
  from workspace_members m
  join auth.users u on u.id = m.user_id
  left join profiles p on p.id = m.user_id
  where m.workspace_id = p_ws and public.is_member(p_ws)
  order by m.created_at
$$;
revoke execute on function public.workspace_member_list(uuid) from public, anon;
grant execute on function public.workspace_member_list(uuid) to authenticated;

-- Convite: leitura do ambiente/convite pelo token (para a tela de aceite), sem expor outros dados.
create or replace function public.invite_preview(p_token text)
returns table (workspace_name text, role member_role, email text, expired boolean, accepted boolean)
language sql stable security definer set search_path = public as $$
  select w.name, i.role, i.email, i.expires_at < now(), i.accepted_at is not null
  from workspace_invites i join workspaces w on w.id = i.workspace_id
  where i.token = p_token
$$;
revoke execute on function public.invite_preview(text) from public, anon;
grant execute on function public.invite_preview(text) to authenticated;
