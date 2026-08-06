-- OS Calendar: manually-added events (meetings / tasks / reminders the owner
-- drops on the calendar by hand). Especially useful while Calendly stays on the
-- free plan (no API sync). Owner-only: the table is service-role-write via
-- netlify/functions/calendar.mjs, with RLS on and NO public policies (same
-- model as newsletter_emails / deal_briefs).
--
-- Run this ONCE in the Supabase SQL Editor (safe to re-run; it's idempotent).

create table if not exists public.calendar_events (
  id         uuid primary key default gen_random_uuid(),
  event_date date not null,
  event_time text,                       -- optional "HH:MM" (local); null = all-day
  title      text not null,
  note       text,
  kind       text not null default 'other', -- meeting | task | reminder | other
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_date_idx on public.calendar_events (event_date);

alter table public.calendar_events enable row level security;
-- No policies on purpose: only the service-role key (used by the owner-JWT-gated
-- calendar.mjs function) can read or write these rows.
