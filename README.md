# LEG-002 Async ZIP Pipeline Handoff

This branch adds the LEG-002 async legal ZIP export architecture spike:

- ADR: `docs/adr/leg-002-async-zip.md`
- Handoff README: `docs/leg-002/README.md`
- Release migration: `db/migrations/db_migration_2026_0_0.sql`
- ZIP job policy helpers: `lib/legal/zip-jobs.ts`
- Synthetic streaming ZIP prototype: `lib/legal/zip-prototype.ts`
- Live B2 synthetic upload sink: `lib/legal/b2-sink.ts`
- Tests: `tests/lib/legal/`

Key decisions: Backblaze B2, not R2; `yazl`, not `fflate`; Supabase
`zip_jobs` as durable state; no Redis/Celery; worker runtime must be
BAA-covered before production PHI use.

LEG-002 validation performed on this branch:

- `npm run test`
- `npm run lint`
- `npm run build`
- Local 500MB synthetic ZIP stream into multipart counting sink
- Real Postgres integration test for dedupe and `SELECT ... FOR UPDATE SKIP LOCKED`

Live B2 upload command, after non-production B2 env vars are set:

```bash
./node_modules/.bin/sucrase-node scripts/leg-002-b2-live-prototype.ts
```

---

# IC-002 Auth Middleware Spike (TypeScript / Next.js)

Spike output for IC-002 ("Authentication & Session Management" ADR, status
PROPOSED). Produces a workable Next.js auth middleware surface that feature
tickets import — a parallel, independent implementation alongside the
existing FastAPI/Python spike on `feature/auth-middleware-skeleton`, built
in the stack this project is actually shipping on (Next.js + Supabase +
Render/Railway).

## What this is

A skeleton auth middleware — not production-ready. Stubs are clearly marked
with `SPIKE STUB` / `TODO` comments in the source.

## What this is NOT

- Not a full application
- Not connected to Supabase (JWT verified locally using the shared HS256
  secret — see `lib/auth/tokens.ts`)
- Not connected to Redis (the deny list is an in-memory `Set` — see
  `lib/auth/deny-list.ts`)
- Not connected to any database
- Not a TOTP/MFA enrollment flow — only the bare "imaging_tech without
  `mfa_verified` ⇒ 403" gate the ADR requires at the API layer is enforced
- Not the share-link flow (ADR §4) or Supabase RLS policies (ADR §5) —
  separate feature surfaces, need a live Supabase project + migrations
- Not session-cookie issuance/refresh or the idle/absolute timeout policy
  (ADR §2.4) — `lib/auth/supabase-server.ts` only demonstrates the
  `@supabase/ssr` wiring point; it isn't exercised by tests or the demo routes

## Setup

```bash
cp .env.example .env
# Add your SUPABASE_JWT_SECRET from Supabase -> Settings -> API -> JWT Secret

npm install
```

## Run

```bash
npm run dev
```

Then mint a local test token (`scripts/mint-test-token.ts` signs one with
`lib/auth/test-helpers`'s `TEST_SECRET`) and call the demo routes. The
secret it signs with must match the running server's `SUPABASE_JWT_SECRET`,
so point `.env` at `test-secret-for-spike-only` first:

```bash
npx vite-node scripts/mint-test-token.ts -- provider
# role:  provider
# token: eyJhbGciOiJIUzI1NiJ9...

curl http://localhost:3000/api/health
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/me
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/provider-only
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/clinical
curl -X POST -H "Authorization: Bearer <token>" http://localhost:3000/api/logout

# other roles / the MFA gate:
npx vite-node scripts/mint-test-token.ts -- imaging_tech         # 403 without --mfa
npx vite-node scripts/mint-test-token.ts -- imaging_tech --mfa   # 200 with --mfa
```

## Run with Docker Compose

Builds the standalone production server (`output: "standalone"` in
`next.config.ts`, copied by the Dockerfile's multi-stage build — see
`Dockerfile`) and runs it in a container, reading `.env` for config:

```bash
cp .env.example .env
# Add your SUPABASE_JWT_SECRET — lib/auth/config.ts validates it at
# startup and fails fast with a clear error if it's missing

docker compose up --build
```

The app is then reachable at `http://localhost:3000`, exactly as with
`npm run dev` — exercise it the same way (`scripts/mint-test-token.ts` +
curl, per "Run" above). `docker compose down` stops it.

This mirrors the container shape Render/Railway expect; `docker-compose.yml`
is for local parity, not a production deployment manifest.

## Test

```bash
npm run test
```

## What feature tickets import

```ts
import { getCurrentUser, requireRole, type AuthUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await requireRole("provider", "doctor")(req);
  return NextResponse.json({ id: user.id, role: user.role });
}
```

`lib/auth/` is the importable surface — the direct analogue of the Python
spike's `app/auth/middleware.py`. Root-level `middleware.ts` is a thin,
optional edge-level wrapper that delegates into it for coarse `/api/*` route
gating; it deliberately does not duplicate the role/MFA logic that lives in
`lib/auth/middleware.ts` and each route handler.

Next.js has no FastAPI-style `HTTPException` auto-conversion — route handlers
catch the thrown `AuthError` and convert it explicitly with `toErrorResponse`:

```ts
try {
  const user = await getCurrentUser(req);
  return NextResponse.json({ id: user.id });
} catch (err) {
  return toErrorResponse(err);
}
```

## Production TODOs (not in scope for spike)

- Replace the in-memory deny list (`lib/auth/deny-list.ts`) with Upstash
  Redis — see the swap-in code sketched in its TODO comment. This matters
  more here than it did for the Python spike: module-level mutable state
  doesn't reliably persist across invocations in serverless/Edge deployments
- Wire the real Supabase JWKS endpoint for RS256 verification
  (`lib/auth/tokens.ts` documents the swap point — `jose`'s `jwtVerify` has
  the same call shape for HS256 and RS256/JWKS, so this is localized, not a
  redesign). This is the *Tus server's* production design (ADR §3), a
  separate component
- Build the full MFA strategy — enrollment gating at login, lockout
  counters, admin recovery (ADR §2.3); the spike enforces only the bare
  403 gate
- Add user role lookup from a database if role is absent from JWT claims
- Wire up `lib/auth/supabase-server.ts` for real cookie-session issuance,
  refresh, and the idle/absolute timeout policy (ADR §2.4)
- Add CI secret-scanning (e.g. truffleHog)
- Add request-ID / correlation-ID logging on every auth event
  (`docs/observability.md`)
- Update IC-101–IC-204 acceptance criteria to reference this pattern —
  cross-ticket process work, not code
