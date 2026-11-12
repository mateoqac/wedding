# Wedding Invitations

Public web app where couples in Chile design their wedding invitation ("parte de matrimonio"), preview it with a watermark, and pay once to download it in every format.

- Design: `docs/superpowers/specs/2026-11-12-wedding-invitation-designer-design.md`
- Task log: `odd/tasks/wedding-invitation-designer.md`

## Requirements

- Node (version in `.node-version`; `fnm use` picks it up)
- pnpm 11
- Docker (local Postgres)

Copy `.env.example` to `.env`.

## Commands

| Command | Action |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Start the dev server at `localhost:4321` |
| `pnpm build` | Build the production server to `./dist/` |
| `pnpm check` | Type-check Astro and TypeScript files |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm db:up` | Start local Postgres (Docker, port 5433) |
| `pnpm db:generate` | Generate a SQL migration from `src/db/schema.ts` |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` |
| `pnpm test:integration` | Run integration tests against an isolated Postgres database |
