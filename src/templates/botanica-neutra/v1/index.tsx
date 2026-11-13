import { z } from "zod";
import { defineSharedDataTemplate } from "@/templates/shared/define-template";
import { fontFamily } from "@/templates/shared/fonts";
import { Links, Page, firstName, formatSpanishDate, geometryOf, type SharedTemplateProps } from "@/templates/shared/parts";

const optionsSchema = z.object({
  leaves: z.enum(["salvia", "oliva", "eucalipto-azul"]),
  layout: z.enum(["esquinas", "corona"]),
});
type Options = z.infer<typeof optionsSchema>;

const LEAVES: Record<Options["leaves"], { dark: string; light: string }> = {
  salvia: { dark: "#8a9a7b", light: "#b5c0a6" },
  oliva: { dark: "#7a7f4f", light: "#a9ad82" },
  "eucalipto-azul": { dark: "#7d9496", light: "#adc0bf" },
};
const INK = "#3f4a3c";
const GOLD = "#a88d55";

/** Original eucalyptus sprig drawn with ellipses along a curved stem. */
function Sprig({ dark, light, style }: { dark: string; light: string; style: React.CSSProperties }) {
  const leaves: [number, number, number][] = [[40, 30, 30], [62, 54, -20], [88, 70, 40], [108, 98, -15], [132, 118, 45], [150, 142, -10]];
  const small: [number, number, number][] = [[30, 54, 70], [74, 34, 10], [120, 80, 10], [148, 120, 60]];
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" style={{ position: "absolute", ...style }}>
      <path d="M10 10 C 60 40, 110 80, 170 170" stroke={dark} strokeWidth="2" fill="none" />
      {leaves.map(([x, y, r]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx="17" ry="10" fill={dark} opacity=".85" transform={`rotate(${r} ${x} ${y})`} />)}
      {small.map(([x, y, r]) => <ellipse key={`s${x}${y}`} cx={x} cy={y} rx="13" ry="8" fill={light} transform={`rotate(${r} ${x} ${y})`} />)}
    </svg>
  );
}

function Wreath({ dark, light, style }: { dark: string; light: string; style: React.CSSProperties }) {
  const leaves: [number, number, number][] = [[60, 72, -40], [100, 44, -20], [150, 34, 0], [200, 44, 20], [240, 72, 40]];
  const small: [number, number, number][] = [[80, 60, 60], [125, 40, 80], [175, 38, 100], [220, 58, 120]];
  return (
    <svg viewBox="0 0 300 130" aria-hidden="true" style={{ position: "absolute", ...style }}>
      <path d="M20 120 Q 150 -20 280 120" stroke={dark} strokeWidth="2" fill="none" />
      {leaves.map(([x, y, r]) => <ellipse key={`${x}`} cx={x} cy={y} rx="15" ry="9" fill={dark} transform={`rotate(${r} ${x} ${y})`} />)}
      {small.map(([x, y, r]) => <ellipse key={`s${x}`} cx={x} cy={y} rx="11" ry="7" fill={light} transform={`rotate(${r} ${x} ${y})`} />)}
    </svg>
  );
}

