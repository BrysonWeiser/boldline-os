---
name: os-screen-routing
topic: OS app
task: add a new page/screen to the OS, wire navigation, or find how the OS switches screens
keywords: [screen, routing, navigation, setScreen, HomeScreen, RevenueScreen, ClientHub, BottomNav, revenue, MRR, breakdown, sub-page]
status: verified
summary: How the OS app (index.html) routes between top-level screens, and how the Revenue-by-Client breakdown page was added as a home sub-page. The App component holds one `screen` string in useState and conditionally renders each screen; BottomNav sets it. To add a page, add a component, a `screen==="x"` render line, and a setter passed as a prop.
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

**Verify** new screens with the render harness (`os-screenshot-harness`) — it now taps the MRR card and captures `os-revenue-mobile.png`.
