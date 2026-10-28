-- Nudge schema. הרץ את הקובץ כולו ב-Supabase → SQL Editor.
-- בטוח להרצה חוזרת (גם אחרי עדכון גרסה).

create table if not exists public.pages (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'violet',
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.sections (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  page_id uuid not null references public.pages(id) on delete cascade,
  title text not null,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  remind_at timestamptz,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);

-- עמודות שנוספו בגרסאות מאוחרות (משימות חוזרות + מעקב שליחת Push)
alter table public.tasks add column if not exists repeat text check (repeat in ('daily','weekly','monthly'));
alter table public.tasks add column if not exists reminded_at timestamptz;

-- מנויי התראות Push (מכשיר אחד = שורה אחת)
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.pages enable row level security;
alter table public.sections enable row level security;
alter table public.tasks enable row level security;
alter table public.push_subscriptions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pages','sections','tasks','push_subscriptions'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- סנכרון חי בין מכשירים (עם בדיקה כדי שאפשר יהיה להריץ שוב)
do $$
declare t text;
begin
  foreach t in array array['pages','sections','tasks'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
