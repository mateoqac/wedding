import { z } from "zod";
import { defineSharedDataTemplate } from "@/templates/shared/define-template";
import { fontFamily } from "@/templates/shared/fonts";
import { Links, Page, dottedDate, firstName, formatSpanishDate, geometryOf, type SharedTemplateProps } from "@/templates/shared/parts";

const optionsSchema = z.object({
  tone: z.enum(["caramelo", "arcilla", "oliva"]),
  paper: z.enum(["marfil", "avena"]),
});
type Options = z.infer<typeof optionsSchema>;

const TONES: Record<Options["tone"], string> = { caramelo: "#9a6b43", arcilla: "#a35d48", oliva: "#6f6b3f" };
const PAPER: Record<Options["paper"], { bg: string; line: string }> = {
  marfil: { bg: "#fffaf7", line: "#e9dfd2" },
  avena: { bg: "#f6efe4", line: "#e2d5c2" },
};
const INK = "#2b2420";

/** "Neutro cálido": two columns split by a fine rule; names left, ordered details right. */
function NeutroCalido({ data, options, format, qrCodes }: SharedTemplateProps<Options>) {
  const g = geometryOf(format);
  const accent = TONES[options.tone];
  const { bg, line } = PAPER[options.paper];
  const serif = fontFamily("cormorant-garamond");
  const sans = fontFamily("inter");
  const { couple, ceremony, party, rsvp, issuedAt, giftRegistry } = data;
  const longest = Math.max(couple.partnerOne.length, couple.partnerTwo.length);
  const nameSize = g.story ? 10 : longest > 30 ? 3.4 : longest > 22 ? 4.2 : 5.2;
  const css = `
.trim{color:${INK};font-family:'${sans}',sans-serif;font-weight:300;display:grid;${g.story
    ? "align-content:space-between;padding:calc(var(--u)*11) calc(var(--u)*9)"
    : "grid-template-columns:1fr 1px 1fr;gap:calc(var(--u)*5);align-items:center;padding:calc(var(--u)*5) calc(var(--u)*6)"}}
.rule{background:${accent};height:78%}
.left{display:grid;gap:calc(var(--u)*${g.story ? 3 : 1.8})}
.caps{font-weight:500;font-size:calc(var(--u)*${g.story ? 2.2 : 0.95});letter-spacing:.3em;text-transform:uppercase;color:${accent}}
.names{font-family:'${serif}',serif;font-weight:400;line-height:1.02;font-size:calc(var(--u)*${nameSize});overflow-wrap:anywhere}
.names .y{color:${accent};font-style:italic}
.small{font-size:calc(var(--u)*${g.story ? 2.6 : 1.1});line-height:1.6;color:#4c423b}
.tag{justify-self:start;background:${line};padding:.5em 1em;font-size:calc(var(--u)*${g.story ? 2.4 : 1});letter-spacing:.2em}
.block{display:grid;gap:.3em;padding:calc(var(--u)*${g.story ? 2 : 1.1}) 0;border-bottom:1px solid ${line}}
.block:last-child{border-bottom:0}
.venue{font-family:'${serif}',serif;font-size:calc(var(--u)*${g.story ? 3.6 : 1.7})}
.links{display:flex;gap:calc(var(--u)*3);font-size:calc(var(--u)*${g.story ? 2.2 : 0.95})}
.qr-block{display:inline-flex;flex-direction:column;align-items:center;gap:.4em}
.qr svg{width:calc(var(--u)*${g.story ? 13 : 5.5});height:calc(var(--u)*${g.story ? 13 : 5.5});display:block}
a{color:${INK}}`;
  const names = g.story ? (
    <h1 className="names" data-block="couple">{firstName(couple.partnerOne)}<br /><span className="y">y</span> {firstName(couple.partnerTwo)}</h1>
  ) : (
    <h1 className="names" data-block="couple">{couple.partnerOne}<br /><span className="y">y</span> {couple.partnerTwo}</h1>
  );
  if (g.story) {
    return (
      <Page format={format} background={bg} css={css}>
        <p className="caps">Matrimonio</p>
        {names}
        <div>
          <div className="block" data-block="ceremony"><p className="caps">{formatSpanishDate(ceremony.date)}</p><p className="small">{ceremony.time} horas · {ceremony.address}</p></div>
          {party ? <div className="block" data-block="party"><p className="caps">Recepción</p><p className="small">{party.venue} · {party.time} horas</p></div> : null}
          <Links data={data} format={format} qrCodes={qrCodes} />
        </div>
      </Page>
    );
  }
  return (
    <Page format={format} background={bg} css={css}>
      <div className="left">
        <p className="caps">Matrimonio</p>
        {names}
        <p className="small" data-block="parents">Con la bendición de sus padres<br />{data.parentsOne.join(" y ")}<br />{data.parentsTwo.join(" y ")}</p>
        <span className="tag">{dottedDate(ceremony.date)}</span>
      </div>
      <div className="rule" aria-hidden="true" />
      <div>
        <div className="block" data-block="ceremony"><p className="caps">Ceremonia</p><p className="venue">{ceremony.description}</p><p className="small">{ceremony.address} · {formatSpanishDate(ceremony.date)}, {ceremony.time} horas</p></div>
        {party ? <div className="block" data-block="party"><p className="caps">Recepción</p><p className="venue">{party.venue}</p><p className="small">{party.address} · {party.time} horas</p></div> : null}
        <div className="block" data-block="rsvp"><p className="caps">Confirmar asistencia</p><p className="small">{rsvp.phones.join(" · ")}{rsvp.email ? ` · ${rsvp.email}` : ""}</p></div>
        {data.venueMapUrl || giftRegistry ? <div className="block"><Links data={data} format={format} qrCodes={qrCodes} /></div> : null}
        <p className="small"><em>{issuedAt.city}, {issuedAt.label}</em></p>
      </div>
    </Page>
  );
}

export const neutroCalidoV1 = defineSharedDataTemplate<Options>({
  meta: { id: "neutro-calido", version: 1, name: "Neutro cálido", description: "Marfil y caramelo en dos columnas ordenadas. Elegancia sin ornamentos." },
  optionsSchema,
  defaultOptions: { tone: "caramelo", paper: "marfil" },
  optionSpecs: [
    { name: "tone", label: "Acento", choices: { caramelo: "Caramelo", arcilla: "Arcilla", oliva: "Oliva" } },
    { name: "paper", label: "Fondo", choices: { marfil: "Marfil", avena: "Avena" } },
  ],
  Component: NeutroCalido,
  fonts: () => ["cormorant-garamond", "inter"],
});
