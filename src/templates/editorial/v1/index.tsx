import { z } from "zod";
import { defineSharedDataTemplate } from "@/templates/shared/define-template";
import { fontFamily } from "@/templates/shared/fonts";
import { Links, Page, dottedDate, firstName, formatSpanishDate, geometryOf, type SharedTemplateProps } from "@/templates/shared/parts";

const optionsSchema = z.object({
  color: z.enum(["negro", "azul-tinta", "burdeos"]),
  align: z.enum(["izquierda", "centro"]),
});
type Options = z.infer<typeof optionsSchema>;

const INK: Record<Options["color"], string> = { negro: "#141414", "azul-tinta": "#1b2a4a", burdeos: "#5a1f2b" };

/** "Editorial": Didone names at cover scale, no ornaments, one rule above the details. */
function Editorial({ data, options, format, qrCodes }: SharedTemplateProps<Options>) {
  const g = geometryOf(format);
  const ink = INK[options.color];
  const left = options.align === "izquierda" && !g.story;
  const serif = fontFamily("bodoni-moda");
  const sans = fontFamily("inter");
  // Long names shrink so the cover-scale headline never pushes the details off the page.
  const longest = Math.max(data.couple.partnerOne.length, data.couple.partnerTwo.length);
  const nameScale = g.story ? 1 : longest > 30 ? 0.52 : longest > 22 ? 0.7 : 1;
  const css = `
.trim{color:${ink};font-family:'${sans}',sans-serif;font-weight:300;display:grid;grid-template-rows:auto 1fr auto;padding:calc(var(--u)*${g.story ? 8 : 6}) calc(var(--u)*${g.story ? 7 : 7});text-align:${left ? "left" : "center"}}
.kicker{font-size:calc(var(--u)*${g.story ? 2.4 : 1.15});letter-spacing:.4em;text-transform:uppercase;opacity:.75}
.parents{display:flex;justify-content:space-between;gap:calc(var(--u)*3);font-size:calc(var(--u)*${g.story ? 2.6 : 1.3});line-height:1.5;opacity:.8}
${g.story ? ".parents{flex-direction:column;align-items:center}" : ""}
.names{font-family:'${serif}',serif;font-weight:400;line-height:.95;letter-spacing:-.02em;align-self:center;font-size:calc(var(--u)*${g.story ? 13 : 8 * nameScale});overflow-wrap:anywhere}
.names .amp{display:block;font-style:italic;font-size:.45em;margin:.2em 0;opacity:.7;letter-spacing:0}
.date{font-family:'${serif}',serif;letter-spacing:.45em;text-transform:uppercase;font-size:calc(var(--u)*${g.story ? 3 : 1.5});margin-bottom:calc(var(--u)*1.6)}
.details{display:grid;grid-template-columns:${g.story ? "1fr" : "repeat(3,1fr)"};gap:calc(var(--u)*${g.story ? 2.4 : 3});border-top:1px solid ${ink};padding-top:calc(var(--u)*1.6);font-size:calc(var(--u)*${g.story ? 2.5 : 1.1});line-height:1.45;text-align:${left ? "left" : "center"}}
.details h3{font-size:.8em;letter-spacing:.3em;text-transform:uppercase;font-weight:500;margin-bottom:.4em}
.links{display:flex;gap:calc(var(--u)*3);justify-content:${left ? "flex-start" : "center"};margin-top:calc(var(--u)*1.6);font-size:calc(var(--u)*${g.story ? 2.2 : 1})}
.qr-block{display:inline-flex;flex-direction:column;align-items:center;gap:.4em}
.qr svg{width:calc(var(--u)*${g.story ? 13 : 6});height:calc(var(--u)*${g.story ? 13 : 6});display:block}
a{color:${ink}}`;
  const { couple, ceremony, party, rsvp, issuedAt } = data;
  return (
    <Page format={format} background="#fbfaf8" css={css}>
      {g.story ? (
        <p className="kicker">Nos casamos</p>
      ) : (
        <div className="parents" data-block="parents">
          <p>{data.parentsOne.map((n) => <span key={n}>{n}<br /></span>)}</p>
          <p className="kicker" style={{ alignSelf: "center" }}>Tienen el agrado de invitarle</p>
          <p style={{ textAlign: "right" }}>{data.parentsTwo.map((n) => <span key={n}>{n}<br /></span>)}</p>
        </div>
      )}
      <h1 className="names" data-block="couple">
        {g.story ? firstName(couple.partnerOne) : couple.partnerOne}
        <span className="amp">&amp;</span>
        {g.story ? firstName(couple.partnerTwo) : couple.partnerTwo}
      </h1>
      <div>
        <p className="date">{g.story ? dottedDate(ceremony.date) : formatSpanishDate(ceremony.date)}</p>
        <div className="details">
          <div data-block="ceremony"><h3>Ceremonia</h3>{ceremony.description}<br />{ceremony.address}<br />{ceremony.time} horas</div>
          {party ? <div data-block="party"><h3>Recepción</h3>{party.venue}<br />{party.address}<br />{party.time} horas</div> : null}
          <div data-block="rsvp"><h3>S.R.C.</h3>{rsvp.phones.join(" · ")}{rsvp.email ? <><br />{rsvp.email}</> : null}<br />{issuedAt.city}, {issuedAt.label}</div>
        </div>
        <Links data={data} format={format} qrCodes={qrCodes} />
      </div>
    </Page>
  );
}

export const editorialV1 = defineSharedDataTemplate<Options>({
  meta: { id: "editorial", version: 1, name: "Editorial", description: "Tipografía de portada a gran escala, sin ornamentos. Moderna y sobria." },
  optionsSchema,
  defaultOptions: { color: "negro", align: "izquierda" },
  optionSpecs: [
    { name: "color", label: "Color", choices: { negro: "Negro", "azul-tinta": "Azul tinta", burdeos: "Burdeos" } },
    { name: "align", label: "Alineación", choices: { izquierda: "Izquierda", centro: "Centrada" } },
  ],
  Component: Editorial,
  fonts: () => ["bodoni-moda", "inter"],
});
