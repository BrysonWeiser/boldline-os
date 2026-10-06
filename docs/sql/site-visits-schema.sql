-- Website visits: one row per page view on a client website BoldLine built (KB `website-builder`).
-- Feeds the "Your website" visitor numbers in the client portal.
--
-- 🔴 PRIVATE BY DESIGN. No cookies, no IP address and no browser fingerprint are stored. `visitor` is a
-- one-way hash of (IP, browser, day, site) that changes every day, so it can count "people today" but can
-- never follow anyone across days or sites. Bots and previews are never recorded.
--
-- Owner-only, same model as review_requests: RLS ON with NO policies, so only the service-role key (used by
-- the functions) can read or write it.
--
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run; it is idempotent.

create table if not exists public.site_visits (
  id         bigserial primary key,
  client_id  text not null,                   -- clients.id
  at         timestamptz not null default now(),
  path       text not null default '/',       -- the page within their site, e.g. /services/
  source     text not null default 'Direct',  -- Search | Google Ads | Social | Direct | Other sites | Internal
  device     text not null default 'desktop', -- mobile | tablet | desktop
  visitor    text                             -- daily-rotating hash, see above
);

create index if not exists site_visits_client_at on public.site_visits (client_id, at desc);

alter table public.site_visits enable row level security;
