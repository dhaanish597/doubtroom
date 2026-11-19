-- Phase 11B: Exam Eve lookups and one morning recap per room per IST day.

-- Live Eve lookups by room and by time window.
create index if not exists exam_eves_room_window_idx on public.exam_eves (room_id, opens_at, closes_at);
create index if not exists courses_exam_date_idx on public.courses (exam_date) where exam_date is not null;

-- Recap candidates: verified AI answers and recently created AI answers.
create index if not exists answers_ai_verified_at_idx on public.answers (verified_at) where author_kind = 'ai';
create index if not exists answers_ai_created_at_idx on public.answers (created_at) where author_kind = 'ai';

-- Idempotency ledger for the recap. The primary key is the idempotency key (room, IST date).
create table public.recap_runs (
  room_id text not null references public.rooms(id) on delete cascade,
  recap_date date not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  message_id text,
  item_count int,
  claimed_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (room_id, recap_date)
);
alter table public.recap_runs enable row level security;
revoke all on public.recap_runs from anon, authenticated;
grant select, insert, update on public.recap_runs to service_role;

-- Claims a room's recap for the day. Returns false when it was already sent or another run is
-- sending it now. A failed run, or one stuck pending for 10 minutes, can be claimed again.
create function public.claim_recap(p_room text, p_date date)
returns boolean language plpgsql set search_path = '' as $$
declare
  claimed boolean;
begin
  insert into public.recap_runs as runs (room_id, recap_date, status, claimed_at)
    values (p_room, p_date, 'pending', now())
  on conflict (room_id, recap_date) do update
    set status = 'pending', claimed_at = now(), finished_at = null, message_id = null
    where runs.status = 'failed'
       or (runs.status = 'pending' and runs.claimed_at < now() - interval '10 minutes')
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

-- Records the outcome. A null message ID marks the run failed so a later run retries it.
create function public.finish_recap(p_room text, p_date date, p_message text, p_count int)
returns void language plpgsql set search_path = '' as $$
begin
  update public.recap_runs
    set status = case when p_message is null then 'failed' else 'sent' end,
        message_id = p_message, item_count = p_count, finished_at = now()
    where room_id = p_room and recap_date = p_date and status = 'pending';
end;
$$;

revoke all on function public.claim_recap(text, date) from public, anon, authenticated;
grant execute on function public.claim_recap(text, date) to service_role;
revoke all on function public.finish_recap(text, date, text, int) from public, anon, authenticated;
grant execute on function public.finish_recap(text, date, text, int) to service_role;
