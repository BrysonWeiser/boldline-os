---
name: git-relay-proxy-recovery
topic: Git/Deploy
task: recover git push when it fails with "could not read Username" because the relay/proxy auth broke
keywords: [could-not-read-username, GIT_ASKPASS, insteadOf, push_files, api.anthropic.com, git-relay]
status: verified
summary: If git push fails with "could not read Username", the remote may have been reset to an api.anthropic.com ingress URL — set origin back to the GitHub HTTPS URL (the proxy's insteadOf rewrite handles auth) and retry. A one-off workaround relayed a commit via the GitHub MCP push_files.
verified: 2026-07-02
---

**Context:** the git relay auth can break mid-session after an environment refresh (local proxy creds rotate; `GIT_ASKPASS` gets emptied). Pushes then fail with **"could not read Username".**

**Recovery:** the remote may have been reset to an `api.anthropic.com` ingress URL. Set it back to the GitHub HTTPS remote — `https://github.com/BrysonWeiser/boldline-os.git` — and retry; the proxy's `insteadOf` rewrite handles auth transparently.

**One-off workaround used once:** a single commit (`af623c8`) was relayed to `main` via the GitHub MCP `push_files`, after which the relay recovered and normal `git push` resumed. (Note: the GitHub MCP server needs to be authorized/connected to be usable — it is not always available in a fresh session.)

**Push retry policy:** `git push -u origin <branch>`, retry 4x with exponential backoff (2s/4s/8s/16s) **only** on network errors. Never `--no-verify`, never bypass hooks.
