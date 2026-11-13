Objective: build the wedding invitation designer described in docs/superpowers/specs/2026-11-12-wedding-invitation-designer-design.md (rev 3).
Branch: feat/foundation. Delivery strategy: ask-on-risk → chain strategy: stacked-to-main. Test runner: Vitest (unit/integration), Playwright (visual/E2E).

## Specs

- S1: Public product for any couple — "1 pero con pagos para poder descargarlo. en varios formatos." Market Chile, CLP — "1." (design §1)
- S2: Template + form customization — "1, si"; hybrid is phase 2 — "aunque el hibrido no me parece mal." (design §1)
- S3: Gift registry link field — "otro input es el Link para la lista de regalo." (design §1 fields, `https` only)
- S4: All four formats — "todos los formatos" (print PDF, digital PDF, PNG/JPG, Story 9:16; design §5)
- S5: Free watermarked preview, one payment unlocks all formats — "opcion 3" + "opcion 1" (design §1, §3 Preview)
- S6: Stack — "quieor usar astro, bien minimalista", "Postgres me gusta", "usa pnpm para instalar paquetes", "si vamos con typeScript esta bien", "vamos con las islas de react, y si shadcn es un problema no lo usamos" (design §2)
- S7: "el diseno de la UI es muy importante" (shadcn/ui + Tailwind)
- S8: Payment gateway undecided — "para gateway de pago, sigo analizando." Port only (design §1, §10)
- S9: Review rev 2 requirements (anti-reuse name lock, server-rendered preview, email at checkout, full content hash + dedup, immutable template versions, worker isolation, rate limits, draft TTL, refunded state, sessions, extreme visual fixtures, print shop first) (design §1–§10)
- S10: Review rev 3 requirements (preview service isolation + concurrency + stale discard, status cache in same transaction, word-based name rule + support unlock, pinned Chromium, bounded visual matrix, price pending) (design §1–§11)

## Tasks

