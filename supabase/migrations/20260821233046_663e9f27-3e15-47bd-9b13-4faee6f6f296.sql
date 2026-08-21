create table if not exists public.photo_edits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  asset_key text not null,
  source_path text not null,
  adjustments jsonb not null default '{}'::jsonb,
  crop jsonb,
  rotation integer not null default 0,
  flip_h boolean not null default false,
  ai_ops jsonb not null default '[]'::jsonb,
  edited_path text,
  revision integer not null default 1,
  is_copy boolean not null default false,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.photo_edits to authenticated;
grant all on public.photo_edits to service_role;

alter table public.photo_edits enable row level security;

create policy "Users read own photo edits" on public.photo_edits for select to authenticated using (user_id = auth.uid());
create policy "Users create own photo edits" on public.photo_edits for insert to authenticated with check (user_id = auth.uid());
create policy "Users update own photo edits" on public.photo_edits for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users delete own photo edits" on public.photo_edits for delete to authenticated using (user_id = auth.uid());

create unique index if not exists photo_edits_active_key on public.photo_edits (user_id, asset_key) where is_copy = false;
create index if not exists photo_edits_user_updated on public.photo_edits (user_id, updated_at desc);