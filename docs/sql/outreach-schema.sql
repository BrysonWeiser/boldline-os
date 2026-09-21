-- Cold outreach: the log of every attempt, and the queue fields on a prospect.
--
-- Lead Scout finds prospects (scout_prospects). This adds the other half: working
-- them. One row per ATTEMPT, ever, plus four columns on the prospect so the queue
-- can be asked "who is due today" with an index rather than by reading everything.
--
-- Owner-only, same model as scout_prospects: RLS is ON with NO policies, so only
-- the service-role key (used by the owner-JWT-gated outreach.mjs function) can
-- touch it.
--
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run; it is idempotent.

-- ── The attempt log ──────────────────────────────────────────────────────────
-- 🔴 A SEPARATE TABLE, NOT A COUNTER ON THE PROSPECT. The numbers that matter
-- (dials, conversations, meetings booked, meetings that SHOWED) are all counted
-- from history. A counter can only be incremented, so it can never be corrected,
-- and "we booked 9" with no way to see which 9 is not a number you can act on.
create table if not exists public.outreach_touches (
  id          uuid primary key default gen_random_uuid(),
  prospect_id uuid not null,                  -- scout_prospects.id (kept loose, like run_id)
  channel     text not null,                  -- call | email | dm | text
  outcome     text not null,                  -- see OUTCOMES in netlify/lib/outreach.mjs
  note        text,
  meeting_at  timestamptz,                    -- when a booked meeting is for
  -- 🔴 NULL MEANS "NOT KNOWN YET", AND THAT IS THE POINT. A booking is a promise and a
  -- show is the result. Defaulting this to false would quietly report every future
  -- meeting as a no-show; defaulting to true would inflate the one number a setter
  -- gets paid on. So it stays null until somebody says.
  showed      boolean,
  created_at  timestamptz not null default now()
);

create index if not exists outreach_touches_prospect_idx on public.outreach_touches (prospect_id, created_at desc);
create index if not exists outreach_touches_created_idx  on public.outreach_touches (created_at desc);
create index if not exists outreach_touches_outcome_idx  on public.outreach_touches (outcome);

alter table public.outreach_touches enable row level security;

-- ── The queue fields ─────────────────────────────────────────────────────────
-- Added to the existing prospect table so "who do I call next" is one indexed
-- query. All nullable: every prospect already on the list keeps working, and a
-- row with no next_due_at and no touches is simply due now.
alter table public.scout_prospects add column if not exists step          int;
alter table public.scout_prospects add column if not exists last_touch_at timestamptz;
alter table public.scout_prospects add column if not exists next_due_at   timestamptz;
alter table public.scout_prospects add column if not exists meeting_at    timestamptz;

-- 🔴 THE ONE WITH LEGAL WEIGHT. `status` is a sales stage and somebody can move it
-- back with a dropdown. "Take me off your list" must not be undoable by accident,
-- so it is its own column, and the code refuses to surface any row that has it set.
alter table public.scout_prospects add column if not exists blocked_at    timestamptz;

create index if not exists scout_prospects_due_idx     on public.scout_prospects (next_due_at);
create index if not exists scout_prospects_blocked_idx on public.scout_prospects (blocked_at);

-- ── The script ───────────────────────────────────────────────────────────────
-- One row, ever. The call script and the follow-up notes belong to the BUSINESS,
-- not to whichever browser typed them: the moment a setter is hired they are
-- reading the same script, and a script kept in local storage is one cleared
-- cache away from gone.
create table if not exists public.outreach_settings (
  id         int primary key default 1,
  script     text,
  updated_at timestamptz not null default now(),
  constraint outreach_settings_single_row check (id = 1)
);

alter table public.outreach_settings enable row level security;
