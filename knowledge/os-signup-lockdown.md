---
name: os-signup-lockdown
topic: Security
task: make sure nobody but Bryson can get into the OS (sign-ups, new logins, who a demo link can reach)
keywords: [security, sign up, signup, sign-ups, disable signup, allow new users to sign up, supabase auth, new login, rogue account, who can access the os, os access, login lockdown, auth settings, auth/v1/settings, listUsers, daily check, publishable key]
status: CLOSED 2026-11-06 (Bryson switched sign-ups off; verified live disable_signup true)
summary: Found 2026-11-05 while checking that a demo link can't reach the OS. Supabase still had public sign-ups ON (disable_signup false, email provider on), and the OS page carries the public database key, so anyone who read the page could create their own login, confirm it by email, and pass every "is this a signed-in user?" check in ~49 OS functions plus every table policy granted to signed-in users. Nothing in the OS creates users, so turning sign-ups off breaks nothing. The daily check now fails (red alert) while sign-ups are on, and names any login created in the last 26 hours.
verified: 2026-11-05
---

## What was found (2026-11-05)
- `GET <supabase>/auth/v1/settings` (public, read-only) answered `"disable_signup": false`, `"email": true`,
  `"mailer_autoconfirm": false`. So a stranger could sign up through the API with the publishable key that is in
  `index.html`, click the confirmation email, and be "authenticated".
- Most OS functions only check `supabase.auth.getUser(jwt)` returns a user (any user). Row-level policies on some tables
  (e.g. `website_leads`) grant the signed-in role read/update/delete. So that account would see and change real data.
- Nothing in the repo calls `signUp`, `admin.createUser` or invites, so sign-ups off is safe.

## The fix (Bryson's click, in Supabase, not Netlify)
1. supabase.com > the BoldLine project > **Authentication** (left menu) > **Sign In / Providers**.
2. **Allow new users to sign up**: switch OFF. **Save changes**.
3. Same left menu > **Users**: only his own login(s) should be there. Anything else: tell Claude before deleting.
Verify: `curl -s <supabase>/auth/v1/settings -H "apikey: <publishable key from index.html>"` shows `"disable_signup":true`.

## Enforced, not remembered
- `daily-check.mjs` `signupCheck()` + `newLogins()`: "🔴 Nobody can create their own login to the OS" fails while
  sign-ups are on; "🔴 No new OS login appeared in the last day" fails naming the email. Pinned by
  `tests/verify-demo-host.mjs` section 6.
- Not done (deliberately): an owner-only check inside every function. With sign-ups off and the new-login alarm, it
  would be a large change across ~49 functions for little extra; revisit if Bryson ever adds a second user.

## Related
- Demo links moved off the OS's address the same day (KB `demo-sites`, "Demo host").
- Sign-ins from a new place already alert (KB `suspicious-login-alert`).

## Done (Fri 2026-11-06 evening, Phoenix)
Bryson: "supabase is done". Verified from outside the same evening: `auth/v1/settings` answers `"disable_signup":true`.
He did not report any unexpected login in the Users list. The daily check's sign-up row should now pass; the
new-login row keeps watching.
