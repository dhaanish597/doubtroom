-- Phase 7: upvotes, senior verification and senior answers.

create index if not exists answers_doubt_id_idx on public.answers (doubt_id);
create index if not exists answer_votes_profile_idx on public.answer_votes (profile_id, answer_id);
create index if not exists doubts_ai_answered_idx on public.doubts (room_id, created_at) where status = 'ai_answered';

-- Sets (p_voted true/false) or toggles (p_voted null) one vote and recounts the answer.
-- Returns no row when the answer does not exist.
create function public.set_answer_vote(p_answer uuid, p_profile uuid, p_voted boolean)
returns table (total int, voted boolean) language plpgsql set search_path = '' as $$
declare
  wanted boolean := p_voted;
  had_vote boolean;
begin
  -- Lock the answer so concurrent votes recount in order.
  perform 1 from public.answers where id = p_answer for update;
  if not found then return; end if;

  had_vote := exists (select 1 from public.answer_votes where answer_id = p_answer and profile_id = p_profile);
  if wanted is null then wanted := not had_vote; end if;
  if wanted and not had_vote then
    insert into public.answer_votes (answer_id, profile_id) values (p_answer, p_profile) on conflict do nothing;
  elsif not wanted and had_vote then
    delete from public.answer_votes where answer_id = p_answer and profile_id = p_profile;
  end if;

  update public.answers a
    set upvotes = (select count(*)::int from public.answer_votes v where v.answer_id = p_answer)
    where a.id = p_answer
    returning a.upvotes into total;
  voted := wanted;
  return next;
end;
$$;

-- Verifies an AI answer, or undoes the caller's own verification inside the window.
-- The route checks roles first; this function re-checks state under a row lock and
-- returns false when nothing changed.
create function public.set_answer_verification(
  p_answer uuid, p_profile uuid, p_verified boolean, p_window_seconds int
) returns boolean language plpgsql set search_path = '' as $$
declare
  target public.answers%rowtype;
begin
  select * into target from public.answers where id = p_answer for update;
  if not found or target.author_kind <> 'ai' then return false; end if;

  if p_verified then
    if target.verified_at is not null then return false; end if;
    update public.answers set verified_by = p_profile, verified_at = now() where id = p_answer;
    if target.doubt_id is not null then
      update public.doubts set status = 'verified', verified_at = coalesce(verified_at, now()) where id = target.doubt_id;
    end if;
    insert into public.events (profile_id, name, props) values (p_profile, 'answer_verified',
      jsonb_build_object('answerId', p_answer, 'roomId', target.room_id, 'doubtId', target.doubt_id));
    return true;
  end if;

  if target.verified_at is null or target.verified_by is distinct from p_profile
    or target.verified_at <= now() - make_interval(secs => p_window_seconds) then
    return false;
  end if;
  update public.answers set verified_by = null, verified_at = null where id = p_answer;
  -- The doubt stays verified while another verified or senior answer remains.
  if target.doubt_id is not null and not exists (
    select 1 from public.answers where doubt_id = target.doubt_id and id <> p_answer and verified_at is not null
  ) then
    update public.doubts set status = 'ai_answered', verified_at = null where id = target.doubt_id and status = 'verified';
  end if;
  insert into public.events (profile_id, name, props) values (p_profile, 'answer_unverified',
    jsonb_build_object('answerId', p_answer, 'roomId', target.room_id, 'doubtId', target.doubt_id));
  return true;
end;
$$;

-- Records a senior's reply to a doubt. A senior answer counts as verified by its author.
-- Returns the answer ID, including the existing one when the message was recorded before,
-- or null when the doubt is not in that room.
create function public.record_mentor_answer(
  p_answer uuid, p_doubt uuid, p_room text, p_message text, p_author uuid, p_body text
) returns uuid language plpgsql set search_path = '' as $$
declare
  existing uuid;
begin
  if not exists (select 1 from public.doubts where id = p_doubt and room_id = p_room) then return null; end if;

  insert into public.answers (id, doubt_id, room_id, message_id, author_kind, author_id, body_md, verified_by, verified_at)
    values (p_answer, p_doubt, p_room, p_message, 'mentor', p_author, p_body, p_author, now())
    on conflict (message_id) do nothing;
  if not found then
    select id into existing from public.answers
      where message_id = p_message and author_id = p_author and doubt_id = p_doubt;
    return existing;
  end if;

  update public.doubts set status = 'verified', verified_at = coalesce(verified_at, now()) where id = p_doubt;
  insert into public.events (profile_id, name, props) values (p_author, 'mentor_answered',
    jsonb_build_object('answerId', p_answer, 'roomId', p_room, 'doubtId', p_doubt));
  return p_answer;
end;
$$;

revoke all on function public.set_answer_vote(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_answer_vote(uuid, uuid, boolean) to service_role;
revoke all on function public.set_answer_verification(uuid, uuid, boolean, int) from public, anon, authenticated;
grant execute on function public.set_answer_verification(uuid, uuid, boolean, int) to service_role;
revoke all on function public.record_mentor_answer(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.record_mentor_answer(uuid, uuid, text, text, uuid, text) to service_role;