| ID | Specs | Task | Route | Status | Evidence |
|---|---|---|---|---|---|
| T1 | S6, S7 | Scaffold: Astro SSR (Node) + React + Tailwind + shadcn/ui + TS + Vitest, screaming folders | inline | done | check 0 errors, build ok, landing ships 0 scripts, commit 8d5b10e |
| T2 | S6, S9, S10 | Postgres via docker compose + Drizzle schema for all tables + first migration | inline | done | 5 integration tests (no RED: written with schema), commit 5a862f2 |
| T3 | S2, S3, S9, S10 | Invitations domain: reference Zod schema (https URLs), name-lock rule, edit window, content hash (TDD) | inline | done | RED 4 suites → GREEN 38 tests, commit df3942e |
| T4 | S5, S8, S10 | Payments domain: PaymentGateway port + fake, status cache in same tx, idempotent webhook, refund (TDD + integration) | inline | done | RED→GREEN: 15 unit + 8 integration, commits 96b360f, 47b8ef8; native review approved (review-5070c3a5c77c8981), ff to main |
| T5 | S9 | Auth: sessions, access-link tokens, email port (Resend adapter) | inline | done | RED→GREEN: 7 unit + 10 integration (incl. concurrent single-use claim); commit on pr/6-auth |
| T6 | S4, S9, S10 | Render worker: pinned Playwright image, no network, page pool, preview + export services | inline | done | RED→GREEN 9 integration tests on real Chromium (preview 1000 px, PDF/PNG/JPG/story sizes, external requests blocked, pool 503, secret, 422); branch pr/8-render |
| T7 | S4, S9 | Export pipeline: pg-boss `exclusive` + singletonKey, exports cache, R2 adapter | inline | done | 5 integration tests GREEN (paid check, singleton dedup, cache hit, retry with one row, rate-limit hook); RED not observed (tests not run before implementation); branch pr/9-exports |
| T8 | S2, S5, S7, S10 | Editor island: shadcn form, server preview with sequence numbers | inline | done | invitation service RED→GREEN 9 integration tests (drafts, access, validation, checkout owner+receipt, name lock, edit window); preview scheduler RED→GREEN 3 unit (debounce, abort/stale, backoff); form-state 4 unit (no RED: written with code); commit a094793 |
| T9 | S2, S4 | Reference template `clasico-marco-doble/v1` | inline | done | RED→GREEN 22 tests (fixtures x formats, QR/links, crop marks, fonts inlined), commit 04b0e80 (485 lines, one unit) |
| T10 | S1, S5, S7 | Pages: landing, gallery, checkout | inline | done | landing, /plantillas, pagar, descargas, acceso, mis-invitaciones, fake checkout; covered by E2E; commit a094793 |
| T11 | S9 | Rate limits + draft TTL cron | inline | done | RED→GREEN 6 integration tests (limits, fixed window, concurrent hits, access-link email+IP, 30-day cleanup, keeps drafts with payments); branch pr/10-rate-limits |
| T12 | S4, S9, S10 | Visual regression (layout matrix + font specimens) + E2E happy path | inline | done | E2E 2/2 (pick→fill→pay fake→access link from another device→download 5 formats; invalid link); visual 19/19 in pinned image (15 layout, 3 font specimens, external URL blocked); final: 91 unit, 53 integration, astro check 0, build ok |
| T13 | S2, S4 | Multi-template support: shared font registry, per-template option specs in the editor, gallery lists every template | inline | done | 9de0c64c — all-templates contract test RED (3 failing) → GREEN; editor options from template optionSpecs |
| T14 | S2, S4 | Template `editorial/v1` (design/plantillas-nuevas/01) | inline | done | 5d71bc64 — contract tests + scripts/check-templates.ts (renderer overflow now checks .frame and .trim) |
| T15 | S2, S4 | Template `monograma/v1` (02) with initials from couple names | inline | done | a28beb34 — initials seal with roman-numeral date (this commit also contains T16/T17 sources, see Log) |
| T16 | S2, S4 | Template `botanica-neutra/v1` (03) with original SVG sprigs | inline | done | 38b55fda (sources in a28beb34) — decorations in a clipped layer so only text counts as overflow |
| T17 | S2, S4 | Template `neutro-calido/v1` (04) | inline | done | a28beb34 — two-column layout |
| T18 | S2, S4 | Template `trazo-a-mano/v1` (05) with original SVG strokes | inline | done | 720c57b4 |
| T19 | S2, S4 | Template `encaje-vintage/v1` (06) with SVG lace pattern | inline | done | 57ec750f |

Out of MVP: boleta electrónica and print shop validation (print values fixed: 21x15 cm, 3 mm bleed, RGB).

## Log

