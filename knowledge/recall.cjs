#!/usr/bin/env node
'use strict';
// UserPromptSubmit hook: reads the user's prompt on stdin, scores it against the
// knowledge base, and (only on a confident match) injects a 1-2 line pointer block
// so Claude opens the relevant prior finding instead of rediscovering it.
//
// Two hard rules from the runbook:
//   1. Weight keywords by inverse doc-frequency (rare keyword = strong signal).
//   2. Cap output at MAX hits (one tangential hit trains the reader to skim past all).
// And it must NEVER throw and must always exit 0 (a hook that errors would disrupt
// every prompt). Silent when nothing clears the threshold.

const fs = require('fs');
const path = require('path');

const THRESHOLD = 1.3; // min summed IDF score to surface an entry (tune here)
const MAX = 2;         // never surface more than this many entries

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

  const hay = ' ' + promptText.toLowerCase().replace(/\s+/g, ' ') + ' ';

  // 3. score each entry by summed IDF of its keywords that appear in the prompt
  const scored = entries.map((e) => {
    let score = 0;
    for (const kw of (e.keywords || [])) {
      if (!kw || kw.length < 3) continue;
      const spaced = kw.replace(/[-_]+/g, ' ');
      if (hay.includes(kw) || hay.includes(spaced)) {
        score += Math.log((N + 1) / (df[kw] || 1));
      }
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
