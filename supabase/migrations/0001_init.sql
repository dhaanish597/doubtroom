create extension if not exists vector;
create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,                -- null for try users
  nexconn_user_id text unique not null,    -- u_xxxxxxxx | try_xxxxxxxx | bot_ta | demo_*
  display_name text not null,
  avatar_url text,
  email text,
  college text not null default 'RMKEC',
  dept text,                               -- CSE, IT, ECE, EEE, MECH, AIDS, CSBS, ...
  year int check (year between 1 and 4),
  section text,
  role text not null default 'student' check (role in ('student','mentor','rep','admin','bot')),
  lang text not null default 'en' check (lang in ('en','ta','tanglish')),
  is_try boolean not null default false,
  nexconn_token text,
  token_issued_at timestamptz,
  onboarded_at timestamptz,
  first_connected_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table courses (
  code text primary key,                   -- e.g. CS3591
  title text not null,
  dept text not null,
  year int not null,
  semester int,
  exam_date date,
  units jsonb not null default '[]'::jsonb -- ["Unit 1: Introduction and Application Layer", ...]
);

create table rooms (
  id text primary key,                     -- = Nexconn group channel id
  kind text not null check (kind in ('subject','section','demo')),
  course_code text references courses(code),
  dept text, year int, section text,
  title text not null,
  created_at timestamptz not null default now()
);

create table room_members (
  room_id text references rooms(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  muted_until timestamptz,
  primary key (room_id, profile_id)
);

create table mentor_subjects (
  profile_id uuid references profiles(id) on delete cascade,
  course_code text references courses(code) on delete cascade,
  primary key (profile_id, course_code)
);

create table doubts (
  id uuid primary key,
  room_id text not null references rooms(id),
  asker_id uuid not null references profiles(id),
  message_id text unique,
  text text not null,
  unit text,
  image_url text,
  lang text not null default 'en',
  q_hash text,
  status text not null default 'open' check (status in ('open','ai_answered','verified','failed')),
  created_at timestamptz not null default now(),
  ai_answered_at timestamptz,
  verified_at timestamptz
);
create index on doubts (room_id, status, created_at desc);
create index on doubts (q_hash);

create table answers (
  id uuid primary key default gen_random_uuid(),
  doubt_id uuid references doubts(id) on delete cascade,
  room_id text not null,
  message_id text unique,
  author_kind text not null check (author_kind in ('ai','mentor')),
  author_id uuid references profiles(id),
  body_md text not null,
  model text,
  sources jsonb,
  upvotes int not null default 0,
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table answer_votes (
  answer_id uuid references answers(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (answer_id, profile_id)
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references rooms(id),
  author_id uuid not null references profiles(id),
  message_id text unique,
  title text, body text,
  created_at timestamptz not null default now()
);

create table exam_eves (
  id text primary key,                     -- = Nexconn open channel id
  course_code text references courses(code),
  room_id text references rooms(id),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table notes_chunks (
  id bigserial primary key,
  course_code text references courses(code) on delete cascade,
  source_title text not null,
  page int,
  content text not null,
  embedding vector(768)
);
create index on notes_chunks using hnsw (embedding vector_cosine_ops);

create table ai_usage (
  id bigserial primary key,
  profile_id uuid, kind text, provider text, model text,
  tokens_in int, tokens_out int, latency_ms int, ok boolean,
  created_at timestamptz not null default now()
);

create table reports (
  id bigserial primary key,
  reporter_id uuid references profiles(id),
  room_id text, message_id text, reason text,
  created_at timestamptz not null default now()
);

create table events (
  id bigserial primary key,
  profile_id uuid,
  name text not null,                      -- signed_up, onboarded, connected, message_sent, doubt_posted, ...
  props jsonb,
  created_at timestamptz not null default now()
);
create index on events (name, created_at);

create table webhook_events (
  msg_uid text primary key,
  channel_type int, channel_id text, from_user_id text, msg_type text,
  received_at timestamptz not null default now()
);

-- deny-all for anon/authenticated; only the service key (server) reads/writes
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

create or replace function match_notes(q vector(768), course text, k int default 4)
returns table (id bigint, source_title text, page int, content text, similarity float)
language sql stable as $$
  select id, source_title, page, content, 1 - (embedding <=> q) as similarity
  from notes_chunks where course_code = course
  order by embedding <=> q limit k;
$$;