- L1 (2026-11-12): "Escuchame quiero crear una pagina web donde la gente pueda disenar su parte de matrimonio." Reference PDF: ~/Downloads/Fiesta Matrimonio Galán - Carmona.pdf
- L2 (2026-11-12): Design approved through rev 3 after two user-supplied reviews. "si, ya esta bien, comenza"
- L3 (2026-11-12): `writing-plans` skill unavailable; this document is the plan. Engram mirror pending (mem_save returned ambiguous_project with unrelated candidates). Docker daemon not running at start; T2 needs it.
- L4: Forecast well above 400 authored lines; chain strategy to be asked once before the next commit after the threshold.
- L5 (2026-11-12): "eliminar la sección de prerrequisitos, pasar ambos puntos a “fuera del MVP”, fijar esos valores en la tabla de formatos y quitar “bloquea la venta” de los pendientes." Applied: print PDF fixed at 21x15 cm, 3 mm bleed, RGB; T9 unblocked.
- L6 (2026-11-12): T1 done. Astro 7.4 requires Node >=22.23.4 → pinned 22.23.5 in `.node-version` (fnm). `astro check` rejects TypeScript 7 → pinned TypeScript 6. shadcn initialized with Base UI (`-b base`), not Radix. `astro add` wrote `minimumReleaseAgeExclude` entries to `pnpm-workspace.yaml` (pnpm supply-chain age policy bypass for fresh Astro packages); kept to allow install, flagged to the user.
- L7 (2026-11-12): T3 done (commit df3942e). Name rule implemented as: matched words within floor(len/4) edits, removed + added words ≤ 1, at least one match. T2 skipped for now: Docker daemon not running.
- L8 (2026-11-12): User chose "PR directo a Main" → stacked-to-main. T2 done (commit 5a862f2). Postgres on port 5433 (local Postgres occupies 5432). esbuild build script approved in pnpm-workspace.yaml.
- L9 (2026-11-12): Stacked-to-main slices (authored lines, generated excluded): PR1 pr/1-scaffold (docs+T1, 288) → PR2 pr/2-invitation-rules (T3 rules, 304, 25 tests) → PR3 pr/3-template-schema (T3 schema, 167, 38 tests) → PR4 pr/4-database (T2, 359, +5 integration). Each branch verified independently. feat/foundation kept as backup (identical final tree). Not pushed: push/PR creation is the user's decision.
- L10 (2026-11-12): User: "sin github, mete directo los branches a main, sin problema" → fast-forwarded main through pr/1..pr/4. T4 on pr/5-payments: assess risk high (payments hot path); Risk: item 2 (webhook verification guard). gentle-ai sync run to clear managed_assets_outdated. Review consent asked (lineage review-b1411cb5ba8dcec8).
- T4 native review (risk, resilience, reliability) approved and acknowledged; pr/5-payments fast-forwarded to main. Non-blocking follow-ups: facts extraction failure rolls back the payment record (payment-service.ts:73-76); no concurrency/reconcile-failure test (payment-service.ts:38-43).
- T5 decisions (user): session 30 d, access link 15 min single-use, edit-token cookie 30 d; tokens 32 random bytes, SHA-256 hash stored, cookies HttpOnly+Secure+SameSite=Lax; access-link email rate limit 5/h per email and 20/h per IP (enforcement in T11, T5 exposes the hook).
- T5 slice 059c239 is 483 authored lines (~270 tests), over the 400-line target; kept as one unit because tests and code of one behavior stay together. Risk: item 2 (auth tokens and sessions).
- T5 native review (risk, resilience, reliability) approved and acknowledged (review-571f86566ab8a4e3); pr/6-auth fast-forwarded to main. Non-blocking follow-ups: token row persists if the email send fails (auth-service.ts:53-65); email address is normalized but not format-validated (auth-service.ts:49-50) — validate at the checkout/access form boundary (T8/T10).
- User (verbatim): "si, vos termina todo, no me preguntes. cuando ya este, lo pruebo" — finish T6–T12 autonomously; open values chosen by the agent (D1–D12 below).
- D1 Renderer: playwright 1.65.0 pinned exactly in package.json; worker image `mcr.microsoft.com/playwright:v1.65.0-noble`. Fonts: @fontsource cormorant-garamond, playfair-display, great-vibes (OFL), inlined as base64 @font-face; every non-`data:`/`about:` request is aborted.
- D2 Pool: 4 pages per service, wait queue 8, then 503 + `Retry-After: 2`; editor backoff 0.5/1/2/4 s; render timeout 15 s. Internal auth header `x-worker-secret` (env WORKER_SECRET).
- D3 Preview: JPEG, long side 1000 px, quality 70, diagonal repeated watermark "VISTA PREVIA" opacity 0.18; in-memory LRU cache (200 entries) keyed by content hash.
- D4 Formats: print PDF 21.6x15.6 cm page (3 mm bleed) with crop marks; digital PDF 21x15 cm with clickable links; PNG/JPG 2480x1772 px (300 dpi); Story 1080x1920 own vertical layout; QR codes (EC level M) for links in raster formats and print PDF.
- D5 Options shape: { font: "cormorant"|"playfair"|"great-vibes", color: "oro"|"azul-noche"|"verde-salvia", emblem: "anillos"|"ninguno", frame: "doble"|"simple" }.
- D6 Storage: port + local filesystem adapter (dev/tests) + R2 adapter via @aws-sdk/client-s3; keys `exports/<invitationId>/<format>-<contentHash>.<ext>`; signed URL TTL 5 min.
- D7 pg-boss: queue `export`, policy exclusive, singletonKey `<invitation_id>:<format>:<content_hash>`, retryLimit 2 (3 attempts), retryDelay 10 s with backoff, expire 2 min. Cron `cleanup-drafts` daily 03:00 America/Santiago deletes anonymous drafts inactive 30 days.
- D8 Rate limits (fixed 1 h window): access-link 5/email + 20/IP; draft creation 20/IP; preview renders 600/draft; export enqueues 30/invitation.
- D9 Price: 9.990 CLP via env PRICE_CLP (default 9990).
- D10 Dev email: file outbox adapter when RESEND_API_KEY is absent (EMAIL_OUTBOX_DIR), used by E2E to read the access link.
- D11 Visual regression: Playwright Test `toHaveScreenshot`, maxDiffPixelRatio 0.001, snapshots under tests/visual; run inside the pinned image for stable fonts.
- D12 E2E: fake gateway with a dev-only fake checkout page that triggers the signed fake webhook.
- Writer subagents unavailable this session (Pi cwd is /Users/mateqac: "Writer bootstrap requires the original safe project root"); T6–T12 implemented inline.
- Native Gentle AI review for T6–T12 not started: the user asked not to be asked anything ("no me preguntes") and review needs per-run human confirmation; high-risk slices are listed at close for an optional later review.
- Web slice a094793 is 2,418 lines (632 drizzle snapshot JSON); over the 400-line target because editor, service and pages landed together — deviation recorded.
- Migration 0001 adds nullable invitations.checkout_email (owner attached on approval). Astro switched to output: 'server' (pages read cookies/query; prerender broke them, found by E2E).
- Story/landscape spacing tuned so the extreme fixture fits every format (renderer overflow check: 15/15 ok); visual baselines generated in mcr.microsoft.com/playwright:v1.65.0-noble.
- High-risk slices without native review (user asked not to be asked): T7 exports (paid gate, signed URLs), T8 checkout/owner attach + migration 0001, T11 rate limits. Risk: item 1 (migration 0001), item 2 (download/ownership checks, signed URLs), item 4 (pg-boss singleton, concurrent claim).
- Not done (outside MVP or undecided): real payment gateway adapter (design §11), boleta electrónica, print shop validation, support unlock UI for locked names.
- Native reviews after the user's "vale la pena? hacelo": T7 approved (review-5e7b8c38b9662a50), T11 approved (review-66a3996b5015e5c0), T8+T10 web approved (review-c43dc7f9b7b09215). No blocking findings. Non-blocking follow-ups worth doing before production:
  - Production config: fake gateway is the default (container.ts:48) — must fail closed in production; X-Forwarded-For is trusted as-is (http.ts:20) — only behind a trusted proxy.
  - Receipt email: owner claim then send is not retry-safe; a failed send loses the access-link email (invitation-service.ts:155-160).
  - pg-boss: a rejected bossReady is cached forever (container.ts:67-69); export failures have no logging; startWorker latch set before success.
  - Rate limits: email key not normalized in the limiter (rate-limiter.ts:35); purgeOldWindows never scheduled.
  - Editor: autosave race between overlapping saves, blob URL leak on unmount, duplicate field labels; download page refreshes without limit.
