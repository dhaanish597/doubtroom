alter table public.answers
  add column exam_tip text,
  add column from_cache boolean not null default false,
  add column confidence text check (confidence in ('high', 'medium', 'low'));

create table public.ta_requests (
  room_id text not null references public.rooms(id),
  message_id text not null,
  doubt_id uuid unique,
  profile_id uuid not null references public.profiles(id),
  outcome text not null check (outcome in ('allowed', 'daily', 'room')),
  created_at timestamptz not null default now(),
  primary key (room_id, message_id)
);
alter table public.ta_requests enable row level security;
grant select, insert on public.ta_requests to service_role;
create index on public.ta_requests (created_at) where outcome = 'allowed';
create index on public.ta_requests (profile_id, created_at) where outcome = 'allowed';
create index on public.ta_requests (room_id, created_at) where outcome = 'allowed';

create function public.reserve_ta_request(
  p_room text, p_message text, p_profile uuid, p_doubt uuid,
  p_user_limit int, p_global_limit int, p_text text, p_unit text,
  p_image text, p_lang text, p_hash text
) returns text language plpgsql set search_path = '' as $$
declare
  decision text := 'allowed';
  requested_at timestamptz;
  day_start timestamptz;
begin
  -- Serialize reservations so simultaneous requests cannot overrun the global cap.
  perform pg_advisory_xact_lock(582167240);
  requested_at := clock_timestamp();
  day_start := date_trunc('day', requested_at at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';

  if exists (select 1 from public.ta_requests where (room_id = p_room and message_id = p_message) or doubt_id = p_doubt)
    or exists (select 1 from public.doubts where id = p_doubt or message_id = p_message) then
    return 'duplicate';
  end if;

  if (select count(*) from public.ta_requests where outcome = 'allowed' and created_at >= day_start) >= p_global_limit
    or (select count(*) from public.ta_requests where outcome = 'allowed' and profile_id = p_profile and created_at >= day_start) >= p_user_limit then
    decision := 'daily';
  elsif exists (select 1 from public.ta_requests where outcome = 'allowed' and room_id = p_room
                and created_at > requested_at - interval '5 seconds') then
    decision := 'room';
  end if;

  insert into public.ta_requests (room_id, message_id, doubt_id, profile_id, outcome, created_at)
    values (p_room, p_message, p_doubt, p_profile, decision, requested_at);

  if decision = 'allowed' and p_doubt is not null then
    insert into public.doubts (id, room_id, asker_id, message_id, text, unit, image_url, lang, q_hash)
      values (p_doubt, p_room, p_profile, p_message, p_text, p_unit, p_image, p_lang, p_hash);
  end if;
  return decision;
end;
$$;

create function public.finish_ta_answer(
  p_answer uuid, p_doubt uuid, p_room text, p_message text, p_body text,
  p_model text, p_tip text, p_confidence text, p_from_cache boolean
) returns void language plpgsql set search_path = '' as $$
begin
  insert into public.answers (id, doubt_id, room_id, message_id, author_kind, body_md, model, exam_tip, confidence, from_cache)
    values (p_answer, p_doubt, p_room, p_message, 'ai', p_body, p_model, p_tip, p_confidence, p_from_cache);
  update public.doubts set status = 'ai_answered', ai_answered_at = now() where id = p_doubt and status = 'open';
end;
$$;

revoke all on function public.reserve_ta_request(text,text,uuid,uuid,int,int,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.reserve_ta_request(text,text,uuid,uuid,int,int,text,text,text,text,text) to service_role;
revoke all on function public.finish_ta_answer(uuid,uuid,text,text,text,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.finish_ta_answer(uuid,uuid,text,text,text,text,text,text,boolean) to service_role;
