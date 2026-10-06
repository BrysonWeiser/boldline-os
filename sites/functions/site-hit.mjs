// The visitor count, on the client websites' own site (the same function the OS uses).
import hit from "../../netlify/functions/site-hit.mjs";

export default async (req) => hit(req);
export const config = { path: "/site-hit" };
