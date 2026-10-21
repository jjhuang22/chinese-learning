-- Private connected-task writer. No browser/API grants, secrets, or personal progress access.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.daily_lesson_config (
  singleton boolean primary key default true check (singleton),
  learner_id uuid not null references auth.users(id) on delete cascade
);
alter table private.daily_lesson_config enable row level security;
revoke all on private.daily_lesson_config from public, anon, authenticated;
-- Configure only an unambiguous existing library. Never guess among multiple owners.
insert into private.daily_lesson_config(learner_id)
select min(user_id::text)::uuid from public.lessons
having count(distinct user_id) = 1;

create function private.lesson_object(value jsonb, expected_keys text[]) returns jsonb
language plpgsql immutable security invoker set search_path = '' as $function$
begin
  if value is null or jsonb_typeof(value) <> 'object' then
    raise exception 'Expected a lesson object' using errcode = '22023';
  end if;
  if not (value ?& expected_keys) or
      (select count(*) from jsonb_object_keys(value)) <> cardinality(expected_keys) then
    raise exception 'Missing or unexpected lesson fields: expected %', expected_keys using errcode = '22023';
  end if;
  return value;
end;
$function$;
create function private.lesson_text(value jsonb, maximum integer) returns text
language plpgsql immutable security invoker set search_path = '' as $function$
declare normalized text;
begin
  if value is null or jsonb_typeof(value) <> 'string' then
    raise exception 'Expected lesson text' using errcode = '22023';
  end if;
  -- ECMAScript trim whitespace, matching the manual importer.
  normalized := btrim(value #>> '{}', E' \t\n\r\f\013' || chr(160) || chr(5760) ||
    chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197) ||
    chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202) || chr(8232) ||
    chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279));
  if length(normalized) < 1 or length(normalized) > maximum then
    raise exception 'Lesson text must contain 1–% characters', maximum using errcode = '22023';
  end if;
  return normalized;
end;
$function$;
create function private.lesson_array(value jsonb, minimum integer, maximum integer) returns jsonb
language plpgsql immutable security invoker set search_path = '' as $function$
begin
  if value is null or jsonb_typeof(value) <> 'array' then
    raise exception 'Expected a lesson array' using errcode = '22023';
  end if;
  if jsonb_array_length(value) not between minimum and maximum then
    raise exception 'Expected %–% lesson items', minimum, maximum using errcode = '22023';
  end if;
  return value;
end;
$function$;

create function private.ingest_daily_lesson(payload jsonb, dry_run boolean default false) returns jsonb
language plpgsql security invoker set search_path = '' as $function$
declare
  library_owner uuid;
  lesson_day date;
  lesson_id text;
  lesson_title text;
  passage jsonb;
  sentence jsonb;
  suggestion jsonb;
  note jsonb;
  passages jsonb := '[]';
  sentences jsonb;
  suggestions jsonb := '[]';
  notes jsonb := '[]';
  source_sentences text[] := '{}';
  source_text text;
  phrase text;
  pronunciation text;
  meaning text;
  kind text;
  passage_title text;
  passage_format text;
  paragraph integer;
  previous_paragraph integer;
  document jsonb;
  saved jsonb;
  inserted boolean;
