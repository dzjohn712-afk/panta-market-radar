export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Application liveness only; no upstream requests or configuration disclosure. */
export function GET() {
  return Response.json({status:"ok"}, {headers:{"Cache-Control":"no-store"}});
}
