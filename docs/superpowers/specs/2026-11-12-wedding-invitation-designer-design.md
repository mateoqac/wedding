# Wedding Invitation Designer — Design

Date: 2026-11-12
Status: Approved in brainstorming, pending written-spec review

## 1. Product

A public website where any couple in Chile designs their formal wedding invitation ("parte de matrimonio"), previews it for free with a watermark, and pays once to download clean files in every format.

Reference design: classic Chilean formal invitation (double frame, centered religious emblem, both sets of parents at the sides, couple names, ceremony, party, R.S.V.P., gift registry, envelope address).

### Scope decisions

- **Audience:** public product (any couple), market **Chile only**, prices in **CLP**.
- **Customization:** template + form (option 1). The user picks a template, fills fields, and chooses typography, color, emblem, and frame from a curated set per template. Live preview.
  - Hybrid mode (manual block position/size tuning) is **phase 2**. The data model must allow adding it later without rework.
- **Monetization:** free preview with watermark. **One payment per invitation unlocks all formats**, with unlimited corrections and re-downloads.
- **Payment gateway:** undecided (candidates: Flow, Mercado Pago, Transbank Webpay). Isolated behind a `PaymentGateway` port.

### Invitation fields (reference template)

- Bride's parents (names), groom's parents (names)
- Couple names
- Ceremony: type, venue, address, date, time
- Party: venue, address, time (optional)
- R.S.V.P.: phones, email
- City and issue date
- Venue map link (Waze/Google Maps) (optional)
- **Gift registry link** (optional) plus store/code text
- Envelope address (optional)

Optional fields that are empty remove their block and the layout reflows.

## 2. Stack

- **Astro** (SSR, Node adapter), minimal: zero JS on landing, gallery, and checkout pages.
- **React islands only in the editor.** Preact was evaluated and rejected: shadcn/ui targets React, and `preact/compat` has documented breakages with Radix (duplicated Preact instances breaking SSR, Slider, Calendar).
- **shadcn/ui + Tailwind** for UI. UI quality is a top priority.
- **TypeScript**, **pnpm**.
- **Postgres** with **Drizzle ORM** and `drizzle-kit` migrations.
- **Zod** for template data schemas (shared client/server).
- **pg-boss** (Postgres-backed queue) for export jobs; no Redis.
- **Playwright/Chromium** export worker (Docker).
- **Cloudflare R2** for generated files (no egress fees).
- **Resend** for magic-link email.
- `qrcode` for QR generation.
- Fonts: only licenses allowing embedding (e.g. Google Fonts / OFL).

## 3. Architecture

Screaming/hexagonal structure:

```
src/
  invitations/   # domain: Invitation, fields, validation, status (draft | paid)
  templates/     # React templates + per-format layouts
  editor/        # React island: shadcn form + live preview
  payments/      # PaymentGateway port (adapter TBD by gateway choice)
  exports/       # Renderer port -> Playwright worker adapter
  auth/          # email magic link
  pages/         # Astro pages
```

### Main flow

1. User picks a template and opens the editor.
2. Fills fields; live preview with watermark. Draft autosaves to Postgres anonymously (draft identified by an edit token cookie).
3. At checkout, the user enters an email (magic link); that account becomes the invitation owner.
4. Gateway confirms payment; invitation becomes `paid`.
5. Download: the worker renders the same template without watermark in the requested format, uploads to R2, returns a short-lived signed URL.

### Security rule

Clean files are **only generated server-side after verified payment**. Never in the browser.

**Accepted risk:** the live preview is client-side DOM, so a technical user can hide the watermark and take a screen-resolution screenshot. They never get the print PDF. Accepted to keep the live preview fast.

## 4. Data model

