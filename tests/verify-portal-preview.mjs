// The OS's own copy of the client portal must actually RENDER.
//
// 🔴 WHY THIS EXISTS. On 2026-08-31 the four `const` declarations for the signature banner
// were inserted into the MIDDLE of makePortalHTML's returned expression. JavaScript is
// perfectly happy with that: the return ended early and the consts became unreachable code.
// So the file compiled, `verify-app-boots` passed, every regex check on the source passed,
// and the Live Client View in the app rendered the header and then nothing at all. Bryson
// found it by opening the tab.
//
// Every existing check on this function was a REGEX OVER THE SOURCE. A regex cannot tell
// you whether the string it matched is inside the value that gets returned. The only thing
// that can is calling the function, so this calls it.
//
// Same lesson as the useMemo crash and the SIGN_ANCHOR send failure (KB `repo-tests`): a
// name or a statement in the wrong place is invisible until the code runs.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { transform } from "@babel/standalone";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  fail++;
  console.error(`  FAIL  ${name}${extra ? `\n        ${extra}` : ""}`);
};

const S = readFileSync(join(ROOT, "index.html"), "utf8");
const blocks = [...S.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)];
ok("the app's code block was found", blocks.length === 1, `found ${blocks.length}`);
const js = transform(blocks[0][1], { presets: ["react"], compact: false, comments: false }).code;

// Stub ONLY what a browser provides. Anything the app is supposed to declare itself must
// stay undeclared, or this harness becomes more permissive than the real page — the exact
// mistake that let the useMemo crash ship.
const sandbox = `
  const React={createElement:()=>null,useState:()=>[null,()=>{}],useEffect:()=>{},useRef:()=>({}),
    useMemo:(f)=>f(),useCallback:(f)=>f,createContext:()=>({Provider:null}),useContext:()=>({}),
    useReducer:()=>[null,()=>{}],useLayoutEffect:()=>{}};
  const ReactDOM={createRoot:()=>({render:()=>{}})};
  const window={location:{origin:"https://example.test"},addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}}),navigator:{}};
  const document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({style:{},appendChild(){}}),body:{appendChild(){}}};
  const navigator={userAgent:"node",clipboard:{writeText(){}}};
  const localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  const supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>({select(){return this;},eq(){return this;},then:(r)=>Promise.resolve({data:[],error:null}).then(r)})})};
  const fetch=async()=>({ok:true,json:async()=>({})});
`;

let makePortalHTML;
try {
  ({ makePortalHTML } = new Function(sandbox + js + "\n;return { makePortalHTML };")());
} catch (e) {
  ok("the OS code evaluates", false, e.message);
}
ok("makePortalHTML is defined", typeof makePortalHTML === "function");

if (typeof makePortalHTML === "function") {
  const pkg = { id: "g-launch", name: "Launch System", platform: "Google Ads", price: 400, setup: 750, tier: "launch" };
  const base = {
    name: "Stencil & Thread", contactName: "Sebastian Perrin", packageId: "g-launch", portalToken: "t",
    email: "contact@stencilandthread.com", adBudget: "$500/mo",
    contractStart: "Aug 30, 2026", contractEnd: "Nov 29, 2026",
    campaignSetup: {}, brandVoice: {}, approvals: [], mediaLibrary: [], leadsLog: [], commLog: [],
  };
  const unsigned = makePortalHTML({ ...base, contractStatus: "pending", contractSigned: false }, pkg);

  // 🔴 THE ONE THAT WOULD HAVE CAUGHT IT. The broken version returned ~3KB of header and
  // never closed the document, because the return ended before the body was concatenated.
  ok("🔴 the preview renders a whole document, not a truncated one",
    unsigned.length > 50000, `only ${unsigned.length} characters`);
  ok("🔴 and it closes, so the return reached the end of the expression",
    /<\/html>\s*$/.test(unsigned),
    "an unterminated document means a statement was inserted mid-return");

  // The pieces a client would notice missing.
  for (const [what, re] of [
    ["the tab bar", /class="nav"/],
    ["a Status tab", /show\('status'/],
    ["an Account tab", /show\('account'/],
    ["the Status pane", /id="t-status"/],
    ["the Account pane", /id="t-account"/],
    ["the contract", /bl-contract-frame/],
    ["the save button", /id="savebtn"/],
    ["the intake fields", /data-key="campaignSetup\.mainOffer"/],
  ]) ok(`the preview contains ${what}`, re.test(unsigned));

  ok("the Account tab holds exactly three sections",
    (unsigned.match(/details class="acc"/g) || []).length === 3,
    String((unsigned.match(/details class="acc"/g) || []).length));

  // Conditional content has to be evaluated, not merely present in the source.
  ok("an unsigned client sees the signature banner", /waiting for your signature/.test(unsigned));
  const signed = makePortalHTML({ ...base, contractStatus: "active", contractSigned: true }, pkg);
  ok("a signed client does not", !/waiting for your signature/.test(signed),
    "the banner is rendered from the source rather than from the client's state");
  ok("and the signed preview is a whole document too", /<\/html>\s*$/.test(signed));
}

console.log(`verify-portal-preview: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
