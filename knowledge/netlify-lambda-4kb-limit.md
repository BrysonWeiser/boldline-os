---
name: netlify-lambda-4kb-limit
topic: Deploys
task: fix/avoid the Netlify "environment variables exceed the 4KB limit imposed by AWS Lambda" deploy failure
keywords: [netlify, lambda, 4kb, environment variables, deploy failed, exports.handler, withLambda, lambda-adapter, modern functions runtime, compatibility mode, aria, portal]
status: verified
summary: Classic-style Netlify functions (exports.handler = async(event)=>{...}) run in AWS "Lambda compatibility mode," which caps the TOTAL size of ALL env vars at 4KB. Every site env var is injected into every function, so once the OS's secrets (DocuSign key + Google Ads creds + GA4 service-account JSON …) crossed 4KB, the two classic functions (aria, portal) failed to deploy — even though they don't use the big vars. Fix: move them to the MODERN runtime (export default async(req)=>Response), which has no such limit. Done via a tiny in-repo adapter netlify/lib/lambda-adapter.mjs (withLambda) that keeps each handler body 100% unchanged.
verified: 2026-07-23
---

**The failure (2026-07-23, while wiring GA4 into the OS):** adding `GA4_SERVICE_ACCOUNT_JSON` (a ~2KB service-account key) to Netlify env vars broke the deploy:
```
Failed to create function: invalid parameter for function creation: Your
environment variables exceed the 4KB limit imposed by AWS Lambda…
Failed to upload file: portal
Failed to upload file: aria
```

**Root cause:** Netlify runs a function in **"Lambda compatibility mode"** when it uses the classic AWS Lambda signature `exports.handler = async (event, context) => ({ statusCode, headers, body })`. That mode inherits **AWS Lambda's hard 4KB total env-var limit**. Netlify injects **every** site env var into **every** function, so a big secret bloats even functions that never read it. Functions on the **modern runtime** (`export default async (req, context) => Response`) have **no** such limit. Lambda-compat mode is also **deprecated (retires July 1 2027)**, so migrating is the right direction regardless.

Only **two** functions were still classic-style: `aria.js` and `portal.js` (all other 20 were already modern `.mjs`). So the two of them were the whole problem.

**The fix (chosen over the alternatives):**
- ❌ Reduce env vars under 4KB — fragile; the account already sits near the ceiling, so any future secret re-breaks it.
- ❌ `@netlify/aws-lambda-compat` package — works, but adds a dependency whose exact version/API is an install-time risk.
- ✅ **A tiny in-repo adapter, no dependency.** `netlify/lib/lambda-adapter.mjs` exports `withLambda(handler)` — it builds an `event` (`httpMethod`, `headers`, `queryStringParameters`, `body`, `path`, `rawUrl`) from the incoming `Request` and turns the handler's `{ statusCode, headers, body }` back into a `Response`. Each handler BODY is unchanged.

**What changed:**
- `aria.js` → **`aria.mjs`**: `require("@anthropic-ai/sdk")` → `import Anthropic from …`; `exports.handler = async (event) =>` → `const handler = async (event) =>`; added `import { withLambda } from "../lib/lambda-adapter.mjs"` + `export default withLambda(handler);`.
- `portal.js` → **`portal.mjs`**: same pattern; `require("@supabase/supabase-js")`/`require("../lib/contract-shared.cjs")` → `import …`; `exports._internal = {…}` → `export const _internal = {…}`.
- The function **names stay `aria` / `portal`** (Netlify uses the filename minus extension), so the `netlify.toml` `/portal` redirect and every `fetch("/.netlify/functions/aria" | "…/portal")` in index.html keep working with **no** change. Nothing in the repo `require()`s these files, so the rename broke no importer.

**Gotchas confirmed OK:**
- **ESM importing a `.cjs`:** `import { makeContractHTML } from "../lib/contract-shared.cjs"` resolves — Node's cjs-module-lexer detects `module.exports = { makeContractHTML }` (tested at runtime, returned a function). If a future `.cjs` uses a non-static export shape, switch to `import pkg from "./x.cjs"; const { … } = pkg;`.
- The adapter only covers what our handlers use (no binary/base64 body, no multiValue headers) — keep it minimal; extend only if a migrated handler needs more.

**Rule going forward:** write ALL new Netlify functions in the modern `export default async (req)` form (`.mjs`). Never add a new `exports.handler` classic function — it re-introduces the 4KB ceiling for the whole site.