-- AI Lead Scout: the prospect scraper that feeds Deal Prep.
--
-- Two tables. `scout_runs` is one row per search you kick off (status + live
-- progress + the run summary). `scout_prospects` is the durable call list — one
-- row per business, ever. Owner-only: RLS is ON with NO policies, so only the
-- service-role key (used by the owner-JWT-gated lead-scout functions) can touch
-- them. Same model as deal_briefs / calendar_events / newsletter_emails.
--
-- Run this ONCE in the Supabase SQL Editor (safe to re-run; it's idempotent).

create table if not exists public.scout_runs (
  id          text primary key,             -- client-generated run id the OS polls on
  status      text not null default 'running',  -- running | done | error
  niche       text,
  niche_group text,
  areas       jsonb,                        -- the exact area strings that were requested
  options     jsonb,                        -- count, filters, nicheKind, notes
  progress    jsonb,                        -- {stage, message, found, enriched, total} — live
  result      jsonb,                        -- prospects + stats + coverage note
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists scout_runs_created_idx on public.scout_runs (created_at desc);

create table if not exists public.scout_prospects (
  id          uuid primary key default gen_random_uuid(),
  run_id      text,                         -- which search found it (kept loose: deleting a run keeps the prospect)
  dedupe_key  text not null unique,         -- normalized "business name|city" — THE duplicate guarantee
  name        text not null,
  domain      text,                         -- normalized host, used as a second duplicate check
  niche       text,
  area        text,                         -- the requested area it was matched to
  score       int  not null default 0,      -- 0-100 "should I call them"
  tier        text,                         -- call_first | strong | maybe | low | skip
  status      text not null default 'new',  -- new | contacted | meeting | client | dead
  data        jsonb not null default '{}',  -- the full researched record
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The unique index on dedupe_key is what makes "never has duplicates" a database
-- guarantee rather than a hopeful filter: a re-run that rediscovers the same
-- business is skipped on insert (upsert ... ignoreDuplicates) instead of adding
-- a second copy. Deleting a prospect frees its key so it can be found again.
create index if not exists scout_prospects_score_idx  on public.scout_prospects (score desc);
create index if not exists scout_prospects_niche_idx  on public.scout_prospects (niche);
create index if not exists scout_prospects_area_idx   on public.scout_prospects (area);
create index if not exists scout_prospects_status_idx on public.scout_prospects (status);
create index if not exists scout_prospects_domain_idx on public.scout_prospects (domain);
create index if not exists scout_prospects_run_idx    on public.scout_prospects (run_id);

alter table public.scout_runs      enable row level security;
alter table public.scout_prospects enable row level security;
-- No policies on purpose: only the service-role key (used by the owner-JWT-gated
-- lead-scout.mjs / lead-scout-background.mjs functions) can read or write these.
