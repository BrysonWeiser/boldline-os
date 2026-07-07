---
name: os-screen-routing
topic: OS app
task: add a new page/screen to the OS, wire navigation, change desktop vs mobile layout, or find how the OS switches screens
keywords: [screen, routing, navigation, setScreen, HomeScreen, RevenueScreen, SegmentScreen, ClientHub, BottomNav, SideNav, revenue, MRR, breakdown, sub-page, desktop, sidebar, useIsDesktop, responsive, grid, layout, tiles, alerts, expiring]
status: verified
summary: How the OS app (index.html) routes between top-level screens, how the Revenue-by-Client page was added, and how the desktop layout works — ≥1024px gets a sidebar shell (SideNav) + multi-column grids via a useIsDesktop() hook while mobile keeps the BottomNav single-column layout untouched.
verified: 2026-07-07
---

**Routing model.** `App({onLogout})` (~line 3642 in index.html) holds `const [screen,setScreen]=useState("home")`. It renders each screen conditionally inside the `.os-content` wrapper:
```
{screen==="home"    && <HomeScreen .../>}
{screen==="revenue" && <RevenueScreen .../>}
{screen==="client"  && activeClient && <ClientHub .../>}
{screen==="leads"   && <LeadsScreen .../>}
{screen==="website" && <WebsiteScreen/>}
```
`<BottomNav screen={screen} onHome/onLeads/onWebsite .../>` is the persistent tab bar (home / leads / website + notif + ARIA). Client selection: `selectClient(cl)` sets `activeClient` + `screen="client"`. There's no router/URL — it's pure state, so a "page" = a component + one render line + a setter prop.

**To add a page (recipe used for Revenue):**
1. Write the component (e.g. `RevenueScreen({clients,onSelect,onBack})`), placed near the other screen components.
2. Add a render line `{screen==="revenue" && <RevenueScreen .../>}` in App's `.os-content`.
3. Pass a setter into whatever triggers it (e.g. `HomeScreen` got a new `onRevenue={()=>setScreen("revenue")}` prop; the MRR hero card became a `<button onClick={onRevenue}>`).
4. Give the new screen its own back button → `onBack={()=>setScreen("home")}` (mirror ClientHub's `‹` back-button style: 32×32 rounded, `rgba(255,255,255,0.05)` bg). Sub-pages of home don't light up a BottomNav tab — that's fine.

**Revenue-by-Client page (2026-07-07).** Tapping the home **Monthly Recurring Revenue** hero card (now a button with a "Breakdown ›" affordance) opens `RevenueScreen`: a total-MRR hero, then one row per client **sorted by fee high→low**, each showing the client's monthly management fee (`findPkg(cl.packageId).price`), package name · platform, setup fee, and a share-of-revenue mini-bar (`price/MRR`). Rows are buttons → `onSelect(cl)` deep-links into that client's hub. MRR = `clients.reduce((s,c)=>s+(findPkg(c.packageId).price||0),0)` — same formula as the home hero and ARIA. Per-client revenue is the **package price only** (management fee); this matches the hard business rule that BoldLine never touches client ad spend, so ad budget is never counted as BoldLine revenue.

**Stat-tile segments (2026-07-07).** The dashboard's Alerts / Expiring / Clients tiles are buttons → `onSegment(k)` sets `segment` state + `screen="segment"`, rendering `SegmentScreen({mode,clients,onSelect,onBack,isDesktop})` — ONE component, three modes (don't add per-tile screens): `alerts` = clients with `getAlerts(cl).length>0`, red-severity first, alert messages inline; `expiring` = `0≤daysUntil(contractEnd)≤30` sorted most-urgent-first with "Xd left" + end date; `clients` = full roster A–Z with stage chip + health. Rows deep-link via `onSelect(cl)`. Tile labels render as "Alerts ›" etc. (the › is the affordance; the harness locates the tile by that text).

**Desktop layout (2026-07-07).** The OS is no longer a stretched phone column on desktop. `useIsDesktop(bp=1024)` (a matchMedia hook next to `App`) is the single source of truth; `App` passes `isDesktop` down to every screen. On desktop:
- **`SideNav`** (persistent left rail, 236px, sticky) replaces `BottomNav` — Dashboard / Revenue / Leads / Website + Alerts / ARIA / Log Out with the same badges. `BottomNav` renders only when `!isDesktop`; Revenue is a first-class sidebar item there.
- The App root switches `flexDirection:"column",maxWidth:640` (mobile) → `row` full-width with a `maxWidth:1200` centered content column. **Key trick:** the extra desktop content wrapper uses `style={{display:"contents"}}` on mobile, so the mobile DOM/layout is byte-for-byte unchanged.
- HomeScreen: mobile brand header is replaced by a "Dashboard" page title (brand lives in the sidebar); MRR hero + 3 stat tiles form ONE grid row (`1.6fr 1fr 1fr 1fr`); client cards flow in `repeat(auto-fill,minmax(340px,1fr))`.
- RevenueScreen: rows grid at `minmax(360px,1fr)`; back button hidden on desktop (sidebar handles nav). LeadsScreen grids at `minmax(380px,1fr)`.
- ClientHub scroll body is width-capped at 1000px + centered (detail views read better narrow).
- Toasts: bottom-right on desktop (bottom-left overlapped the sidebar), unchanged on mobile.
Gotcha: keep `useIsDesktop` breakpoint aligned with the CSS `@media(min-width:1025px)` vars already in the app. And remember `.os-card` hover uses transform — never put it on an ancestor of a `position:fixed` overlay (see `os-overlay-mobile-gotchas`).

**Verify** new screens with the render harness (`os-screenshot-harness`) — desktop context is 1440×900 (must be >1024 or the sidebar won't render); it captures home/revenue/client/leads desktop + the mobile flow.
