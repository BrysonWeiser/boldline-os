-- One-time cleanup: strip em-dashes ( the "—" character ) from any blog posts
-- already living in Supabase. Our seed file used ON CONFLICT DO NOTHING, so
-- re-running the schema will NOT update existing rows; this UPDATE does.
--
-- It replaces "—" (with any spaces around it) by ", " so spacing stays clean,
-- and only touches rows that actually contain one. Safe to run more than once.
--
-- HOW TO RUN: Supabase dashboard -> your project -> SQL Editor -> New query ->
-- paste this -> Run.

update blog_posts set
  title            = regexp_replace(title,            '\s*—\s*', ', ', 'g'),
  excerpt          = regexp_replace(excerpt,          '\s*—\s*', ', ', 'g'),
  meta_description = regexp_replace(meta_description, '\s*—\s*', ', ', 'g'),
  body_html        = regexp_replace(body_html,        '\s*—\s*', ', ', 'g')
where title            like '%—%'
   or excerpt          like '%—%'
   or meta_description like '%—%'
   or body_html        like '%—%';

-- Verify none remain (should return 0):
-- select count(*) from blog_posts
--  where title like '%—%' or excerpt like '%—%'
--     or meta_description like '%—%' or body_html like '%—%';