| Table | Columns (key) |
|---|---|
| `users` | `id`, `email` (unique), `created_at` |
| `magic_link_tokens` | `token_hash`, `email`, `expires_at`, `used_at` |
| `invitations` | `id` (uuid), `user_id` (nullable while anonymous draft), `edit_token_hash`, `template_id`, `template_version`, `data` (jsonb), `options` (jsonb: font/color/emblem/frame), `status` (`draft`/`paid`), timestamps |
| `payments` | `id`, `invitation_id`, `provider`, `provider_ref` (**unique**), `amount_clp` (integer), `status`, `raw_payload` (jsonb), `created_at` |
| `exports` | `id`, `invitation_id`, `format`, `data_hash`, `r2_key`, `created_at` |

- Templates live in code (versioned in git), not in the DB. `template_version` keeps old invitations rendering identically.
- `data` is validated by the template's Zod schema on client and server; the server is authoritative.
- `provider_ref` uniqueness makes webhook handling idempotent.
- CLP amounts are integers.
- `exports` acts as a cache keyed by `(invitation_id, format, data_hash)`.

## 5. Templates and export

Each template is a self-contained module:

```
templates/<template-id>/
  schema.ts      # Zod schema: fields and required ones
  Template.tsx   # pure React component: (data, format, options) -> HTML
  formats.ts     # dimensions and layout per format
  meta.ts        # name, thumbnail, version, fonts
```

The component is pure (no fetching, no global state). The editor preview and the export worker render **the same component**, guaranteeing what-you-see-is-what-you-download.

### Formats

| Format | Spec |
|---|---|
| Print PDF | Physical size per template (e.g. 21x15 cm), 3 mm bleed + crop marks, vector text, embedded fonts |
| Digital PDF | Same design without bleed; clickable links (gift registry, map) |
| PNG/JPG | Landscape, high resolution; links rendered as QR codes |
| Story 9:16 | 1080x1920, template-specific vertical layout; links as QR codes |

Known limit: Chromium outputs **RGB PDFs, not CMYK**. CMYK conversion (Ghostscript in the worker) is out of MVP scope until validated with a real print shop.

## 6. Infrastructure

```
[Astro SSR (Node)] --> [Managed Postgres]
        |                    ^
        v                    |
   pg-boss queue  -->  [Playwright worker (Docker)] --> [Cloudflare R2]
```

- Hosting: Railway (app, worker, Postgres) as the default candidate. **Verify region availability close to Chile before committing.**
- Environments: local (`docker compose` with Postgres), staging, production.
- Daily managed Postgres backups.

## 7. Error handling

| Case | Handling |
|---|---|
| Paid but webhook missing/late | On return from the gateway, the server queries payment status directly; a reconciliation job checks pending payments periodically |
| Duplicate webhook | Idempotent via unique `provider_ref`; second delivery ignored, responds 200 |
| Forged webhook | Verify gateway signature/token; never trust an unverified body |
| Render failure/timeout | pg-boss retries with backoff (3 attempts); UI shows progress and failure; payment is never lost, download can be retried |
| Invalid data | Same Zod schema on editor (inline errors) and server (authoritative) |
| Expired/used magic link | Clear message and resend action |
| Download without payment | Export endpoint checks `status = paid` and ownership before enqueueing; R2 URLs are signed and short-lived |

## 8. Testing

- **Unit (Vitest):** Zod schemas, domain rules (`draft -> paid`, download authorization), cache hash.
- **Integration (Vitest + real Postgres in Docker):** idempotent webhook, payment reconciliation, Drizzle repositories. Gateway replaced by a **fake implementing the port**.
- **Visual regression (Playwright):** one snapshot per template x format with fixed data. Highest-value test in the product.
- **E2E (Playwright):** single happy path: pick template -> fill -> pay (fake) -> download all 4 formats.

## 9. Out of scope (MVP)

- Hybrid block positioning (phase 2)
- CMYK print PDFs
- Print ordering/fulfillment
- Markets outside Chile
- Payment gateway choice (pending; port only)

## 10. Open items

- Payment gateway selection.
- Hosting region verification.
- Initial template catalog size (MVP: start with the reference "classic double frame" template).
- Print size per template, to validate with a print shop.
