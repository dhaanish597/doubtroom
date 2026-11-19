insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-note-uploads', 'course-note-uploads', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Replace a whole edition atomically, including simultaneous imports of the same title.
create or replace function public.replace_course_note(p_course text, p_title text, p_chunks jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_course || ':' || p_title, 0));
  delete from public.notes_chunks where course_code = p_course and source_title = p_title;
  insert into public.notes_chunks(course_code, source_title, page, content, embedding)
    select p_course, p_title, r.page, r.content, r.embedding
    from jsonb_populate_recordset(null::public.notes_chunks, p_chunks) r;
end;
$$;

create or replace function public.finish_grounded_answer(p_answer uuid, p_doubt uuid, p_room text,
  p_message text, p_body text, p_model text, p_tip text, p_confidence text, p_from_cache boolean, p_sources jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  perform public.finish_ta_answer(p_answer,p_doubt,p_room,p_message,p_body,p_model,p_tip,p_confidence,p_from_cache);
  update public.answers set sources = p_sources where id = p_answer;
end;
$$;

revoke all on function public.replace_course_note(text,text,jsonb), public.finish_grounded_answer(uuid,uuid,text,text,text,text,text,text,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.replace_course_note(text,text,jsonb), public.finish_grounded_answer(uuid,uuid,text,text,text,text,text,text,boolean,jsonb) to service_role;
