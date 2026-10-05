-- Review requests: one row per "please leave us a Google review" email asked for a client's
-- customer. See netlify/lib/review-requests.mjs for every rule.
--
-- 🔴 A TABLE OF ITS OWN, NOT A LIST ON THE CLIENT RECORD. The OS saves a client by writing the
-- whole record back from the browser, which may be up to a refresh behind. A send status kept on
-- the record could be quietly rolled back from "sent" to "queued", and the customer would get the
-- same email twice; an unsubscribe could be rolled back the same way, which is a legal problem.
-- Rows here are only ever changed by the server, one row at a time.
--
-- Owner-only, same model as scout_prospects and outreach_touches: RLS is ON with NO policies, so
-- only the service-role key (used by the functions) can touch it.
--
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run; it is idempotent.

create table if not exists public.review_requests (
  id           uuid primary key default gen_random_uuid(),
  client_id    text not null,                    -- clients.id
  name         text,
  email        text not null,                    -- always lower case
  source       text not null default 'owner',
  -- queued | sending | sent | reminding | reminded | stopped | failed | opted_out
  status       text not null default 'queued',
  token        text not null,                    -- the secret in the unsubscribe link
  attempts     int  not null default 0,
  last_error   text,
  created_at   timestamptz not null default now(),
  claimed_at   timestamptz,                      -- when a send started; a stale one crashed mid-send
  sent_at      timestamptz,
  reminded_at  timestamptz,
  stopped_at   timestamptz,
  opted_out_at timestamptz
);

create unique index if not exists review_requests_token_idx  on public.review_requests (token);
create index if not exists review_requests_client_idx        on public.review_requests (client_id, created_at desc);
create index if not exists review_requests_status_idx        on public.review_requests (status);
create index if not exists review_requests_pair_idx          on public.review_requests (client_id, email);

alter table public.review_requests enable row level security;
