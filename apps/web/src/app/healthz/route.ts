/** Process liveness only; API/database readiness is checked by NestJS separately. */
export function GET() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
