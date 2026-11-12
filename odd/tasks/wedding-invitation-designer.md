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
| T5 | S9 | Auth: sessions, access-link tokens, email port (Resend adapter) | inline | pending | |
| T6 | S4, S9, S10 | Render worker: pinned Playwright image, no network, page pool, preview + export services | inline | pending | |
| T7 | S4, S9 | Export pipeline: pg-boss `exclusive` + singletonKey, exports cache, R2 adapter | inline | pending | |
| T8 | S2, S5, S7, S10 | Editor island: shadcn form, server preview with sequence numbers | inline | pending | |
| T9 | S2, S4 | Reference template `clasico-marco-doble/v1` | inline | pending | |
| T10 | S1, S5, S7 | Pages: landing, gallery, checkout | inline | pending | |
| T11 | S9 | Rate limits + draft TTL cron | inline | pending | |
| T12 | S4, S9, S10 | Visual regression (layout matrix + font specimens) + E2E happy path | inline | pending | |

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
