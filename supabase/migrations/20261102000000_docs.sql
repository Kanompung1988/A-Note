-- A-Note keeps each record as a JSON document in one table, keyed by collection.
-- Only the server (service role) reads or writes it; RLS with no policies blocks everyone else.
create table if not exists public.docs (
  collection text not null,
  id text not null,
  class_id text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists docs_class_idx on public.docs (collection, class_id);
create index if not exists docs_code_idx on public.docs ((data ->> 'code')) where collection = 'classes';

alter table public.docs enable row level security;

-- Worksheet images and generated pages, served through /api/files/[id].
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;
