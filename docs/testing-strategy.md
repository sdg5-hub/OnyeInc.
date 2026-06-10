# Testing Strategy

## Frameworks

| Layer | Tool | Decision |
|-------|------|----------|
| Frontend unit | **Vitest** | Native ESM, integrates with Next.js/Vite toolchain, faster watch mode than Jest |
| Component | **React Testing Library** | Tests behaviour from the user's perspective, not implementation details |
| E2E | **Playwright** | Single runner for Chromium, Firefox, and WebKit; no enterprise license required |
| Backend unit (Tus server) | **Vitest** | Consistent toolchain across both codebases; no CommonJS or Node-mocking requirements that would favour Jest |

All layers use Vitest. Jest is not used in this project.

---

## Coverage Thresholds (enforced in CI)

| Scope | Threshold | Gate |
|-------|-----------|------|
| Backend utility functions (validation, token generation, status transitions) | 80% line | Blocks merge |
| Tus server utility functions | 80% line | Blocks merge |
| Frontend utility functions (`lib/`) | 70% line | Blocks merge |
| UI components (`components/`) | Tests required | No line-coverage gate |

Enforced via `vitest run --coverage --reporter=text`. A PR that drops below a threshold is blocked by CI.

---

## Test Fixtures

All fixtures live in `/test/fixtures/`. They must use **synthetic patient data only** — no real PII.
Generate synthetic DICOM files with `gdcm` or `dcmtk`.

| File | Purpose |
|------|---------|
| `valid.dcm` | Passes the IC-102 DICOM parser |
| `malformed.dcm` | Triggers the `SKIPPED_CORRUPT` error path |
| `valid.pdf` | Passes the PDF magic number check |
| `fake.pdf` | Renamed `.jpg` — rejected by magic number check |

---

## CI Pipeline

All suites run on every pull request against the remote staging environment.
A single failing test or unmet coverage threshold blocks merge.

```
vitest run --coverage          # frontend unit + component
playwright test                # E2E against staging (URL in .env.test)
vitest run --coverage          # Tus server (separate config)
```

The staging URL is stored in `.env.test` as `PLAYWRIGHT_BASE_URL` and injected by CI.
It is not hardcoded in `playwright.config.ts`.

---

## File Locations

```
vitest.config.ts               # frontend Vitest config
vitest.server.config.ts        # Tus server Vitest config
playwright.config.ts           # Playwright config (reads PLAYWRIGHT_BASE_URL)
test/
  fixtures/                    # synthetic test data (see above)
  unit/                        # Vitest unit tests
  components/                  # React Testing Library tests
  e2e/                         # Playwright specs
```
