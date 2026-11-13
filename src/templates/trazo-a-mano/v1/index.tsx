import { z } from "zod";
import { defineSharedDataTemplate } from "@/templates/shared/define-template";
import { fontFamily } from "@/templates/shared/fonts";
import { Links, Page, dottedDate, firstName, formatSpanishDate, geometryOf, type SharedTemplateProps } from "@/templates/shared/parts";

const optionsSchema = z.object({
  colors: z.enum(["terracota", "mar", "jardin"]),
});
type Options = z.infer<typeof optionsSchema>;

const COLORS: Record<Options["colors"], [string, string]> = {
  terracota: ["#c8572f", "#d99a2b"],
  mar: ["#2f6f9a", "#3fa28a"],
  jardin: ["#b4436c", "#6c9a3f"],
};
const INK = "#2a2a2a";

/** Loose hand-drawn strokes (original paths) in two accent colors. */
function Strokes({ one, two, story }: { one: string; two: string; story: boolean }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <svg viewBox="0 0 180 120" style={{ position: "absolute", left: "4%", top: story ? "5%" : "6%", width: story ? "36%" : "20%" }}>
        <path d="M10 90 C 30 10, 70 10, 60 60 S 110 110, 130 40 S 170 20, 160 70" stroke={one} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      </svg>
      <svg viewBox="0 0 200 110" style={{ position: "absolute", right: "4%", bottom: story ? "6%" : "5%", width: story ? "42%" : "22%" }}>
        <path d="M10 60 Q 50 10 90 55 T 170 50" stroke={two} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <circle cx="182" cy="48" r="7" fill="none" stroke={two} strokeWidth="3.5" />
      </svg>
      <svg viewBox="0 0 70 70" style={{ position: "absolute", right: story ? "10%" : "8%", top: story ? "8%" : "9%", width: story ? "14%" : "7%" }}>
        <path d="M35 8 L40 28 L60 30 L44 42 L50 62 L35 50 L20 62 L26 42 L10 30 L30 28 Z" fill="none" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function TrazoAMano({ data, options, format, qrCodes }: SharedTemplateProps<Options>) {
  const g = geometryOf(format);
  const [one, two] = COLORS[options.colors];
  const sans = fontFamily("inter");
  const hand = fontFamily("caveat");
  const script = fontFamily("great-vibes");
  const { couple, ceremony, party, rsvp, issuedAt } = data;
  const longest = Math.max(couple.partnerOne.length, couple.partnerTwo.length);
  const nameSize = g.story ? 10 : longest > 30 ? 3.2 : longest > 22 ? 4 : 5.2;
  const css = `
.trim{color:${INK};font-family:'${sans}',sans-serif;display:grid;align-content:center;justify-items:center;text-align:center;gap:calc(var(--u)*${g.story ? 3 : 1.2});padding:calc(var(--u)*${g.story ? 12 : 6}) calc(var(--u)*${g.story ? 9 : 13})}
.hand{font-family:'${hand}',cursive;font-weight:500;color:${one};font-size:calc(var(--u)*${g.story ? 6 : 2.8})}
.names{font-weight:700;letter-spacing:-.02em;line-height:1.05;font-size:calc(var(--u)*${nameSize});overflow-wrap:anywhere}
.names .y{font-family:'${script}',cursive;font-weight:400;color:${one};font-size:.85em;letter-spacing:0}
.small{font-size:calc(var(--u)*${g.story ? 2.8 : 1.3});line-height:1.55}
.links{display:flex;gap:calc(var(--u)*3);justify-content:center;font-size:calc(var(--u)*${g.story ? 2.2 : 0.95})}
.qr-block{display:inline-flex;flex-direction:column;align-items:center;gap:.4em}
.qr svg{width:calc(var(--u)*${g.story ? 13 : 6});height:calc(var(--u)*${g.story ? 13 : 6});display:block}
a{color:${INK}}`;
  return (
    <Page format={format} background="#fffdf9" css={css}>
      <Strokes one={one} two={two} story={g.story} />
      <p className="hand">¡nos casamos!</p>
      <h1 className="names" data-block="couple">
        {g.story
          ? <>{firstName(couple.partnerOne)}<br /><span className="y">y</span><br />{firstName(couple.partnerTwo)}</>
          : <>{couple.partnerOne} <span className="y">y</span> {couple.partnerTwo}</>}
      </h1>
      {g.story ? null : <p className="small" data-block="parents">Junto a {[...data.parentsOne, ...data.parentsTwo].join(", ")}</p>}
      <p className="small" data-block="ceremony">
        <strong>{g.story ? dottedDate(ceremony.date) : `${formatSpanishDate(ceremony.date)} · ${ceremony.time}`}</strong><br />
        {g.story ? `${ceremony.time} · ${ceremony.address}` : <>{ceremony.description}<br />{ceremony.address}</>}
      </p>
      {party ? <p className="small" data-block="party">Después, ¡a celebrar! {party.time} · {party.venue}{g.story ? "" : `, ${party.address}`}</p> : null}
      {g.story ? null : <p className="small" data-block="rsvp">Confirma al {rsvp.phones.join(" · ")}{rsvp.email ? ` · ${rsvp.email}` : ""}</p>}
      <Links data={data} format={format} qrCodes={qrCodes} />
      {g.story ? null : <p className="hand" style={{ fontSize: "calc(var(--u)*1.8)" }}>{issuedAt.city}, {issuedAt.label}</p>}
    </Page>
  );
}

export const trazoAManoV1 = defineSharedDataTemplate<Options>({
  meta: { id: "trazo-a-mano", version: 1, name: "Trazo a mano", description: "Líneas dibujadas a mano y toques de color. Alegre, para civil o aire libre." },
  optionsSchema,
  defaultOptions: { colors: "terracota" },
  optionSpecs: [
    { name: "colors", label: "Colores", choices: { terracota: "Terracota y mostaza", mar: "Mar", jardin: "Jardín" } },
  ],
  Component: TrazoAMano,
  fonts: () => ["inter", "caveat", "great-vibes"],
});
