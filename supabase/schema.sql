-- Nudge schema. הרץ את הקובץ כולו ב-Supabase → SQL Editor.

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

alter table public.pages enable row level security;
alter table public.sections enable row level security;
alter table public.tasks enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pages','sections','tasks'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- סנכרון חי בין מכשירים
alter publication supabase_realtime add table public.pages;
alter publication supabase_realtime add table public.sections;
alter publication supabase_realtime add table public.tasks;
