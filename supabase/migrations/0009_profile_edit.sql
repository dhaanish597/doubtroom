alter table public.profiles add column class_edited_at timestamptz, add column pending_class_edit jsonb;

create function public.finish_class_edit(p_id uuid) returns void
language plpgsql set search_path = '' as $$
declare edit jsonb;
begin
  select pending_class_edit into edit from public.profiles where id = p_id for update;
  if edit is null then return; end if;
  delete from public.room_members where profile_id = p_id
    and room_id in (select jsonb_array_elements_text(edit->'leave'));
  insert into public.room_members(room_id, profile_id)
    select room_id, p_id from jsonb_array_elements_text(edit->'join') as rooms(room_id)
    on conflict do nothing;
  update public.profiles set display_name = edit->>'name', dept = edit->>'dept',
    year = (edit->>'year')::int, section = edit->>'section', class_edited_at = now(),
    pending_class_edit = null where id = p_id;
end;
$$;
revoke all on function public.finish_class_edit(uuid) from public, anon, authenticated;
grant execute on function public.finish_class_edit(uuid) to service_role;
