import { TEST_SECRET } from "@/lib/auth/test-helpers";

// Must run before any module reads process.env (Vitest setupFiles
// guarantees this) — the TS analogue of the Python suite's
// monkeypatch.setattr(settings, "SUPABASE_JWT_SECRET", TEST_SECRET).
process.env.SUPABASE_JWT_SECRET = TEST_SECRET;
process.env.APP_ENV = "test";
