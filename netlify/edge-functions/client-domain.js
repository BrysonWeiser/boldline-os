// Serves a CLIENT's landing page when the request arrives on the CLIENT's own domain.
//
// Why this exists: Google shows the address an ad points to, so a client's ad has to
// display their domain rather than ours (see ../lib/client-domain.mjs). They point a
// subdomain at this site, and this decides that such a request is a landing page rather
// than the OS.
//
// 🔴 THIS RUNS ON EVERY SINGLE REQUEST TO THE WHOLE OS. A throw in here is not a broken
// feature, it is a blank app for everyone. So it does the least possible work, holds no
// state, touches no database, and every failure path is "pass it through untouched".
// The routing rule itself lives in the shared module and is covered by tests.

import { routeFor } from "../lib/client-domain.mjs";

export default async (request, context) => {
  try {
    const url = new URL(request.url);
    const route = routeFor(
      request.headers.get("host") || url.hostname,
      url.pathname,
      // Escape hatch: a new hostname for the OS can be added in Netlify without a deploy.
      (typeof Netlify !== "undefined" && Netlify.env && Netlify.env.get("OS_HOSTS")) || "",
    );
    if (route.kind !== "landing") return;   // undefined = carry on as normal

    // Rewrite rather than redirect. The visitor's address bar keeps the client's domain,
    // which is the entire point, and Google sees the URL its ad pointed at.
    const target = new URL(url);
    target.pathname = "/.netlify/functions/landing";
    target.searchParams.set("host", route.host);
    return context.rewrite(target);
  } catch (e) {
    // Never take the OS down over a routing nicety.
    console.error("client-domain edge:", e && e.message);
    return;
  }
};

export const config = { path: "/*" };
