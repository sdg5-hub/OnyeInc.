# Styling Conventions

Decisions recorded here per IC-FE-CONFIG-01 — they are binding for every UI
ticket that follows (IC-101, IC-204, IC-VIEWER-01, and beyond). Changing any
of them later means revisiting every component built against them, so they're
made deliberately, once, and documented here as the single source of truth.

## Tailwind version

**Pinned to v3** (`tailwindcss: ^3.4.19`) — deliberately, not v4. v4 changes
the configuration format (CSS-first config, no `tailwind.config.js`) and would
mean redoing this ticket's design-token setup; that migration is out of scope
for the MVP. `package.json` can't carry an inline comment (it's strict JSON),
so the pin's rationale is recorded here instead — don't bump to v4 without
revisiting this decision first.

## Tailwind-only rule

All styling is expressed through Tailwind utility classes. No hand-written
CSS files, CSS Modules, or styled-components — `app/globals.css` exists solely
to load Tailwind's `base`, `components`, and `utilities` layers plus the
`next/font` CSS-variable declarations those layers reference.

**The one exception**: inline `style={}` is permitted *only* for values
computed at runtime that cannot be expressed as a static utility class —
for example, a progress bar's `width: ${pct}%`, or pixel-level canvas/viewer
positioning in IC-VIEWER-01. If a value is knowable at build time, it belongs
in a Tailwind class (via `cn()` if it's conditional), not in `style={}`.

## Dark mode

**Decision: `class` strategy** (`darkMode: 'class'` in `tailwind.config.js`),
toggled and persisted via [`next-themes`](https://github.com/pacocoursey/next-themes).

**Why `class` over `media`**: this is a radiology review tool — it's
plausible a user works in a dark reading room regardless of their OS-level
theme preference, so the app should let them choose explicitly rather than
inherit `prefers-color-scheme`. `class` mode is also what Radix-based
component systems (including the org's `onyepatient` app) standardize on,
which keeps reference components portable across both codebases.

**What this means for every component**: every component that ships visible
surfaces must define both a light and a `dark:` variant — there is no
"forgot dark mode" escape hatch. `next-themes` handles persistence
(`localStorage`) and prevents the SSR flash-of-wrong-theme by requiring
`suppressHydrationWarning` on `<html>` in `app/layout.tsx`; do not remove it.

## Font loading

The project typeface is loaded via `next/font/google` in `app/layout.tsx`
(Geist for sans, Geist Mono for monospace), each assigned to a CSS variable
(`--font-geist-sans`, `--font-geist-mono`). Those variables are the **single
source of truth** — they are mapped into `tailwind.config.js`'s
`theme.extend.fontFamily.sans` / `.mono`, so components reference `font-sans`
/ `font-mono` Tailwind classes rather than the CSS variables directly.

Never add a `<link>` font tag anywhere (`app/layout.tsx` or otherwise) —
`next/font` self-hosts and inlines the font, eliminating both the extra
network round-trip and flash-of-unstyled-text (FOUT).

## Component library

**Decision: Radix UI primitives**, styled exclusively with Tailwind, composed
via `cn()` and `class-variance-authority` (cva) for variants.

**Why headless primitives over building from scratch**: Dialog, DropdownMenu,
Tooltip, and Progress all carry non-trivial accessibility requirements (focus
trapping, ARIA roles/states, keyboard navigation) that are easy to get subtly
wrong and expensive to retrofit. Radix ships these solved and unstyled, so
Tailwind retains full visual control. `onyepatient` made the same choice,
which keeps the two codebases consistent for engineers moving between them.

**Only four primitives are installed for MVP** — `Dialog`, `DropdownMenu`,
`Progress`, `Tooltip` — because those are the ones IC-101 / IC-204 /
IC-VIEWER-01 are known to need (modal, dropdown, tooltip, progress surfaces).
Do not install the full `@radix-ui/react-*` catalog; add primitives one at a
time, when a ticket actually needs one.

## The `cn()` helper

`lib/utils.ts` exports `cn()` — a thin wrapper combining `clsx` (conditional
class composition) and `tailwind-merge` (conflict resolution: the last
conflicting utility wins deterministically, e.g. a variant's `bg-red-500`
correctly overrides a base `bg-blue-500` instead of both classes landing in
the output and depending on CSS source order).

**All conditional class-name composition must go through `cn()`.** No manual
template-string concatenation of class names — it can't resolve Tailwind
class conflicts and silently produces unpredictable output.

## Status color tokens

`tailwind.config.js`'s `theme.extend.colors.status` defines five named tokens
— `uploading`, `processing`, `complete`, `failed`, `partialMissing` — exposed
as `bg-status-*` / `text-status-*` / `border-status-*` utilities. **These are
the single source of truth for status representation across the app.** IC-101,
IC-204, and IC-VIEWER-01 must reference these tokens for any status indicator
or badge — no ad-hoc hex values, no one-off Tailwind palette colors
(`bg-green-500` etc.) for status anywhere in the codebase. If a new status
state is ever needed, add it here first, not at the call site.

| Token | State |
|---|---|
| `status-uploading` | File transfer in progress |
| `status-processing` | Server-side processing in progress |
| `status-complete` | Finished successfully |
| `status-failed` | Finished with an error |
| `status-partialMissing` | Finished with some data missing |

> The hex values backing these tokens in `tailwind.config.js` are
> placeholders pending design review — update them there (and only there)
> once a final palette is supplied; no component should hardcode these colors.
