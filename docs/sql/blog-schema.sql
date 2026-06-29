-- BoldLine Media — Blog automation schema
--
-- HOW TO RUN THIS (one-time setup):
--   1. Open the Supabase dashboard for the BoldLine OS project.
--   2. Left sidebar → "SQL Editor" → "New query".
--   3. Paste this entire file in and click "Run".
-- That's it — this creates the two new tables and migrates the 3 blog posts
-- that currently live as hand-coded HTML on the marketing site into rows, so
-- the new AI-generated posts can sit alongside them. Safe to re-run: every
-- statement below is idempotent (CREATE IF NOT EXISTS / ON CONFLICT DO NOTHING).

create extension if not exists pgcrypto;

create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  excerpt text not null,
  meta_description text not null,
  body_html text not null,
  read_minutes integer not null default 5,
  status text not null default 'published'
    check (status in ('published', 'draft', 'deleted')),
  source text not null default 'manual'
    check (source in ('ai', 'manual')),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Speeds up the public listing query: newest published posts first.
create index if not exists blog_posts_listing_idx
  on blog_posts (status, published_at desc);

create table if not exists blog_settings (
  id integer primary key default 1,
  posts_per_week integer not null default 1,
  constraint blog_settings_singleton check (id = 1)
);

insert into blog_settings (id, posts_per_week)
values (1, 1)
on conflict (id) do nothing;

-- Seed data: the 3 posts that already exist as static HTML on the live site,
-- migrated in with their original slugs/content/category preserved exactly,
-- so every existing URL keeps working once the blog moves to the database.
-- published_at timestamps are staggered a second apart, oldest-to-newest, in
-- the same order the static site already displays them — so the switch to
-- the database-backed blog doesn't visibly reorder anything.

insert into blog_posts
  (slug, title, category, excerpt, meta_description, body_html, read_minutes, status, source, published_at)
values (
  'why-your-landing-page-matters',
  'Why Your Landing Page Matters More Than Your Ad',
  'Conversion',
  $excerpt$A great ad with a weak landing page just buys expensive clicks that go nowhere. Here's what a page actually needs to do to turn clicks into customers.$excerpt$,
  $meta$A great ad with a weak landing page just buys expensive clicks that go nowhere. Here's what a page actually needs to do to turn clicks into customers.$meta$,
  $body$<p>An ad has exactly one job: earn the click. Everything that determines whether that click turns into a customer happens on the page it lands on — and that's the part most businesses spend the least time thinking about.</p>

<h2>What happens when the ad points at your homepage</h2>
<p>A homepage is built to serve everyone who might ever visit — new customers, returning customers, job seekers, the business's own team. It has a menu of options because it has to. Someone who just clicked a paid ad doesn't want a menu; they want the one thing the ad promised, immediately. Sending paid traffic to a general homepage forces them to go find that thing themselves, and most won't bother.</p>

<h2>What a real campaign landing page does instead</h2>
<ul>
<li><strong>It matches the ad exactly.</strong> Same offer, same language, same image if there is one — no gap between what was promised and what showed up.</li>
<li><strong>It says one thing.</strong> One offer, one audience, one next step — no navigation menu pulling attention toward four other things.</li>
<li><strong>It makes the next step obvious in seconds.</strong> A call button, a short form, or a clear booking link — not buried, not after three paragraphs.</li>
<li><strong>It loads fast.</strong> Paid traffic is the least patient traffic on the internet. A slow page burns the click you already paid for.</li>
</ul>

<h2>This is also where trust gets won or lost</h2>
<p>A page that looks thrown together undercuts the ad that took real thought to write — it makes the whole business look smaller than it is. A page that looks deliberate does the opposite: it tells the visitor, before they've read a word, that this is a business that takes itself seriously.</p>

<h2>Why this is built into every plan, not sold as an add-on</h2>
<p>We don't treat the landing page as optional or upsell it separately — every tier of every package we offer includes one, because an ad campaign without a page built specifically for it is, in our view, an incomplete product. The page gets built and checked before a campaign ever goes live, not patched together afterward.</p>

<blockquote>The ad gets the click. The page gets the customer. Spending well on one and ignoring the other is the most common way to make advertising look like it "doesn't work" when the targeting was actually fine.</blockquote>

<h2>A quick self-check</h2>
<p>If you're running ads anywhere right now, three questions are worth asking honestly:</p>
<ul>
<li>Does the page someone lands on say the exact same thing the ad said?</li>
<li>Could a stranger figure out what to do next within five seconds, with no scrolling?</li>
<li>Would you personally call the number or fill out the form, if you were the one who clicked?</li>
</ul>
<p>If any answer is "not really," that's very likely costing more than the ad spend itself ever could.</p>$body$,
  5,
  'published',
  'manual',
  '2026-06-26T12:00:00+00:00'
)
on conflict (slug) do nothing;

insert into blog_posts
  (slug, title, category, excerpt, meta_description, body_html, read_minutes, status, source, published_at)
