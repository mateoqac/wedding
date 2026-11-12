# Wedding Invitation Designer — Design

Date: 2026-11-12
Status: Approved in brainstorming; revised after written-spec review (rev 2)

## 1. Product

A public website where any couple in Chile designs their formal wedding invitation ("parte de matrimonio"), previews it for free with a watermark, and pays once to download clean files in every format.

Reference design: classic Chilean formal invitation (double frame, centered religious emblem, both sets of parents at the sides, couple names, ceremony, party, R.S.V.P., gift registry, envelope address).

### Scope decisions

- **Audience:** public product (any couple), market **Chile only**, prices in **CLP**.
- **Customization:** template + form. The user picks a template, fills fields, and chooses typography, color, emblem, and frame from a curated set per template.
  - Hybrid mode (manual block position/size tuning) is **phase 2**. The data model must allow adding it later without rework.
- **Monetization:** free preview with watermark. **One payment per invitation unlocks all formats.**
- **Post-payment edits (anti-reuse rule):**
  - Couple names are **locked** after payment, except typo fixes: each name may change by at most **2 characters** (Levenshtein distance against the paid value).
  - All other fields stay editable within an **edit window**: until the wedding date + 30 days, capped at 18 months from payment.
  - After the window closes, already generated files remain downloadable; no new edits.
- **Payment gateway:** undecided (candidates: Flow, Mercado Pago, Transbank Webpay). Isolated behind a `PaymentGateway` port.

### Invitation fields (reference template)

- Bride's parents (names), groom's parents (names)
- Couple names
- Ceremony: type, venue, address, date, time
- Party: venue, address, time (optional)
- R.S.V.P.: phones, email
- City and issue date
- Venue map link (optional, `https` only)
- Gift registry link (optional, `https` only) plus store/code text
- Envelope address (optional)

Optional fields that are empty remove their block and the layout reflows.

## 2. Stack

- **Astro** (SSR, Node adapter), minimal: zero JS on landing, gallery, and checkout pages.
- **React islands only in the editor.** Preact was evaluated and rejected: shadcn/ui targets React, and `preact/compat` has documented breakages with Radix (duplicated Preact instances breaking SSR, Slider, Calendar).
- **shadcn/ui + Tailwind** for UI. UI quality is a top priority.
- **TypeScript**, **pnpm**.
- **Postgres** with **Drizzle ORM** and `drizzle-kit` migrations.
- **Zod** for template data schemas (shared client/server).
- **pg-boss** (Postgres-backed queue) for export jobs and scheduled cleanup; no Redis.
- **Playwright/Chromium** render worker (Docker).
- **Cloudflare R2** for generated files (no egress fees).
- **Resend** for transactional email.
- `qrcode` for QR generation.
- Fonts: only licenses allowing embedding (e.g. Google Fonts / OFL), bundled in the worker image.

## 3. Architecture

Screaming/hexagonal structure:

```
src/
  invitations/   # domain: Invitation, fields, validation, status, edit rules
  templates/     # versioned React templates + per-format layouts
  editor/        # React island: shadcn form + server-rendered preview
  payments/      # PaymentGateway port (adapter TBD by gateway choice)
  exports/       # Renderer port -> Playwright worker adapter
  auth/          # sessions + email access link
  pages/         # Astro pages
```

### Main flow

1. User picks a template and opens the editor.
2. Fills fields. The draft autosaves to Postgres anonymously, identified by an edit-token cookie.
3. Preview: the editor requests a **server-rendered, watermarked raster image** of the selected format (see Preview below).
4. Checkout: the user enters an email **in the checkout form** and pays. No login before paying.
5. Gateway confirms payment; invitation becomes `paid`; the email is attached as owner.
6. A receipt email is sent with an **access link** (magic link) to return from any device. The edit-token cookie keeps access on the original device, covering a mistyped email.
7. Download: the worker renders the template without watermark in the requested format, uploads to R2, returns a short-lived signed URL.

### Preview (watermark protection)

Clean design bytes never reach the browser before payment, **in any format**.

