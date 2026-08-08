-- Public reviews/testimonials for boldlinemedia.com. Visitors submit via the
-- marketing site (review-submit) as status='pending'; Bryson approves them in the
-- OS Website tab (reviews-admin); approved ones are served to the public site by
-- reviews-list. Run once in the Supabase SQL Editor. Safe to re-run (idempotent).

create table if not exists reviews (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text,
  business    text,
  rating      int,                               -- 1..5
  body        text not null,
  email       text,
  source      text not null default 'website',
  status      text not null default 'pending',   -- pending | approved | rejected
  featured    boolean not null default false
);
create index if not exists reviews_status_idx on reviews (status, featured desc, created_at desc);

alter table reviews enable row level security;
-- No policies on purpose: every function that touches this table uses the
-- service-role key (which bypasses RLS), exactly like blog_posts. The public site
-- only ever sees APPROVED rows, and only through the reviews-list function — never
-- direct table access. So the anon/public role gets nothing.
