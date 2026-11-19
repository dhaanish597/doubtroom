-- Phase 11A: announcements, member mutes, reports and admin tools.

alter table public.announcements add column if not exists urgent boolean not null default false;
create index if not exists announcements_room_created_idx on public.announcements (room_id, created_at desc);

-- The reporter's copy of the reported message, so admins can triage without opening the room.
alter table public.reports add column if not exists excerpt text;
alter table public.reports add column if not exists reported_user_id text;
alter table public.reports drop constraint if exists reports_excerpt_length;
alter table public.reports add constraint reports_excerpt_length check (excerpt is null or char_length(excerpt) <= 500);
create index if not exists reports_created_idx on public.reports (created_at desc);

create index if not exists room_members_muted_idx on public.room_members (room_id, muted_until)
  where muted_until is not null;

-- Records an announcement once per message. Returns true for the first record.
create function public.record_announcement(
  p_room text, p_author uuid, p_message text, p_title text, p_body text, p_urgent boolean
) returns boolean language plpgsql set search_path = '' as $$
declare
  inserted_id uuid;
begin
  insert into public.announcements (room_id, author_id, message_id, title, body, urgent)
    values (p_room, p_author, p_message, p_title, p_body, coalesce(p_urgent, false))
    on conflict (message_id) do nothing
    returning id into inserted_id;
  if inserted_id is null then return false; end if;
  insert into public.events (profile_id, name, props) values (p_author, 'announcement_posted',
    jsonb_build_object('roomId', p_room, 'announcementId', inserted_id, 'urgent', coalesce(p_urgent, false)));
  return true;
end;
$$;

-- Sets (p_until in the future) or clears (p_until null) a member's mute in one room.
-- Returns false when the target is not a member of the room.
create function public.set_member_mute(p_room text, p_target uuid, p_until timestamptz, p_actor uuid)
returns boolean language plpgsql set search_path = '' as $$
begin
  update public.room_members set muted_until = p_until where room_id = p_room and profile_id = p_target;
  if not found then return false; end if;
  insert into public.events (profile_id, name, props) values (p_actor,
    case when p_until is null then 'member_unmuted' else 'member_muted' end,
    jsonb_build_object('roomId', p_room, 'targetId', p_target, 'until', p_until));
  return true;
end;
$$;

-- Admin role change. Mentors get exactly p_courses as subjects and join those subject rooms.
-- The route joins the Nexconn groups first. Returns the number of subject rooms newly joined.
create function public.admin_set_role(p_target uuid, p_role text, p_courses text[], p_admin uuid)
returns int language plpgsql set search_path = '' as $$
declare
  joined int := 0;
begin
  if p_role not in ('student', 'mentor', 'rep') then
    raise exception 'unsupported role %', p_role using errcode = '22023';
  end if;
  perform 1 from public.profiles where id = p_target and role not in ('admin', 'bot') and not is_try for update;
  if not found then
    raise exception 'profile cannot change role' using errcode = '22023';
  end if;

  update public.profiles set role = p_role where id = p_target;
  delete from public.mentor_subjects where profile_id = p_target
    and (p_role <> 'mentor' or course_code <> all(coalesce(p_courses, '{}')));
  if p_role = 'mentor' then
    insert into public.mentor_subjects (profile_id, course_code)
      select p_target, c.code from public.courses c where c.code = any(coalesce(p_courses, '{}'))
      on conflict do nothing;
    insert into public.room_members (room_id, profile_id)
      select r.id, p_target from public.rooms r
      where r.kind = 'subject' and r.course_code = any(coalesce(p_courses, '{}'))
      on conflict do nothing;
    get diagnostics joined = row_count;
  end if;

  insert into public.events (profile_id, name, props) values (p_admin, 'role_changed',
    jsonb_build_object('targetId', p_target, 'role', p_role, 'courses', to_jsonb(coalesce(p_courses, '{}'))));
  return joined;
end;
$$;

-- Daily metrics by India Standard Time day for the admin CSV export, newest day first.
create function public.admin_daily_metrics(p_days int)
returns table (
  day date, new_users int, active_users int, messages int, doubts int, ai_answers int,
  verified int, senior_answers int, announcements int, reports int
) language sql stable set search_path = '' as $$
  with days as (
    select generate_series(
      (now() at time zone 'Asia/Kolkata')::date - (least(greatest(p_days, 1), 366) - 1),
      (now() at time zone 'Asia/Kolkata')::date, interval '1 day')::date as day
  ),
  since as (select (min(day)::timestamp at time zone 'Asia/Kolkata') as at from days)
  select d.day,
    coalesce(u.n, 0), coalesce(a.n, 0), coalesce(m.n, 0), coalesce(q.n, 0), coalesce(ai.n, 0),
    coalesce(v.n, 0), coalesce(s.n, 0), coalesce(an.n, 0), coalesce(r.n, 0)
  from days d
  left join (select (created_at at time zone 'Asia/Kolkata')::date as day, count(*)::int as n from public.profiles
    where not is_try and role <> 'bot' and created_at >= (select at from since) group by 1) u using (day)
  left join (select (created_at at time zone 'Asia/Kolkata')::date as day, count(distinct profile_id)::int as n from public.events
    where profile_id is not null and created_at >= (select at from since) group by 1) a using (day)
  left join (select (created_at at time zone 'Asia/Kolkata')::date as day, count(*)::int as n from public.events
    where name = 'message_sent' and created_at >= (select at from since) group by 1) m using (day)
  left join (select (created_at at time zone 'Asia/Kolkata')::date as day, count(*)::int as n from public.doubts
    where created_at >= (select at from since) group by 1) q using (day)
  left join (select (created_at at time zone 'Asia/Kolkata')::date as day, count(*)::int as n from public.answers
    where author_kind = 'ai' and created_at >= (select at from since) group by 1) ai using (day)
  left join (select (verified_at at time zone 'Asia/Kolkata')::date as day, count(*)::int as n from public.doubts
    where verified_at >= (select at from since) group by 1) v using (day)
  left join (select (created_at at time zone 'Asia/Kolkata')::date as day, count(*)::int as n from public.answers
    where author_kind = 'mentor' and created_at >= (select at from since) group by 1) s using (day)
  left join (select (created_at at time zone 'Asia/Kolkata')::date as day, count(*)::int as n from public.announcements
    where created_at >= (select at from since) group by 1) an using (day)
  left join (select (created_at at time zone 'Asia/Kolkata')::date as day, count(*)::int as n from public.reports
    where created_at >= (select at from since) group by 1) r using (day)
  order by d.day desc;
$$;

revoke all on function public.record_announcement(text, uuid, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.record_announcement(text, uuid, text, text, text, boolean) to service_role;
revoke all on function public.set_member_mute(text, uuid, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.set_member_mute(text, uuid, timestamptz, uuid) to service_role;
revoke all on function public.admin_set_role(uuid, text, text[], uuid) from public, anon, authenticated;
grant execute on function public.admin_set_role(uuid, text, text[], uuid) to service_role;
revoke all on function public.admin_daily_metrics(int) from public, anon, authenticated;
grant execute on function public.admin_daily_metrics(int) to service_role;