- User: "navvegar en internet para buscar y crear mas plantillas" → web research (Paperless Post 2026 trends, e-invitationwedding 2026 editorial report, Chilean print shops: clásico, rústico/kraft, vintage/calado, floral acuarela). User chose "todas": design/plantillas-nuevas/ with 6 artboards (01-editorial, 02-monograma, 03-botanica-neutra, 04-neutro-calido, 05-trazo-a-mano, 06-encaje-vintage), each showing print 21x15 and story 9:16. No artboard chosen yet; implementation not started. Artboards use macOS system fonts as stand-ins; implementation would use OFL fonts (e.g. Bodoni Moda, Inter) bundled like D1.
- User: "me gustaron todas!!! que lindo" → implement all six directions (T13–T19). New templates reuse the clasico v1 data schema and fixtures (same fields), each with its own options and fonts (OFL via @fontsource).
- T13–T19 closed: 7 templates registered; contract tests 228 unit total, templates:check 105/105 without overflow, 90 new visual baselines (pinned image) and existing clasico baselines unchanged, 53 integration, E2E 2/2, build ok. Commit hygiene: a28beb34 (monograma) also captured botanica-neutra and neutro-calido sources because files were written in parallel with `git add -A`; history kept as is (content correct). Visual scripts call node_modules/.bin/playwright because `pnpm exec` re-ran install inside the container.
