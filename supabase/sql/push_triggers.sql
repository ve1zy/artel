-- Run this in Supabase SQL editor after deploying the Edge Function `send-push-topic`
-- and setting secrets: GOOGLE_SERVICE_ACCOUNT_JSON, PUSH_WEBHOOK_SECRET.

-- Required for HTTP calls from Postgres
create extension if not exists pg_net;

-- Helper: send push to a user's topic
create or replace function public._push_to_user_topic(
  to_user_id uuid,
  title text,
  body text,
  data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  url text := 'https://rofbrevmmtyxhcdyqirz.functions.supabase.co/send-push-topic';
  secret text := 'asd456asd45dfg125asd45fvd568df21';  -- REPLACE WITH YOUR PUSH_WEBHOOK_SECRET
  payload jsonb;
  headers jsonb;
begin
  if to_user_id is null then
    return;
  end if;

  if secret is null or length(secret) = 0 then
    raise exception 'Missing DB setting app.push_webhook_secret. Set it in Supabase: Settings -> Database -> Custom settings.';
  end if;

  payload := jsonb_build_object(
    'topic', 'user_' || to_user_id::text,
    'title', coalesce(title, ''),
    'body', coalesce(body, ''),
    'data', coalesce(data, '{}'::jsonb)
  );

  headers := jsonb_build_object(
    'content-type', 'application/json',
    'x-push-secret', secret
  );

  perform net.http_post(
    url := url,
    headers := headers,
    body := payload
  );
end;
$$;

-- Invitations: notify invitee on new invitation
create or replace function public._push_on_invitation_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  title text;
  body text;
  data jsonb;
begin
  title := 'Новое приглашение';
  body := 'У вас новое приглашение';
  if new.project_title is not null and length(new.project_title) > 0 then
    body := 'Проект: ' || new.project_title;
  end if;

  data := jsonb_build_object(
    'type', 'invitation',
    'invitation_id', new.id::text,
    'from_user', new.from_user::text,
    'project_id', coalesce(new.project_id::text, ''),
    'project_title', coalesce(new.project_title, '')
  );

  perform public._push_to_user_topic(new.to_user, title, body, data);
  return new;
end;
$$;

-- Invitations: notify inviter when accepted
create or replace function public._push_on_invitation_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  title text;
  body text;
  data jsonb;
begin
  if old.status is distinct from new.status and new.status = 'accepted' then
    title := 'Приглашение принято';
    body := 'Ваше приглашение приняли';
    if new.project_title is not null and length(new.project_title) > 0 then
      body := 'Проект: ' || new.project_title;
    end if;

    data := jsonb_build_object(
      'type', 'invitation_accepted',
      'invitation_id', new.id::text,
      'to_user', new.to_user::text,
      'project_id', coalesce(new.project_id::text, ''),
      'project_title', coalesce(new.project_title, '')
    );

    perform public._push_to_user_topic(new.from_user, title, body, data);
  end if;

  return new;
end;
$$;

-- Messages: notify the other chat participant
create or replace function public._push_on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chat_participants uuid[];
  other_user uuid;
  project_title text;
  title text;
  body text;
  data jsonb;
begin
  select c.participants, c.project_title into chat_participants, project_title
  from public.chats c
  where c.id = new.chat_id;

  if chat_participants is null then
    return new;
  end if;

  select p from unnest(chat_participants) p where p <> new.user_id limit 1 into other_user;
  if other_user is null then
    return new;
  end if;

  title := 'Новое сообщение';
  if project_title is not null and length(project_title) > 0 then
    title := 'Новое сообщение · ' || project_title;
  end if;

  body := left(coalesce(new.message, ''), 120);

  data := jsonb_build_object(
    'type', 'message',
    'chat_id', new.chat_id::text,
    'from_user', new.user_id::text,
    'project_title', coalesce(project_title, '')
  );

  perform public._push_to_user_topic(other_user, title, body, data);
  return new;
end;
$$;

-- Triggers
DO $$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_push_invitation_insert') then
    drop trigger trg_push_invitation_insert on public.invitations;
  end if;
  create trigger trg_push_invitation_insert
  after insert on public.invitations
  for each row
  when (new.status = 'pending')
  execute function public._push_on_invitation_insert();

  if exists (select 1 from pg_trigger where tgname = 'trg_push_invitation_update') then
    drop trigger trg_push_invitation_update on public.invitations;
  end if;
  create trigger trg_push_invitation_update
  after update on public.invitations
  for each row
  execute function public._push_on_invitation_update();

  if exists (select 1 from pg_trigger where tgname = 'trg_push_message_insert') then
    drop trigger trg_push_message_insert on public.messages;
  end if;
  create trigger trg_push_message_insert
  after insert on public.messages
  for each row
  execute function public._push_on_message_insert();
end $$;
