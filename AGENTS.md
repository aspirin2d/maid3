# Repository Guidelines

## Project Structure & Module Organization
Maid3 is a TypeScript Hono service organized under `src/`. `src/index.ts` bootstraps the HTTP server and wires session context, `src/auth.ts` configures Better Auth with the Drizzle adapter, `src/admin.ts` seeds and guards admin access, and `src/db/` holds the Drizzle client plus schema definitions that power both runtime queries and migrations. Shared configuration lives in `drizzle.config.ts`, while generated SQL artifacts belong under `drizzle/` (ignored from source control). Keep infra helpers such as seeds or utilities beside the feature folders they support, and mirror that layout for accompanying tests or fixtures.

## Build, Test, and Development Commands
- `npm run dev` — starts the tsx watcher against `src/index.ts` with hot reload for local development.
- `npm run build` — runs `tsc` in `NodeNext` mode, emitting ESM to `dist/`; use it as the baseline CI check.
- `npm start` — executes the compiled server via `node dist/index.js`; verify production environment variables first.
- `npx drizzle-kit generate --config drizzle.config.ts` — snapshots schema changes into migration files; follow with `npx drizzle-kit push` to apply them to the target Postgres instance.

## Coding Style & Naming Conventions
The project enforces strict TypeScript settings (see `tsconfig.json`) and ES module syntax, so import local files with explicit `.js` extensions (`import { db } from "./db/index.js"`). Use two-space indentation, camelCase for variables/functions, PascalCase for types, and kebab-case for new filenames. Keep request handlers small by delegating DB logic to `src/db` helpers, and prefer descriptive env keys over magic constants.

## Testing Guidelines
No dedicated test runner is wired yet; when adding coverage, colocate specs as `src/__tests__/feature.test.ts` or alongside the module as `*.test.ts`. Focus on integration scenarios (auth flows, admin seeding, story/memory persistence) using a disposable Postgres database referenced by `DB_URL`. Mocking Hono contexts via `@hono/testing` keeps route tests fast, while database tests should reset tables between cases. Gate pull requests on `npm run build` until a formal `npm test` script is introduced.

## Commit & Pull Request Guidelines
Current history (`git log --oneline`) uses short imperative subjects (e.g., `init`); continue with concise commands such as `add admin guard` or adopt `feat|fix|chore` prefixes when batching work. Every pull request should describe the change, link the tracking issue, list schema or env updates, and include screenshots or cURL examples for new endpoints. Request at least one review for auth or schema changes and confirm database migrations have been generated and applied.

## Security & Configuration Tips
Sensitive settings belong in `.env` (never commit). Minimum keys:

```
PORT=3000
DB_URL=postgres://user:pass@localhost:5432/maid3
DEFAULT_ADMIN_EMAIL=ops@example.com
DEFAULT_ADMIN_PASSWORD=super-secret
DEFAULT_ADMIN_NAME=Admin
```

Run `initializeDefaultAdmin` automatically by keeping `DEFAULT_ADMIN_*` populated, and rotate API keys by updating the `apikey` table via Drizzle migrations. Always provide a non-production database when running local stories or memory extraction jobs.
