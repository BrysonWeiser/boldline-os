// Netlify's ignore step for the client-websites site: exit 0 = skip this deploy, exit 1 = deploy.
// Deploys only when a file these functions actually use (or this folder, or the packages) changed.
import { execFileSync } from "node:child_process";
import { sitesInputs, REPO } from "./deps.mjs";

const from = process.env.CACHED_COMMIT_REF, to = process.env.COMMIT_REF;
if (!from || !to || from === to) process.exit(1);
const paths = [...new Set([...sitesInputs(), "sites", "package.json", "package-lock.json"])];
try {
  execFileSync("git", ["-C", REPO, "diff", "--quiet", from, to, "--", ...paths], { stdio: "ignore" });
  console.log("client websites: nothing they use changed, skipping this deploy");
  process.exit(0);
} catch {
  console.log("client websites: their code changed, deploying");
  process.exit(1);
}
