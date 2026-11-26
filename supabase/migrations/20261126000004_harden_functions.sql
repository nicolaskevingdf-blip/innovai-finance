-- Funções de trigger: nunca chamáveis pela API (triggers continuam funcionando).
revoke execute on function public.audit_trigger() from public, anon, authenticated;
revoke execute on function public.child_check_same_workspace() from public, anon, authenticated;
revoke execute on function public.tx_check_same_workspace() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- Helpers de permissão: usados pelas políticas RLS de usuários autenticados; anônimos não precisam.
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.member_role_in(uuid) from public, anon;
revoke execute on function public.can_write(uuid) from public, anon;
revoke execute on function public.can_operate(uuid) from public, anon;
revoke execute on function public.can_admin(uuid) from public, anon;
grant execute on function public.is_member(uuid), public.member_role_in(uuid), public.can_write(uuid), public.can_operate(uuid), public.can_admin(uuid) to authenticated;
