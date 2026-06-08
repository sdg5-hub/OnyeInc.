// SPIKE STUB: in-memory deny list — resets on every restart/cold start,
// and (unlike a single-process FastAPI/uvicorn dev server) module-level
// mutable state in Next.js does not reliably persist across invocations
// or runtime instances in serverless/Edge deployments. This makes the
// stub even more obviously spike-only here than in the Python version.
//
// TODO: Production replacement — Upstash Redis (REST API, callable from
// both Edge middleware and Node route handlers):
//   await redis.set(`denylist:${sha256(token)}`, '1', { ex: ttlSeconds })
//   await redis.exists(`denylist:${sha256(token)}`)
// (hash before storing — Redis persists to disk; an in-memory Set does not)

const denied = new Set<string>();

export function addToDenyList(token: string): void {
  denied.add(token);
}

export function isDenied(token: string): boolean {
  return denied.has(token);
}

/** Test-only reset between cases. */
export function clearDenyList(): void {
  denied.clear();
}
