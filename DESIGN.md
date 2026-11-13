# Design system — Partes de matrimonio

Guide for designers and design agents (Claude Design included). It covers two separate
surfaces:

1. **The web app** (landing, gallery, editor, checkout, downloads): shadcn/ui on Tailwind CSS v4.
2. **The invitation templates** (the "partes" couples download): React components rendered to
   PDF and images by Chromium. They have stricter rules (§3); read them before designing one.

The product, its users and its flows are described in
`docs/superpowers/specs/2026-11-12-wedding-invitation-designer-design.md`.

**Audience:** couples in Chile planning a formal wedding, often with their parents. All UI copy
is neutral Spanish for Chile (tú, never vos); prices in CLP (`$9.990`).

---

## 1. Web app tokens

Source: `src/styles/global.css` (shadcn "neutral" theme, `oklch` colors). The UI is
intentionally neutral so the invitations carry the color. The light theme is a *warm* neutral:
every grey carries a touch of chroma (0.003–0.012) around hue 60–80, so the pages read as paper
rather than as a system panel. Dark mode keeps the plain neutral values.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `oklch(0.993 0.003 80)` | `oklch(0.145 0 0)` | Page background |
| `--foreground` | `oklch(0.17 0.008 60)` | `oklch(0.985 0 0)` | Body text |
| `--primary` / `--primary-foreground` | `oklch(0.22 0.008 60)` / `oklch(0.985 0.003 80)` | inverted | Primary buttons ("Usar esta plantilla", "Pagar") |
| `--muted` / `--muted-foreground` | `oklch(0.965 0.005 80)` / `oklch(0.54 0.012 60)` (≥ 4.5:1 on muted and background) | `oklch(0.269 0 0)` / `oklch(0.708 0 0)` | Secondary text, preview canvas background |
| `--accent` | `oklch(0.965 0.005 80)` | `oklch(0.269 0 0)` | Hover surfaces |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Field errors, alerts |
| `--border` | `oklch(0.915 0.008 80)` | `oklch(1 0 0 / 10%)` | Cards, inputs, dividers |
| `--ring` | `oklch(0.70 0.01 70)` | — | Focus ring |
| `--radius` | `0.625rem` (sm ×0.6, md ×0.8, lg ×1, xl ×1.4) | — | Corners |

Typography: the system sans stack (no custom web font in the app UI).

## 2. Web app components and pages

Components (`src/components/ui/`, shadcn): `button`, `card`, `input`, `label`, `select`,
`tabs`, `textarea`.

| Page | File | Notes |
|---|---|---|
| Landing | `src/pages/index.astro` | Zero JavaScript. Hero + "Cómo funciona" (4 steps) |
| Gallery | `src/pages/plantillas.astro` | Zero JS. One card per template with a server-rendered thumbnail |
| Editor | `src/pages/editor/[id].astro` + `src/editor/Editor.tsx` | The only React island. Form on the left, watermarked preview on the right, format tabs, "Estilo" options from each template |
| Checkout | `src/pages/invitaciones/[id]/pagar.astro` | Zero JS. Email + pay button |
| Downloads | `src/pages/invitaciones/[id]/descargas.astro` | Zero JS. 5 formats |
| Access | `src/pages/acceso.astro`, `src/pages/mis-invitaciones.astro` | Email access link, list of paid invitations |
| Header | `src/layouts/SiteHeader.astro` | |

Mockups of every page, built with these tokens: `design/pantallas-sitio/` (Claude Design canvas files;
`design.json` links the live canvas and maps each artboard to its page).

UX rules already in place: the preview is **always rendered by the server** (no client-side
DOM preview); WCAG AA contrast; visible focus; every form error is inline and in Spanish;
landing, gallery and checkout must stay JavaScript-free.

---

## 3. Invitation templates

### 3.1 What exists

