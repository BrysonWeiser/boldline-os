// Where the test browser lives on this machine. Cloud machines have moved it before: chromium-1194/chrome-linux/chrome
// became chromium-1243/chrome-linux64/chrome (2026-11-06), which made every browser-driven check fail to start. The
// stable link /opt/pw-browsers/chromium comes first; otherwise the newest chromium-* folder, either layout.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function chromiumPath(root = "/opt/pw-browsers") {
  if (existsSync(join(root, "chromium"))) return join(root, "chromium");
  if (!existsSync(root)) return undefined;
  const dirs = readdirSync(root).filter((x) => /^chromium-\d+$/.test(x)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const d of dirs) for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome"]) if (existsSync(join(root, d, sub))) return join(root, d, sub);
  return undefined;
}
