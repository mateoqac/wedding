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
| `pnpm test:integration` | Run integration tests against an isolated Postgres database (needs Chromium: `pnpm exec playwright install chromium`) |
| `pnpm worker:preview` / `pnpm worker:export` | Start the render workers locally (ports 4101 / 4102) |
| `pnpm workers:up` | Start both render workers in Docker (pinned Playwright image) |
| `pnpm test:e2e` | Happy path end to end: recreates the `wedding_e2e` database, starts workers and the app |
| `pnpm test:visual:docker` | Visual regression inside the pinned Playwright image |
| `pnpm test:visual:update` | Accept intended visual changes (review every diff first) |

## Try it locally

```sh
eval "$(fnm env)" && fnm use
pnpm db:up && pnpm db:migrate
pnpm exec playwright install chromium
pnpm worker:preview   # terminal 1
pnpm worker:export    # terminal 2
pnpm dev              # terminal 3, then open http://localhost:4321
```

Without extra configuration the app uses development adapters:

- **Payments**: a fake gateway (`PAYMENT_GATEWAY=fake`) with a test page where you approve or reject the payment.
- **Email**: messages are written as JSON to `.data/outbox` and printed in the dev server log; the access link is there.
- **Files**: exports are stored in `.data/files` and served through signed links that expire in 5 minutes.
- **Jobs**: the export worker and the daily draft cleanup run inside the web process (`RUN_JOBS=false` disables them).

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | local Postgres on 5433 | Database |
| `BASE_URL` | `http://localhost:4321` | Public URL used in emails and redirects |
| `PRICE_CLP` | `9990` | Price of one invitation |
| `PREVIEW_URL` / `EXPORT_URL` | `http://127.0.0.1:4101` / `:4102` | Render services |
| `WORKER_SECRET` | `dev-worker-secret` | Shared secret between app and render workers |
| `RESEND_API_KEY`, `EMAIL_FROM` | unset | Send real email through Resend |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | unset | Store exports in Cloudflare R2 |
| `PAYMENT_GATEWAY` | `fake` | Only `fake` exists until the real gateway is chosen |
| `RUN_JOBS` | `true` | Run pg-boss workers in the web process |

Set a strong `WORKER_SECRET` and `FILE_SIGNING_SECRET` in production.
