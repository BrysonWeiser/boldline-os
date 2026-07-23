// Minimal AWS-Lambda-handler → modern-Netlify-Functions adapter.
//
// WHY: functions written in the classic Lambda style (`exports.handler =
// async (event) => ({ statusCode, headers, body })`) run in Netlify's "Lambda
// compatibility mode," which is subject to AWS Lambda's hard 4KB total
// environment-variable limit. As the OS accumulated secrets (DocuSign key,
// Google Ads creds, GA4 service-account key, …) the combined env vars crossed
// 4KB and those functions stopped deploying. Functions on the MODERN runtime
// (`export default async (req, context) => Response`) have no such limit.
//
// This wrapper lets us keep each handler's body 100% unchanged (still reads
// event.httpMethod / event.queryStringParameters / event.body and returns
// { statusCode, headers, body }) while presenting the modern default-export
// signature, so Netlify runs it on the modern runtime. It also future-proofs
// against Lambda-compat mode's July 2027 retirement.
//
// Covers exactly what our handlers use; intentionally small (no binary/base64,
// no multiValue headers — none of our Lambda-style functions need them).
export function withLambda(handler) {
  return async (req, context) => {
    const url = new URL(req.url);
    const event = {
      httpMethod: req.method,
      headers: Object.fromEntries(req.headers),
      queryStringParameters: Object.fromEntries(url.searchParams),
      body: (req.method === "GET" || req.method === "HEAD") ? null : await req.text(),
      path: url.pathname,
      rawUrl: req.url,
    };
    const res = (await handler(event, context)) || {};
    return new Response(res.body != null ? res.body : "", {
      status: res.statusCode || 200,
      headers: res.headers || {},
    });
  };
}
