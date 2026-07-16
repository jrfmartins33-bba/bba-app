# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

pnpm workspace monorepo (`apps/*`, `packages/*`), orchestrated by Turborepo.

```bash
pnpm install
pnpm dev              # turbo dev, all apps
pnpm dev:web          # apps/web only (http://localhost:3000)
pnpm build            # turbo build
pnpm typecheck        # turbo typecheck (each package's own `tsc --noEmit`)
pnpm lint             # turbo lint (`next lint` in apps/web)
pnpm test             # scripts/run-tests.mjs — see below
```

`pnpm test` is the **only** test command — it discovers every `*.test.ts` file in the repo (bdos-core domains, `packages/bdos-core/src/architecture/*`, `apps/web/architecture/*`, import regression tests, anywhere else) and runs each with `npx tsx`, one child process per file, aggregating into a single pass/fail. There is no separate unit/integration/e2e split and no test framework (Jest/Vitest) — each `*.test.ts` file runs its own assertions at module load time via shared `runTest`/`assertEqual`/`assertNoViolations` helpers and throws on failure.

To run a single test file, `cd` into the package that owns it and run it directly — several test files resolve source paths relative to `process.cwd()`, matching the convention that every test runs "in place" from its own package:

```bash
cd packages/bdos-core && npx tsx src/domain/schedule-management/schedule-management.test.ts
```

`pnpm test` (via `run-tests.mjs`) replicates this per-file `cwd` automatically by walking up to the nearest `package.json`, so CI and local single-file runs behave identically.

CI (`.github/workflows/ci.yml`) runs typecheck → lint → build → test in that order.

## Architecture

### Workspace layout

- `apps/web` — Next.js 14 (App Router), the primary product surface.
- `apps/mobile` — Expo.
- `packages/bdos-core` — all domain/business logic (see below). Depends on `@anthropic-ai/sdk` (Advisor narration) and `@next/env`; individual adapters may deliberately avoid adding a runtime dependency where a hand-rolled reader is cheap and keeps the surface small (e.g. the MS Project XML importer parses the interchange format itself rather than pulling in `fast-xml-parser`/`xml2js`) — check an adapter's own file before assuming a library is or isn't available.
- `packages/ui`, `packages/lib`, `packages/config` — shared UI, client utilities, and shared config across `apps/*`.
- `supabase/migrations`, `supabase/seeds`, `supabase/functions`, `supabase/tests` — SQL migrations (run in chronological order in the Supabase SQL editor), demo seed data, Edge Functions, and governance/RLS tests.

### BBA Platform: Engine / Studio / Advisor

The product architecture's single source of truth is **`docs/PLATFORM_ARCHITECTURE.md`** — read it (or delegate to the `bdos-architect` subagent in `.claude/agents/`) before adding a domain, a service, a Studio, or changing what owns a piece of data. Do not re-derive these rules from scratch; the doc is kept current per its own governance section and is more reliable than inference from existing code.

The layering rule that governs everything: **Engine is technology, Studio is product. Engine never knows Studio. Studio consumes Engine. Advisor consumes all.**

- **Engine**: pure domain/business logic in `packages/bdos-core` — `domain/*` (30+ operational and decision-side domains), `capabilities/*` (`cash-intelligence`, `geospatial-intelligence`), and `engines/decision` (the only Engine physically extracted to an `engines/` folder; the rest are a logical contract, not a required folder name). Never imports UI or knows a Studio/screen exists.
- **Studio**: a product surface in `apps/web` that consumes one or more Engines via `services/*` (Application Services) or the package's public `index.ts` — never by importing `domain/*` directly. A Studio never imports another Studio's component directory.
- **BBA Advisor**: cross-cutting, not a Studio — owns no data, writes nothing, only narrates what Engines already computed (`packages/bdos-core/src/advisor/*`, e.g. `claude-narrator.ts`).

Two enforcement guards run as part of `pnpm test` (textual import scanners, no TypeScript compiler API, no test framework):

- `packages/bdos-core/src/architecture/engineering-boundaries.test.ts` — Engine-level boundaries. `OPERATIONAL_DOMAINS` (contract-management, project-management, schedule-management, etc.) may never import `FORBIDDEN_SEGMENTS_FOR_OPERATIONAL` (the Decision Engine, Business Facts, Executive Intelligence, cash/geospatial/revenue intelligence). Adding a new operational domain or a new decision-side Capability means adding it to the relevant list in this file.
- `apps/web/architecture/studio-boundaries.test.ts` — a Studio's component directory under `apps/web/components/` never imports another Studio's component directory.

`docs/PLATFORM_ARCHITECTURE.md` §5 also defines **cross-Studio data ownership**: every shared entity (e.g. `SpatialObject` owned by Geo Studio, `ScheduleActivity`/`PlanningDataset` owned by Project Studio, `Decision`/`Recommendation` produced only by the Decision Engine) has exactly one owning Studio; every other Studio consumes it read-only through the owner's contract, never by duplicating or writing around it.

Naming: "BBA" prefixes only the Platform and the Advisor (`BBA Platform`, `BBA Advisor`) — never an individual Studio (`Project Studio`, not `BBA Project Studio`). Status colors are exactly three (`--status-green`/`--status-amber`/`--status-red`) — do not reintroduce a fourth.

### Testing convention specific to this repo

`packages/bdos-core`'s `.test.ts` files are real, executable tests via `npx tsx`, not just `tsc --noEmit` compile checks — always run new test files for real (not just typecheck them) before considering a change verified. A handful of older files use the CJS `__dirname` global, which fails under `tsx`'s ESM execution — a known, pre-existing gap, not something to fix incidentally while touching unrelated code.

### Claude Code project config

- `.claude/agents/bdos-architect.md` — subagent pre-loaded with the Engine/Studio/Advisor rules; use it for architecture questions or boundary review instead of re-deriving them.
- `.claude/commands/babysit-prs.md` — `/babysit-prs` checks GitHub Actions CI + Vercel deployment status for the current branch/PR (repo: `jrfmartins33-bba/bba-app`; `gh` CLI is not installed locally, so it uses the GitHub REST API directly via `curl`).
