#!/usr/bin/env node
'use strict';
// UserPromptSubmit hook: reads the user's prompt on stdin, scores it against the
// knowledge base, and (only on a confident match) injects a 1-2 line pointer block
// so Claude opens the relevant prior finding instead of rediscovering it.
//
// Scoring: each entry carries a weighted term bag (keywords + task + summary +
// topic + name, built by build-index.cjs). We sum weight * inverse-doc-frequency
// over the prompt tokens that hit an entry's bag -- so rare, on-topic words
// dominate and common words barely register. Output is capped at MAX entries.
//
// Hard rule: NEVER throw, ALWAYS exit 0 (a hook that errors would disrupt every
// prompt). Silent when nothing clears the threshold.

const fs = require('fs');
const path = require('path');

const THRESHOLD = 7.0; // min score to surface an entry (tune here); scored as sum(weight*idf)
const MAX = 2;         // never surface more than this many entries

const STOP = new Set(('a an and are as at be but by can cant do does doesnt done for from get gets getting got had has have how i if in into is it its make made makes need needs no not of off on or our out over per see so than that the their them then there they this to up use used using via want wants was were what when where which who why will with wont you your yours yes we us am been being also any all one via vs etc'.split(/\s+/)));

function tokens(s) {
  return String(s == null ? '' : s).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.has(t));
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch { return ''; }
}

function main() {
  // 1. get the prompt text
  let promptText = '';
  const raw = readStdin();
  if (raw) {
    try {
      const j = JSON.parse(raw);
      promptText = j.prompt || j.user_prompt || j.message || '';
    } catch { promptText = raw; }
  }
  if (!promptText || !promptText.trim()) return;

  // 2. load the index (silently bail if it isn't built yet)
  let index;
  try { index = JSON.parse(fs.readFileSync(path.join(__dirname, '_index.json'), 'utf8')); }
  catch { return; }
  const entries = Array.isArray(index.entries) ? index.entries : [];
  if (!entries.length) return;
  const df = index.df || {};
  const N = Math.max(1, index.N || entries.length);

  const promptTokens = new Set(tokens(promptText));
  if (!promptTokens.size) return;

  // 3. score each entry: sum(weight * idf) over prompt tokens hitting its bag
  const scored = entries.map((e) => {
    let score = 0;
    const terms = e.terms || {};
    for (const tok of promptTokens) {
      const w = terms[tok];
      if (!w) continue;
      score += w * Math.log((N + 1) / (df[tok] || 1));
    }
    return { e, score };
  }).filter((x) => x.score >= THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX);

  if (!scored.length) return;

  // 4. emit the pointer block as UserPromptSubmit additionalContext
  const lines = scored.map((x) => `  • ${x.e.name} — ${x.e.summary} (${x.e.file})`);
  const ctx =
    `📚 BoldLine knowledge base — prior finding${scored.length > 1 ? 's' : ''} that may already cover this task:\n` +
    lines.join('\n') +
    `\nOpen the file only if relevant; it holds past decisions/gotchas so you don't redo them.`;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: ctx },
  }));
}

try { main(); } catch { /* never break the prompt */ }
process.exit(0);
