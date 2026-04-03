-- Run this in Supabase SQL Editor

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  model text not null default 'gemini-2.5-flash-native-audio',
  voice text not null default 'Puck',
  system_prompt text not null default '',
  vad_sensitivity text not null default 'medium',
  silence_duration_ms integer not null default 300,
  allow_interruptions boolean not null default true,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references public.pipelines(id) on delete cascade not null,
  type text not null,
  name text not null,
  config jsonb not null default '{}',
  extracted_context text,
  created_at timestamptz not null default now()
);

create table public.deployments (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid references public.pipelines(id) on delete cascade not null,
  slug text unique not null,
  embed_enabled boolean not null default true,
  phone_number text,
  status text not null default 'live',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger (pipelines)
-- ---------------------------------------------------------------------------

create or replace function public.set_pipelines_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger pipelines_updated_at
  before update on public.pipelines
  for each row
  execute function public.set_pipelines_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helper functions (SECURITY DEFINER — bypass RLS to avoid recursion)
-- ---------------------------------------------------------------------------

-- Check if the current user owns a given pipeline
create or replace function public.owns_pipeline(pid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.pipelines where id = pid and user_id = auth.uid()
  );
$$;

-- Check if a pipeline has a live, embeddable deployment
create or replace function public.pipeline_is_public(pid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.deployments
    where pipeline_id = pid and embed_enabled = true and status = 'live'
  );
$$;

-- Check if a deployment is live and embeddable
create or replace function public.deployment_is_public(did uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.deployments
    where id = did and embed_enabled = true and status = 'live'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.pipelines enable row level security;
alter table public.data_sources enable row level security;
alter table public.deployments enable row level security;

-- pipelines: owners only
create policy "pipelines_select_own"
  on public.pipelines for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "pipelines_insert_own"
  on public.pipelines for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "pipelines_update_own"
  on public.pipelines for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "pipelines_delete_own"
  on public.pipelines for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- pipelines: public access via live deployment (uses SECURITY DEFINER helper)
create policy "pipelines_select_public"
  on public.pipelines for select
  to anon
  using (public.pipeline_is_public(id));

create policy "pipelines_select_public_authenticated"
  on public.pipelines for select
  to authenticated
  using (public.pipeline_is_public(id));

-- data_sources: via owning pipeline (uses SECURITY DEFINER helper)
create policy "data_sources_select_own"
  on public.data_sources for select
  to authenticated
  using (public.owns_pipeline(pipeline_id));

create policy "data_sources_insert_own"
  on public.data_sources for insert
  to authenticated
  with check (public.owns_pipeline(pipeline_id));

create policy "data_sources_update_own"
  on public.data_sources for update
  to authenticated
  using (public.owns_pipeline(pipeline_id))
  with check (public.owns_pipeline(pipeline_id));

create policy "data_sources_delete_own"
  on public.data_sources for delete
  to authenticated
  using (public.owns_pipeline(pipeline_id));

-- data_sources: public read for public pipelines
create policy "data_sources_select_public"
  on public.data_sources for select
  to anon
  using (public.pipeline_is_public(pipeline_id));

create policy "data_sources_select_public_authenticated"
  on public.data_sources for select
  to authenticated
  using (public.pipeline_is_public(pipeline_id));

-- deployments: owners CRUD (uses SECURITY DEFINER helper)
create policy "deployments_select_own"
  on public.deployments for select
  to authenticated
  using (public.owns_pipeline(pipeline_id));

create policy "deployments_insert_own"
  on public.deployments for insert
  to authenticated
  with check (public.owns_pipeline(pipeline_id));

create policy "deployments_update_own"
  on public.deployments for update
  to authenticated
  using (public.owns_pipeline(pipeline_id))
  with check (public.owns_pipeline(pipeline_id));

create policy "deployments_delete_own"
  on public.deployments for delete
  to authenticated
  using (public.owns_pipeline(pipeline_id));

-- deployments: public read for live embeddable
create policy "deployments_select_public_anon"
  on public.deployments for select
  to anon
  using (embed_enabled = true and status = 'live');

create policy "deployments_select_public_authenticated"
  on public.deployments for select
  to authenticated
  using (embed_enabled = true and status = 'live');

-- ---------------------------------------------------------------------------
-- Storage: bucket pipeline-files (public URLs; access for authenticated users)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('pipeline-files', 'pipeline-files', true)
on conflict (id) do nothing;

create policy "pipeline_files_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'pipeline-files');

create policy "pipeline_files_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'pipeline-files');

create policy "pipeline_files_update_authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'pipeline-files')
  with check (bucket_id = 'pipeline-files');

create policy "pipeline_files_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'pipeline-files');

create policy "pipeline_files_select_public"
  on storage.objects for select
  to anon
  using (bucket_id = 'pipeline-files');
