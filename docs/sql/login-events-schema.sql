-- BoldLine OS — sign-in location history (for the suspicious-login alert).
-- One idempotent paste into the Supabase SQL Editor. Safe to run more than once.
--
-- Every owner sign-in records its geolocation (from Netlify's edge geo). If a
-- sign-in comes from a country/region never seen before, the OS emails an alert.

create table if not exists login_events (
  id              uuid primary key default gen_random_uuid(),
  ip              text,
  city            text,
  region          text,
  country         text,
  is_new_location boolean default false,
  created_at      timestamptz not null default now()
);

create index if not exists login_events_created_idx on login_events (created_at desc);

-- RLS on, no public policies: only the service-role key (login-watch function) touches it.
alter table login_events enable row level security;
