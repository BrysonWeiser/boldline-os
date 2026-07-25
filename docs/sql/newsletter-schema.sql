-- BoldLine OS — newsletter (email list) schema.
-- One idempotent paste into the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).
-- Safe to run more than once.

-- Companion emails: exactly one per blog post (post_slug is unique). Each is the
-- weekly "here's a tip, read more" email that promotes that week's blog post.
create table if not exists newsletter_emails (
  id                 uuid primary key default gen_random_uuid(),
  post_slug          text unique,                 -- the blog post this email promotes (1:1); null = standalone
  subject            text not null,
  preview            text,                         -- inbox preview line
  body_html          text not null,
  status             text not null default 'draft'
                       check (status in ('draft','scheduled','sent','deleted')),
  scheduled_for      timestamptz,                  -- when it should send
  sent_at            timestamptz,
  recipients         int,                          -- how many it went to (filled at send)
  resend_broadcast_id text,                        -- Resend Broadcast id (filled at send)
  source             text not null default 'ai' check (source in ('ai','manual')),
  created_at         timestamptz not null default now()
);

create index if not exists newsletter_emails_status_idx on newsletter_emails (status);
create index if not exists newsletter_emails_sched_idx  on newsletter_emails (scheduled_for);

-- RLS on, no public policies: only the service-role key (used by the OS's
-- newsletter-admin / autopublish functions) can read/write — same model as blog_posts.
alter table newsletter_emails enable row level security;
