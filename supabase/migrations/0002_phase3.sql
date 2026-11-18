alter table public.profiles add column pending_onboarding jsonb;

create index room_members_by_profile on public.room_members (profile_id, room_id);

create unique index events_connected_per_ist_day
  on public.events (profile_id, ((created_at at time zone 'Asia/Kolkata')::date))
  where name = 'connected';

create function public.record_chat_session(p_profile_id uuid, p_token text, p_refresh boolean)
returns text
language plpgsql
set search_path = ''
as $$
declare
  recorded_at timestamptz := statement_timestamp();
  saved_token text;
begin
  update public.profiles
  set nexconn_token = case
        when p_token is not null and (p_refresh or nexconn_token is null) then p_token
        else nexconn_token end,
      token_issued_at = case
        when p_token is not null and (p_refresh or nexconn_token is null) then recorded_at
        else token_issued_at end,
      first_connected_at = coalesce(first_connected_at, recorded_at),
      last_seen_at = greatest(last_seen_at, recorded_at)
  where id = p_profile_id and (nexconn_token is not null or p_token is not null)
  returning nexconn_token into strict saved_token;

  insert into public.events (profile_id, name, created_at)
  values (p_profile_id, 'connected', recorded_at)
  on conflict (profile_id, ((created_at at time zone 'Asia/Kolkata')::date))
    where name = 'connected' do nothing;

  return saved_token;
end;
$$;

-- Finalize only the plan reserved before any external memberships were added.
create function public.finish_onboarding(p_profile_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  plan jsonb;
begin
  select pending_onboarding into plan
  from public.profiles
  where id = p_profile_id and onboarded_at is null and not is_try
  for update;

  if plan is null then
    return;
  end if;

  insert into public.room_members (room_id, profile_id)
  select item->>'id', p_profile_id from jsonb_array_elements(plan->'rooms') as room(item)
  on conflict (room_id, profile_id) do nothing;

  insert into public.mentor_subjects (profile_id, course_code)
  select p_profile_id, code from jsonb_array_elements_text(plan->'mentorCourses') as course(code)
  on conflict (profile_id, course_code) do nothing;

  update public.profiles
  set dept = plan->>'dept', year = (plan->>'year')::integer, section = plan->>'section',
      role = case when role = 'admin' then role else plan->>'role' end,
      onboarded_at = statement_timestamp(), pending_onboarding = null
  where id = p_profile_id;

  insert into public.events (profile_id, name) values (p_profile_id, 'onboarded');
end;
$$;

revoke execute on function public.record_chat_session(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.finish_onboarding(uuid) from public, anon, authenticated;
grant execute on function public.record_chat_session(uuid, text, boolean) to service_role;
grant execute on function public.finish_onboarding(uuid) to service_role;