values (
  'google-ads-vs-meta-ads',
  'Google Ads vs. Meta Ads: Which Should You Start With?',
  'Strategy',
  $excerpt$The question we get asked most. The honest answer depends on whether your customers are searching for you or need to be introduced to you.$excerpt$,
  $meta$The question we hear most before a business signs up for anything. The honest answer depends on whether your customers search for you or need to be introduced to you.$meta$,
  $body$<p>This is the question we hear most before a business signs up for anything. There's no universal right answer, but there is a right way to think about it — and it has less to do with the platforms themselves than with how your customers actually find businesses like yours.</p>

<h2>Google Ads captures demand that already exists</h2>
<p>Someone searching "roof repair" or "best dog groomer near me" has already decided they want something — they're just deciding who gets the call. Google Ads puts you in front of that decision at the exact moment it's being made. It tends to work best for businesses with a clear, nameable need: home services, medical and dental, legal, automotive — anything someone would actively search for the moment the need shows up.</p>

<h2>Meta Ads creates demand that doesn't exist yet</h2>
<p>Nobody searches "cute ceramic plant pots" the way they search "emergency electrician." Meta Ads — Facebook and Instagram — works by interrupting someone's feed with something visually compelling enough to stop the scroll, before they were looking for it at all. It tends to work best for businesses that sell something visual, impulse-friendly, or benefit-driven: e-commerce, beauty and wellness, food and beverage — anything that sells well as a photo or a short video.</p>

<h2>The real question isn't "which platform" — it's "which behavior"</h2>
<p>Ask it this way instead: when someone needs what you sell, do they type a search, or do they need to be shown the idea before they know they want it? A plumber is almost always the first case. A boutique skincare brand is almost always the second. Plenty of businesses are a genuine mix of both — which is exactly why we run them as one coordinated system instead of two separate efforts competing for the same budget.</p>

<h2>Budget behaves differently on each platform</h2>
<p>Google Ads spend is driven by how many people are actively searching for what you offer — it has a ceiling set by real demand. Meta Ads spend is driven by how much reach and frequency you want against an audience you're choosing — it scales more linearly with budget. Neither is "cheaper" in the abstract; they're priced around fundamentally different jobs.</p>

<h2>If you can only start with one</h2>
<p>Start where the buying decision already happens. If customers actively search for businesses like yours, start with Google. If your product needs to be seen to be wanted, start with Meta. Either way, the landing page behind the ad matters just as much as the platform — see <a href="/blog/why-your-landing-page-matters/">our note on that here</a>.</p>

<blockquote>The businesses that get the most out of paid advertising usually end up running both — just not on day one, and not without a reason for each.</blockquote>

<h2>How we handle it</h2>
<p>We don't default every business to both platforms because it's easier to sell. Discovery is where we work out which behavior actually matches your business, and we'll tell you honestly if a single platform is the right call for now.</p>$body$,
  6,
  'published',
  'manual',
  '2026-06-26T12:00:01+00:00'
)
on conflict (slug) do nothing;

insert into blog_posts
  (slug, title, category, excerpt, meta_description, body_html, read_minutes, status, source, published_at)
values (
  'is-your-business-ready-for-google-ads',
  'Is Your Business Ready for Google Ads?',
  'Getting Started',
  $excerpt$Budget isn't the real qualifier. Here's what actually determines whether Google Ads will work for your business right now — and what to fix first if it won't.$excerpt$,
  $meta$Budget isn't the real qualifier for Google Ads. Here are the five things that actually determine whether your business is ready — and what to fix first if it isn't.$meta$,
  $body$<p>"Can I afford Google Ads?" is the wrong first question. The right one is whether the rest of your business is ready to make use of the clicks you'd be paying for. Budget decides how fast you can grow — it doesn't decide whether growth is possible yet. These five things matter more.</p>

<h2>You can name your offer in one sentence</h2>
<p>Google Ads rewards specificity. "We do home repairs" struggles. "Emergency water heater replacement, same-day" works — because it matches the exact thing someone just typed into Google. If you can't describe what you sell in a single, concrete sentence a stranger would understand immediately, that's the first thing to fix, before any ad spend.</p>

<h2>A lead can reach a real person quickly</h2>
<p>Paid search traffic is impatient by nature — someone searching "emergency plumber near me" is not browsing, they're deciding. If a call goes to voicemail or a form sits in an inbox for two days, the ad did its job and the business lost the lead anyway. Before turning ads on, it's worth being honest about who answers the phone, how fast, and what happens after hours.</p>

<h2>The page behind the ad can carry the click</h2>
<p>An ad's only job is to earn the click. What happens next is entirely the landing page's job — and a generic homepage rarely does it well, because it's built to say everything to everyone instead of one thing to the person who just clicked. The page needs to match the ad's exact promise, load fast, and make the next step obvious within a few seconds.</p>

<h2>The budget can run long enough to mean something</h2>
<p>Search advertising is closer to compounding than to a light switch. The first weeks are mostly data collection — which keywords actually convert, which don't, what a real customer costs to acquire. A budget that gets pulled after two or three weeks rarely survives long enough to find out whether the offer actually works in paid search; it just measures the learning period and calls it a verdict.</p>

<h2>Someone is willing to look at the numbers and adjust</h2>
<p>Campaigns that run untouched degrade. Campaigns that get reviewed on a real cadence — what's spending, what's converting, what's wasted — improve. That doesn't have to be the business owner doing it personally, but it has to be someone's actual job, not an afterthought squeezed in once a quarter.</p>

<blockquote>None of this is about being a big company. A two-person shop with a sharp offer and a fast follow-up will outperform a much bigger competitor that's sloppy about both.</blockquote>

<h2>How we approach this</h2>
<p>Every engagement starts the same way regardless of budget: a Discovery step where we work through exactly these questions before a campaign structure gets built or a dollar moves. If something isn't ready yet — the offer's too broad, the follow-up process has gaps — we'll say so directly rather than launch anyway and let the budget find out the hard way.</p>
<p>If you're not sure where your business stands on these five points, that's a fair thing to find out before spending anything.</p>$body$,
  5,
  'published',
  'manual',
  '2026-06-26T12:00:02+00:00'
)
on conflict (slug) do nothing;
