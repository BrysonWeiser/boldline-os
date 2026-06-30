-- BoldLine's own inbound leads from the marketing website (boldlinemedia.com
-- contact form + the "find your fit" quiz). This is SEPARATE from per-client
-- customer leads (those live on each client record). Run once in the Supabase
-- SQL Editor. Safe to re-run (idempotent).

create table if not exists website_leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  form        text not null default 'contact',   -- 'contact' | 'recommendation'
  name        text,
  business    text,
  email       text,
  message     text,
  recommended text,
  status      text not null default 'new',        -- new | contacted | won | lost | archived
  notes       text,
  payload     jsonb
);
create index if not exists website_leads_created_idx on website_leads (created_at desc);

alter table website_leads enable row level security;

-- The OS reads/manages leads as a logged-in (authenticated) user via the
-- publishable key. The marketing site inserts via the service-role key, which
-- bypasses RLS entirely, so we only need policies for authenticated reads and
-- edits. The public/anon role gets nothing (leads stay private).
drop policy if exists website_leads_auth_select on website_leads;
create policy website_leads_auth_select on website_leads
  for select to authenticated using (true);

drop policy if exists website_leads_auth_update on website_leads;
create policy website_leads_auth_update on website_leads
  for update to authenticated using (true) with check (true);

drop policy if exists website_leads_auth_delete on website_leads;
create policy website_leads_auth_delete on website_leads
  for delete to authenticated using (true);

-- Add to the realtime publication so the OS sees new leads instantly (it also
-- polls every 15s as a fallback, so this is a nice-to-have, not required).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'website_leads'
  ) then
    alter publication supabase_realtime add table website_leads;
  end if;
end $$;
