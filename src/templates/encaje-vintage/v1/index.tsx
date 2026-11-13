import { z } from "zod";
import { defineSharedDataTemplate } from "@/templates/shared/define-template";
import { fontFamily } from "@/templates/shared/fonts";
import { Links, Page, firstName, formatSpanishDate, geometryOf, type SharedTemplateProps } from "@/templates/shared/parts";

const optionsSchema = z.object({
  color: z.enum(["rosa-viejo", "lavanda", "sepia"]),
  border: z.enum(["ondas", "puntilla"]),
});
type Options = z.infer<typeof optionsSchema>;

const PALETTE: Record<Options["color"], { ink: string; accent: string; lace: string; bg: string }> = {
  "rosa-viejo": { ink: "#4a3a35", accent: "#a87569", lace: "#d9c7bd", bg: "#fbf6f1" },
  lavanda: { ink: "#3d3a4a", accent: "#7d6f9a", lace: "#cfc8de", bg: "#f8f6fb" },
  sepia: { ink: "#3f352b", accent: "#8a6a45", lace: "#d8c9b4", bg: "#faf5ec" },
};

/** Lace edge drawn as a repeating SVG pattern (scallops or picot dots) plus a double frame. */
function Lace({ border, accent, lace, story }: { border: Options["border"]; accent: string; lace: string; story: boolean }) {
  const id = `lace-${border}`;
  const h = story ? 2.2 : 3.6;
  return (
    <svg aria-hidden="true" width="100%" height="100%" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
      <defs>
        <pattern id={id} width="28" height="22" patternUnits="userSpaceOnUse">
          {border === "ondas" ? (
            <>
              <path d="M0 0 Q 14 22 28 0" fill="none" stroke={lace} strokeWidth="1.5" />
              <circle cx="14" cy="8" r="2.2" fill="none" stroke={lace} strokeWidth="1" />
            </>
          ) : (
            <>
              <circle cx="7" cy="8" r="3" fill="none" stroke={lace} strokeWidth="1.2" />
              <circle cx="21" cy="8" r="3" fill="none" stroke={lace} strokeWidth="1.2" />
              <circle cx="14" cy="16" r="1.6" fill={lace} />
            </>
          )}
        </pattern>
      </defs>
      <rect x="2%" y="2%" width="96%" height={`${h}%`} fill={`url(#${id})`} />
      <rect x="2%" y={`${98 - h}%`} width="96%" height={`${h}%`} fill={`url(#${id})`} />
      <rect x="4%" y={`${3 + h}%`} width="92%" height={`${94 - 2 * h}%`} fill="none" stroke={accent} strokeWidth="1" />
      <rect x="4.6%" y={`${3.6 + h}%`} width="90.8%" height={`${92.8 - 2 * h}%`} fill="none" stroke={lace} strokeWidth=".8" strokeDasharray="1 3" />
    </svg>
  );
}

function EncajeVintage({ data, options, format, qrCodes }: SharedTemplateProps<Options>) {
  const g = geometryOf(format);
  const { ink, accent, lace, bg } = PALETTE[options.color];
  const serif = fontFamily("libre-baskerville");
  const script = fontFamily("great-vibes");
  const sans = fontFamily("inter");
  const { couple, ceremony, party, rsvp, issuedAt } = data;
  const longest = Math.max(couple.partnerOne.length, couple.partnerTwo.length);
  const nameSize = g.story ? 9 : longest > 30 ? 3.4 : longest > 22 ? 4.2 : 5.4;
  const css = `
.trim{color:${ink};font-family:'${serif}',serif;display:grid;align-content:center;justify-items:center;text-align:center;gap:calc(var(--u)*${g.story ? 2.6 : 1});padding:calc(var(--u)*${g.story ? 16 : 7.5}) calc(var(--u)*${g.story ? 11 : 12})}
.small{font-size:calc(var(--u)*${g.story ? 2.7 : 1.2});line-height:1.55}
.caps{font-family:'${sans}',sans-serif;font-weight:500;font-size:calc(var(--u)*${g.story ? 2.1 : 0.9});letter-spacing:.24em;text-transform:uppercase;color:${accent}}
.names{font-family:'${script}',cursive;font-weight:400;line-height:1.05;font-size:calc(var(--u)*${nameSize});overflow-wrap:anywhere}
.flourish{width:calc(var(--u)*${g.story ? 34 : 14});height:auto}
.links{display:flex;gap:calc(var(--u)*3);justify-content:center;font-size:calc(var(--u)*${g.story ? 2.2 : 0.9})}
.qr-block{display:inline-flex;flex-direction:column;align-items:center;gap:.4em}
.qr svg{width:calc(var(--u)*${g.story ? 13 : 5.5});height:calc(var(--u)*${g.story ? 13 : 5.5});display:block}
a{color:${ink}}`;
  return (
    <Page format={format} background={bg} css={css}>
      <Lace border={options.border} accent={accent} lace={lace} story={g.story} />
      {g.story ? <p className="caps">Nos casamos</p> : (
        <>
          <p className="small" data-block="parents">{data.parentsOne.join(" · ")}<br />{data.parentsTwo.join(" · ")}</p>
          <p className="caps">tienen el agrado de invitarle al matrimonio de sus hijos</p>
        </>
      )}
      <h1 className="names" data-block="couple">
        {g.story ? <>{firstName(couple.partnerOne)}<br />&amp; {firstName(couple.partnerTwo)}</> : <>{couple.partnerOne} &amp; {couple.partnerTwo}</>}
      </h1>
      <svg className="flourish" viewBox="0 0 160 24" aria-hidden="true">
        <path d="M4 12 C 40 -4, 60 28, 80 12 C 100 -4, 120 28, 156 12" fill="none" stroke={accent} strokeWidth="1.2" />
        <circle cx="80" cy="12" r="3" fill={accent} />
      </svg>
      <p className="small" data-block="ceremony">
        {g.story ? null : <>{ceremony.description}<br /></>}
        el {formatSpanishDate(ceremony.date)}, a las {ceremony.time} horas<br />{ceremony.address}
      </p>
      {party ? <p className="small" data-block="party">Y luego a la recepción, {party.time} horas · {party.venue}{g.story ? "" : `, ${party.address}`}</p> : null}
      {g.story ? null : <p className="caps" data-block="rsvp">S.R.C. {rsvp.phones.join(" · ")}{rsvp.email ? ` · ${rsvp.email}` : ""}</p>}
      <Links data={data} format={format} qrCodes={qrCodes} />
      {g.story ? null : <p className="small"><em>{issuedAt.city}, {issuedAt.label}</em></p>}
    </Page>
  );
}

export const encajeVintageV1 = defineSharedDataTemplate<Options>({
  meta: { id: "encaje-vintage", version: 1, name: "Encaje vintage", description: "Borde de encaje calado, caligrafía y tonos suaves. Romántica y clásica." },
  optionsSchema,
  defaultOptions: { color: "rosa-viejo", border: "ondas" },
  optionSpecs: [
    { name: "color", label: "Color", choices: { "rosa-viejo": "Rosa viejo", lavanda: "Lavanda", sepia: "Sepia" } },
    { name: "border", label: "Encaje", choices: { ondas: "Ondas", puntilla: "Puntilla" } },
  ],
  Component: EncajeVintage,
  fonts: () => ["libre-baskerville", "great-vibes", "inter"],
});