function BotanicaNeutra({ data, options, format, qrCodes }: SharedTemplateProps<Options>) {
  const g = geometryOf(format);
  const { dark, light } = LEAVES[options.leaves];
  const serif = fontFamily("cormorant-garamond");
  const script = fontFamily("great-vibes");
  const sans = fontFamily("inter");
  const { couple, ceremony, party, rsvp, issuedAt } = data;
  const longest = Math.max(couple.partnerOne.length, couple.partnerTwo.length);
  const corona = options.layout === "corona" || g.story;
  const nameSize = g.story ? 9 : longest > 30 ? 3.6 : longest > 22 ? 4.4 : 5.6;
  const css = `
.trim{color:${INK};font-family:'${serif}',serif;display:grid;align-content:center;justify-items:center;text-align:center;gap:calc(var(--u)*${g.story ? 2.4 : 1});
padding:${g.story ? "calc(var(--u)*38) calc(var(--u)*9) calc(var(--u)*12)" : corona ? "calc(var(--u)*11) calc(var(--u)*16) calc(var(--u)*4)" : "calc(var(--u)*5) calc(var(--u)*17)"}}
.small{font-size:calc(var(--u)*${g.story ? 3 : 1.45});line-height:1.45}
.caps{font-family:'${sans}',sans-serif;font-weight:500;font-size:calc(var(--u)*${g.story ? 2.2 : 0.95});letter-spacing:.22em;text-transform:uppercase;color:${GOLD}}
.names{font-family:'${script}',cursive;font-weight:400;line-height:1.05;font-size:calc(var(--u)*${nameSize});overflow-wrap:anywhere}
hr{width:calc(var(--u)*6);border:0;border-top:1px solid ${GOLD}}
.links{display:flex;gap:calc(var(--u)*3);justify-content:center;font-size:calc(var(--u)*${g.story ? 2.2 : 0.95})}
.qr-block{display:inline-flex;flex-direction:column;align-items:center;gap:.4em}
.qr svg{width:calc(var(--u)*${g.story ? 13 : 6});height:calc(var(--u)*${g.story ? 13 : 6});display:block}
a{color:${INK}}`;
  return (
    <Page format={format} background="#fbf9f4" css={css}>
      {/* Decorations bleed off the edge on purpose; this layer clips them so only text counts as overflow. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {corona ? (
        <Wreath dark={dark} light={light} style={g.story ? { left: "8%", top: "6%", width: "84%" } : { left: "34%", top: "3%", width: "32%" }} />
      ) : (
        <>
          <Sprig dark={dark} light={light} style={{ left: "-1%", top: "-1%", width: "28%" }} />
          <Sprig dark={dark} light={light} style={{ right: "-1%", bottom: "-1%", width: "28%", transform: "rotate(180deg)" }} />
        </>
      )}
      </div>
      {g.story ? <p className="caps">Nos casamos</p> : (
        <>
          <p className="small" data-block="parents">{data.parentsOne.join(" · ")}<br />{data.parentsTwo.join(" · ")}</p>
          <p className="caps">tienen el agrado de invitarle al matrimonio de sus hijos</p>
        </>
      )}
      <h1 className="names" data-block="couple">
        {g.story ? <>{firstName(couple.partnerOne)}<br />&amp; {firstName(couple.partnerTwo)}</> : <>{couple.partnerOne} &amp; {couple.partnerTwo}</>}
      </h1>
      <hr />
      <p className="small" data-block="ceremony">
        {g.story ? null : <>{ceremony.description}<br /></>}
        {formatSpanishDate(ceremony.date)} · {ceremony.time} horas<br />{ceremony.address}
      </p>
      {party ? <p className="small" data-block="party">Recepción {party.time} horas · {party.venue}{g.story ? "" : `, ${party.address}`}</p> : null}
      {g.story ? null : <p className="caps" data-block="rsvp">S.R.C. {rsvp.phones.join(" · ")}{rsvp.email ? ` · ${rsvp.email}` : ""}</p>}
      <Links data={data} format={format} qrCodes={qrCodes} />
      {g.story ? null : <p className="small"><em>{issuedAt.city}, {issuedAt.label}</em></p>}
    </Page>
  );
}

export const botanicaNeutraV1 = defineSharedDataTemplate<Options>({
  meta: { id: "botanica-neutra", version: 1, name: "Botánica neutra", description: "Ramas de eucalipto en tonos suaves y nombres en caligrafía." },
  optionsSchema,
  defaultOptions: { leaves: "salvia", layout: "esquinas" },
  optionSpecs: [
    { name: "leaves", label: "Hojas", choices: { salvia: "Salvia", oliva: "Oliva", "eucalipto-azul": "Eucalipto azul" } },
    { name: "layout", label: "Ramas", choices: { esquinas: "En las esquinas", corona: "Corona superior" } },
  ],
  Component: BotanicaNeutra,
  fonts: () => ["cormorant-garamond", "great-vibes", "inter"],
});