| id | Name | Fonts (OFL, bundled) | Options shown in the editor |
|---|---|---|---|
| `clasico-marco-doble` | Clásico marco doble | Cormorant Garamond, Playfair Display, Great Vibes | Tipografía, Color (oro, azul noche, verde salvia), Emblema, Marco |
| `editorial` | Editorial | Bodoni Moda, Inter | Color (negro, azul tinta, burdeos), Alineación |
| `monograma` | Monograma | Bodoni Moda, Libre Baskerville, Inter | Color (azul noche, verde bosque, negro), Sello (círculo, escudo) |
| `botanica-neutra` | Botánica neutra | Cormorant Garamond, Great Vibes, Inter | Hojas (salvia, oliva, eucalipto azul), Ramas (esquinas, corona) |
| `neutro-calido` | Neutro cálido | Cormorant Garamond, Inter | Acento (caramelo, arcilla, oliva), Fondo (marfil, avena) |
| `trazo-a-mano` | Trazo a mano | Inter, Caveat, Great Vibes | Colores (terracota, mar, jardín) |
| `encaje-vintage` | Encaje vintage | Libre Baskerville, Great Vibes, Inter | Color (rosa viejo, lavanda, sepia), Encaje (ondas, puntilla) |

Code: `src/templates/<id>/v1/`. Static design explorations: `design/plantillas-nuevas/*.html`.
Visual references of every template × fixture × format: `tests/visual/__snapshots__/`.

### 3.2 Hard rules for any new template design

A template that breaks these cannot ship: they protect print quality and the paywall.

1. **One design, five formats.** Every template must work in:

   | Format | Size | Layout | Links |
   |---|---|---|---|
   | `print-pdf` | 21 × 15 cm + 3 mm bleed per side (21.6 × 15.6 cm), crop marks, RGB | landscape | QR code |
   | `digital-pdf` | 21 × 15 cm | landscape | clickable |
   | `png` / `jpg` | 2480 × 1772 px (300 dpi) | landscape | QR code |
   | `story` | 1080 × 1920 px (9:16) | **its own vertical layout** | QR code |

2. **The same fields for every template** (`src/templates/clasico-marco-doble/v1/schema.ts`):
   parents of each family (1–2 names each), the couple (2 full names), ceremony (description,
   address, date, time), reception (optional: venue, address, time), R.S.V.P. (1–3 phones,
   optional email), issue place and date ("Santiago, enero 2027"), map link (optional),
   gift registry (optional label and/or link), envelope address (optional).
   **Empty optional fields remove their block and the layout reflows.**
3. **Long content must fit.** Every design is checked with an "extreme" fixture: names such as
   *"María José Begoña Ñúñez de la Fuente-O'Higgins"*, three phones, long venues and addresses.
   Plan where text wraps and how the names scale down; nothing may overflow the page.
4. **Spanish characters**: ñ, á é í ó ú, ü and apostrophes must render in every font used.
5. **No network.** No remote fonts, images or CSS. Fonts must be OFL and available on
   `@fontsource`; ornaments are inline SVG drawn for this project (no stock art without a license).
6. **Sizes scale with the page.** Implementations size everything in `--u` (1% of the trim
   width), so one design serves print and images. Avoid fixed pixel sizes in the spec.
7. **Story layout is a separate composition**, not the landscape one shrunk: first names only,
   date, ceremony, reception and links; parents and R.S.V.P. may be omitted.
8. **Options are small, curated sets** (2–4 choices each, 1–3 option groups). Every option
   must look good with every fixture.
9. **Previews get a "VISTA PREVIA" watermark** added by the renderer; do not design one into the template.
10. **Print**: keep important text ≥ 4 mm inside the trim edge. The bleed area is
    background only.

### 3.3 Handing a design over for implementation

Deliver per template: the landscape composition, the story composition, the type scale (relative
to page width), the palette per option, the ornaments as SVG, and how the layout behaves with the
minimal and extreme fixtures. The implementation then adds a folder under `src/templates/` and
registers it in `src/templates/registry.ts`. `pnpm test` (contract for every template) and
`pnpm templates:check` (overflow in every format, previews in `.data/previews/`) must pass, and
`pnpm test:visual:update` records its visual references.