- A client-side DOM preview is rejected for every format, including print: the landscape print layout is visually the same product as the landscape PNG, so a screenshot of a clean DOM would leak a shareable final.
- The editor sends the draft (debounced ~500 ms) to the worker's internal preview endpoint, which returns a low-resolution JPEG (~1000 px on the long side) with the watermark burned in.
- The editor shows the previous image with a loading indicator until the new one arrives.
- The worker keeps a warm Chromium instance to keep preview latency low.
- Tradeoff accepted: preview is not instant (target < 1.5 s p95) in exchange for no leakage via DOM inspection.

## 4. Data model

| Table | Columns (key) |
|---|---|
| `users` | `id`, `email` (unique), `created_at` |
| `sessions` | `id_hash`, `user_id`, `expires_at`, `created_at` |
| `magic_link_tokens` | `token_hash`, `email`, `expires_at`, `used_at` |
| `invitations` | `id` (uuid), `user_id` (nullable while anonymous), `edit_token_hash`, `template_id`, `template_version`, `data` (jsonb), `options` (jsonb: font/color/emblem/frame), `status` (`draft`/`paid`), `paid_couple_names` (jsonb, set on payment), `edit_window_ends_at`, `last_activity_at`, timestamps |
| `payments` | `id`, `invitation_id`, `provider`, `provider_ref` (**unique**), `amount_clp` (integer), `status` (`pending`/`approved`/`rejected`/`refunded`/`charged_back`), `raw_payload` (jsonb), timestamps |
| `exports` | `id`, `invitation_id`, `format`, `content_hash`, `r2_key`, `created_at`; **unique** `(invitation_id, format, content_hash)` |
| `rate_limits` | `key`, `window_start`, `count` |

- Templates live in code, not in the DB (see Template versioning).
- `data` is validated by the template's Zod schema on client and server; the server is authoritative.
- `provider_ref` uniqueness makes webhook handling idempotent.
- CLP amounts are integers.
- `content_hash = hash(template_id, template_version, format, data, options)`. Any change to any of them produces a new export.
- Invitation `paid` is derived from payments: at least one `approved` payment not later `refunded`/`charged_back`. A refund or chargeback returns the invitation to `draft` (watermarked previews only, downloads blocked).

## 5. Templates and export

### Template module

```
templates/<template-id>/
  v1/
    schema.ts      # Zod schema: fields and required ones
    Template.tsx   # pure React component: (data, format, options) -> HTML
    formats.ts     # dimensions and layout per format
    meta.ts        # name, thumbnail, fonts
  v2/
    ...
```

- The component is pure (no fetching, no global state). Preview and export render the same component in the same Chromium, guaranteeing what-you-see-is-what-you-download.
- Customization options come from a curated set per template.

### Template versioning

- Each version is an **immutable directory**. A visual change creates `vN+1/`; existing directories are never edited.
- New drafts use the latest version. Existing invitations keep their `template_version` forever.
- Enforcement: visual regression snapshots of every published version must stay unchanged in CI.

### Text fitting

The biggest template risk is text overflow with calligraphic fonts.

- Each text block defines a max box and a minimum font size.
- The renderer shrinks the font down to the minimum. If text still overflows, the worker reports the overflow and the editor shows an inline error on that field ("Este nombre es demasiado largo para esta plantilla").

### Formats

| Format | Spec |
|---|---|
| Print PDF | Physical size, bleed, and color mode **as validated with a print shop** (see Prerequisites); crop marks, vector text, embedded fonts |
| Digital PDF | Same design without bleed; clickable links (gift registry, map) |
| PNG/JPG | Landscape, high resolution; links rendered as QR codes |
| Story 9:16 | 1080x1920, template-specific vertical layout; links as QR codes |

Known limit: Chromium outputs **RGB PDFs only**. If the print shop requires CMYK, a Ghostscript conversion step is added to the worker.

### Export jobs