begin
  if payload is null or octet_length(payload::text) > 300000 then
    raise exception 'Lesson must be below 300 KB' using errcode = '22023';
  end if;
  perform private.lesson_object(payload, array['schemaVersion','date','title','passages','suggestions','notes']);
  if payload->'schemaVersion' <> '1'::jsonb then
    raise exception 'Expected schemaVersion 1' using errcode = '22023';
  end if;
  if jsonb_typeof(payload->'date') <> 'string' or (payload->>'date') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Use YYYY-MM-DD' using errcode = '22023';
  end if;
  lesson_day := (payload->>'date')::date;
  if to_char(lesson_day, 'YYYY-MM-DD') <> payload->>'date' then
    raise exception 'Use a real calendar date' using errcode = '22023';
  end if;
  lesson_id := 'import-' || (payload->>'date');
  lesson_title := private.lesson_text(payload->'title', 200);
  for passage in select value from jsonb_array_elements(private.lesson_array(payload->'passages',2,3)) loop
    perform private.lesson_object(passage,array['title','format','sentences']);
    passage_title := private.lesson_text(passage->'title',200);
    passage_format := passage->>'format';
    if passage_format is null or passage_format not in ('Dialogue','Reflection','Formal','Letter','Interview') then
      raise exception 'Unsupported passage format' using errcode = '22023';
    end if;
    sentences := '[]';
    previous_paragraph := 0;
    for sentence in select value from jsonb_array_elements(private.lesson_array(passage->'sentences',3,100)) loop
      perform private.lesson_object(sentence,array['text','pinyin','paragraph']);
      source_text := private.lesson_text(sentence->'text',3000);
      pronunciation := private.lesson_text(sentence->'pinyin',6000);
      if jsonb_typeof(sentence->'paragraph') <> 'number' or
          (sentence->>'paragraph')::numeric <> trunc((sentence->>'paragraph')::numeric) or
          (sentence->>'paragraph')::numeric not between 0 and 200 then
        raise exception 'Invalid paragraph index' using errcode = '22023';
      end if;
      paragraph := (sentence->>'paragraph')::numeric::integer;
      if (jsonb_array_length(sentences)=0 and paragraph<>0) or
          paragraph < previous_paragraph or paragraph > previous_paragraph+1 then
        raise exception 'Paragraphs must start at 0 and advance sequentially' using errcode = '22023';
      end if;
      previous_paragraph := paragraph;
      source_sentences := array_append(source_sentences,source_text);
      sentences := sentences || jsonb_build_array(jsonb_build_object('text',source_text,'pinyin',pronunciation,'paragraph',paragraph));
    end loop;
    passages := passages || jsonb_build_array(jsonb_build_object('title',passage_title,'format',passage_format,'sentences',sentences));
  end loop;
  for suggestion in select value from jsonb_array_elements(private.lesson_array(payload->'suggestions',3,60)) loop
    perform private.lesson_object(suggestion,array['text','pinyin','meaning','sentence','kind']);
    phrase := private.lesson_text(suggestion->'text',200);
    pronunciation := private.lesson_text(suggestion->'pinyin',500);
    meaning := private.lesson_text(suggestion->'meaning',3000);
    source_text := private.lesson_text(suggestion->'sentence',3000);
    kind := suggestion->>'kind';
    if kind is null or kind not in ('vocabulary','grammar') then
      raise exception 'Unsupported suggestion kind' using errcode = '22023';
    end if;
    if not (source_text = any(source_sentences)) then
      raise exception 'Copy a source sentence exactly from a passage' using errcode = '22023';
    end if;
    if kind='vocabulary' and strpos(source_text,phrase)=0 then
      raise exception 'Expression must appear in its source sentence' using errcode = '22023';
    end if;
    suggestions := suggestions || jsonb_build_array(jsonb_build_object('id',lesson_id || '-' || jsonb_array_length(suggestions),
      'text',phrase,'pinyin',pronunciation,'meaning',meaning,'sentence',source_text,'kind',kind));
  end loop;
  for note in select value from jsonb_array_elements(private.lesson_array(payload->'notes',0,10)) loop
    perform private.lesson_object(note,array['title','text']);
    notes := notes || jsonb_build_array(jsonb_build_object('title',private.lesson_text(note->'title',200),'text',private.lesson_text(note->'text',12000)));
  end loop;
  document := jsonb_build_object('id',lesson_id,'date',payload->>'date','title',lesson_title,'subtitle','',
    'passages',passages,'suggestions',suggestions,'notes',notes);
  if dry_run is null then raise exception 'dry_run must be true or false'; end if;
  if dry_run then return jsonb_build_object('status','validated','lesson',document); end if;
  select learner_id into library_owner from private.daily_lesson_config where singleton;
  if library_owner is null then raise exception 'Daily lesson library is not configured'; end if;
  insert into public.lessons(user_id,lesson_date,content) values(library_owner,lesson_day,document)
    on conflict(user_id,lesson_date) do nothing returning content into saved;
  inserted := found;
  if not inserted then
    select content into saved from public.lessons where user_id=library_owner and lesson_date=lesson_day;
  end if;
  if saved is null then raise exception 'Unable to verify saved lesson; retry'; end if;
  return jsonb_build_object('status',case when inserted then 'created' else 'already_exists' end,'lesson',saved);
end;
$function$;
revoke all on function private.lesson_object(jsonb,text[]), private.lesson_text(jsonb,integer),
  private.lesson_array(jsonb,integer,integer), private.ingest_daily_lesson(jsonb,boolean)
  from public, anon, authenticated;
-- Deliberately no grants to browser roles or public API. Connected admin SQL only.
