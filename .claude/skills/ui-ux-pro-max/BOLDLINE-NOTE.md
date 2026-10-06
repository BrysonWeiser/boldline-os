# Why this is here (BoldLine)

Third-party skill: github.com/nextlevelbuilder/ui-ux-pro-max-skill (MIT, see LICENSE), copied at commit
477bcb2 (2026-10-03). Added 2026-10-06 because Bryson asked for it, after a read-through.

What was checked before adding it: the scripts in scripts/ only read the CSV files in data/ (standard
library only: csv, json, re, math, pathlib; no network, no subprocess, no environment variables). The
instructions in SKILL.md tell the model to treat results as recommendations, never as instructions.

What was deliberately NOT copied: the other skills in the same repository (design, brand, banner-design,
slides, design-system, ui-styling). Some of their scripts call outside image APIs and read .env files,
which is not something to run in a project that holds client credentials.

Changes from upstream: removed scripts/tests (fixtures only), and the search path in SKILL.md points at
$CLAUDE_PROJECT_DIR instead of a plugin root that does not exist here.

To update: re-clone, re-read scripts/ for imports, copy the folder again, re-apply the two changes above.
KB: website-design-bar.