- Queue `export` uses pg-boss policy `exclusive` with `singletonKey = <invitation_id>:<format>:<content_hash>`, so duplicate clicks never create duplicate renders. (`singletonKey` deduplicates only under `short`/`stately`/`exclusive` policies; the interaction with retries must be covered by an integration test.)
- Before enqueueing, the `exports` table is checked; an existing row returns its file directly.

## 6. Infrastructure

```
[Astro SSR (Node)] --> [Managed Postgres]
        |                    ^
        |  preview (HTTP,    |
        |  internal)         |
        v                    |
   pg-boss queue  -->  [Render worker: Node + Chromium (Docker)] --> [Cloudflare R2]
```

- Hosting: Railway (app, worker, Postgres) as the default candidate. **Verify region availability close to Chile before committing.**
- The worker is not publicly reachable; the app calls it over the private network with a shared secret.
- Environments: local (`docker compose` with Postgres), staging, production.
- Daily managed Postgres backups.
- Scheduled job (pg-boss cron): delete anonymous drafts with no activity for **30 days**.

## 7. Security

- **URL fields:** Zod accepts only `https:` URLs for map and gift registry links.
- **Chromium has no network access.** All page requests except inline/local resources are aborted. Fonts and assets are bundled in the worker image. Uploads to R2 are done by the Node process, never by the page.
- **Escaping:** templates render user text through React (escaped by default); no raw HTML injection.
- **Rate limiting** (Postgres-backed fixed window): access-link email per email and per IP; draft creation per IP; preview renders per draft; export enqueues per invitation.
- **Webhook:** verify gateway signature/token; never trust an unverified body.
- **Downloads:** check `paid` and ownership (session or edit token) before enqueueing; R2 URLs are signed and short-lived.

## 8. Error handling

| Case | Handling |
|---|---|
| Paid but webhook missing/late | On return from the gateway, the server queries payment status directly; a reconciliation job checks pending payments periodically |
| Duplicate webhook | Idempotent via unique `provider_ref`; second delivery ignored, responds 200 |
| Refund / chargeback | Payment status updated; invitation returns to `draft` |
| Render failure/timeout | pg-boss retries with backoff (3 attempts); UI shows progress and failure; payment is never lost, download can be retried |
| Preview failure | Editor keeps the last good image and shows a retry action |
| Invalid data | Same Zod schema on editor (inline errors) and server (authoritative) |
| Text overflow | Inline field error reported by the renderer |
| Locked name edit beyond 2 chars | Server rejects; editor explains the rule |
| Mistyped email at checkout | Edit-token cookie keeps access on the original device; support can resend by payment reference |
| Expired/used access link | Clear message and resend action |

## 9. Testing

- **Unit (Vitest):** Zod schemas (including `https`-only URLs), domain rules (`draft -> paid`, refund back to `draft`, name lock with distance ≤ 2, edit window), content hash.
- **Integration (Vitest + real Postgres in Docker):** idempotent webhook, payment reconciliation, refund handling, export dedup with `singletonKey`, draft TTL cleanup, Drizzle repositories. Gateway replaced by a **fake implementing the port**.
- **Visual regression (Playwright):** snapshots per template version x format with fixed fixtures:
  - very long names and addresses,
  - all optional fields empty,
  - all optional fields filled,
  - `ñ`, accented vowels, `ü`, and apostrophes in **every** font option.
- **Worker isolation:** a template fixture that references an external URL must render with that request blocked.
- **E2E (Playwright):** single happy path: pick template -> fill -> pay (fake) -> receive access link -> download all 4 formats.

## 10. Prerequisites

- **Print shop validation before building the first template:** physical size, bleed, color mode (RGB vs CMYK), and accepted PDF settings. Template work is blocked on this; infrastructure, data model, and payments port can proceed in parallel.

## 11. Out of scope (MVP)

- Hybrid block positioning (phase 2)
- Print ordering/fulfillment
- Markets outside Chile
- Payment gateway choice (pending; port only)

## 12. Open items

- Payment gateway selection.
- Hosting region verification.
- Initial template catalog size (MVP: start with the reference "classic double frame" template).
