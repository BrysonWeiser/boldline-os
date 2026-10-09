// The AI website editor (KB `site-editor`, rules and the change menu in ../lib/site-ai.mjs).
// A `-background` function: Netlify answers 202 at once and lets it run up to 15 minutes, because a thoughtful
// answer about a whole website takes longer than a normal function may run. The answer goes on the record at
// `data.siteAiJob` (server-owned; the OS never saves over it) and the OS polls site-ai-poll for it.
// POST { clientId, jobId, messages: [{role, text}], draft } with the owner's session.
// 🔴 It never touches the website itself: it returns a new DRAFT, which the OS previews and he chooses to save.
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../lib/report-shared.mjs";
import { isOwned } from "../lib/owned.mjs";
import { termsOf } from "../lib/website-deal.mjs";
import { homeLayout } from "../lib/site-render.mjs";
import { humanize, humanizeDeep, NO_DASH_RULE } from "../lib/humanize.mjs";
import { SITE_AI_MODEL, SITE_AI_TOOL, siteAISystem, applySiteOps, cleanAnswer } from "../lib/site-ai.mjs";

const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

async function writeJob(db, clientId, job) {
  const { data: row } = await db.from("clients").select("data").eq("id", clientId).maybeSingle();
  if (!row || !row.data) return;
  const { error } = await db.from("clients").update({ data: { ...row.data, siteAiJob: job }, updated_at: new Date().toISOString() }).eq("id", clientId);
  if (error) console.error("site-ai-background: could not store the answer:", error.message);
}

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!jwt) return json({ ok: false, error: "Not signed in" }, 401);
  const db = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: u, error: ae } = await db.auth.getUser(jwt);
  if (ae || !u || !u.user) return json({ ok: false, error: "Not signed in" }, 401);
  let body = {}; try { body = await req.json(); } catch (e) {}
  const clientId = String(body.clientId || ""), jobId = String(body.jobId || "").slice(0, 60);
  const { data: row } = await db.from("clients").select("data").eq("id", clientId).maybeSingle();
  // His own businesses, and clients on the Signature website (the premium tier the AI editor is part of).
  if (!row || !row.data) return json({ ok: false, error: "That business could not be found." }, 404);
  if (!isOwned(row.data) && termsOf(row.data).tier !== "signature") return json({ ok: false, error: "The AI editor comes with the Signature website." }, 403);
  const cl = { ...row.data, id: clientId };
  const d0 = body.draft || {};
  const draft = { content: d0.content || (cl.website || {}).content || {}, layout: d0.layout || {}, blocks: Array.isArray(d0.blocks) ? d0.blocks : [], photoPick: d0.photoPick || {} };
  const photos = [
    ...((cl.mediaLibrary || []).filter((m) => m && m.category === "photo" && /^https:\/\//.test(m.url || "")).map((m) => ({ url: m.url, own: true, label: String(m.label || "").slice(0, 60) }))),
    ...((((cl.website || {}).stock) || []).filter((x) => x && /^https:\/\//.test(x.url || "")).map((x) => ({ url: x.url, own: false, label: String(x.alt || "").slice(0, 60) }))),
  ];
  const layout = homeLayout({ ...cl, website: { ...(cl.website || {}), layout: draft.layout, blocks: draft.blocks } });
  const turns = (Array.isArray(body.messages) ? body.messages : []).slice(-12)
    .map((m) => ({ role: m && m.role === "assistant" ? "assistant" : "user", content: String((m && m.text) || "").slice(0, 4000) }))
    .filter((m) => m.content);
  if (!turns.length || turns[turns.length - 1].role !== "user") return json({ ok: false, error: "Say what you'd like changed." }, 400);
  // The conversation must start with him.
  while (turns.length && turns[0].role !== "user") turns.shift();

  await writeJob(db, clientId, { id: jobId, status: "running", startedAt: new Date().toISOString() });
  try {
    const msg = await new Anthropic().messages.create({
      model: SITE_AI_MODEL, max_tokens: 8000,
      system: `${siteAISystem(cl, { draft, layout, photos })}\n\n${NO_DASH_RULE}`,
      tools: [SITE_AI_TOOL], tool_choice: { type: "tool", name: "answer" },
      messages: turns,
    });
    const use = (msg.content || []).find((c) => c.type === "tool_use" && c.name === "answer");
    if (!use) throw new Error("The AI didn't answer. Try again.");
    const a = cleanAnswer(use.input);
    const applied = applySiteOps(draft, a.changes, { layout, photos });
    // The house writing rules on the words only, never on a link or photo address.
    applied.draft.content = humanizeDeep(applied.draft.content);
    applied.draft.blocks = applied.draft.blocks.map((b) => ({ ...b, ...(b.heading != null ? { heading: humanize(b.heading) } : {}), ...(b.body != null ? { body: String(b.body).split(/\n\s*\n/).map((p) => humanize(p)).filter(Boolean).join("\n\n") } : {}),
      ...(b.text != null ? { text: humanize(b.text) } : {}), ...(b.note != null ? { note: humanize(b.note) } : {}),
      ...(b.items ? { items: b.items.map((i) => ({ ...i, name: humanize(i.name), text: humanize(i.text) })) } : {}), ...(b.places ? { places: b.places.map((x) => humanize(x)) } : {}),
      ...(b.people ? { people: b.people.map((x) => ({ ...x, name: humanize(x.name), role: humanize(x.role) })) } : {}) }));
    await writeJob(db, clientId, { id: jobId, status: "done", finishedAt: new Date().toISOString(),
      reply: humanize(a.reply), suggestions: a.suggestions.map((x) => humanize(x)), done: applied.done, skipped: applied.skipped,
      draft: a.changes.length ? applied.draft : null });
  } catch (e) {
    const m = String((e && e.message) || e);
    console.error("site-ai-background failed:", m);
    await writeJob(db, clientId, { id: jobId, status: "error", finishedAt: new Date().toISOString(),
      error: /credit balance|billing/i.test(m) ? "The AI account is out of credits. Add credits in the Anthropic console, then try again." : "The AI couldn't answer just now. Try again in a minute." });
  }
  return json({ ok: true }, 202);
};
