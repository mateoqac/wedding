import { z } from "zod";
import { defineSharedDataTemplate } from "@/templates/shared/define-template";
import { fontFamily } from "@/templates/shared/fonts";
import { Links, Page, firstName, formatSpanishDate, geometryOf, initialOf, type SharedTemplateProps } from "@/templates/shared/parts";

const optionsSchema = z.object({
  color: z.enum(["azul-noche", "verde-bosque", "negro"]),
  seal: z.enum(["circulo", "escudo"]),
});
type Options = z.infer<typeof optionsSchema>;

const PALETTE: Record<Options["color"], { ink: string; accent: string }> = {
  "azul-noche": { ink: "#1e2a44", accent: "#8a7344" },
  "verde-bosque": { ink: "#24392f", accent: "#9a7d4a" },
  negro: { ink: "#1a1a1a", accent: "#7d6a4a" },
};

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
function romanYear(year: number) {
  const map: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [value, symbol] of map) while (year >= value) { out += symbol; year -= value; }
  return out;
}
function romanDayMonth(n: number) {
  return n <= 12 ? ROMAN[n] : romanYear(n);
}

/** Seal with the couple's initials; generated from the names, so it always matches them. */
function Seal({ one, two, date, shape, ink, accent, serif }: { one: string; two: string; date: string; shape: Options["seal"]; ink: string; accent: string; serif: string }) {
  const [y, m, d] = date.split("-").map(Number);
  const legend = `${romanDayMonth(d)} · ${romanDayMonth(m)} · ${romanYear(y)}`;
  return (
    <svg className="seal" viewBox="0 0 240 240" role="img" aria-label={`Monograma ${one} y ${two}`}>
      {shape === "circulo" ? (
        <>
          <circle cx="120" cy="120" r="112" fill="none" stroke={accent} strokeWidth="1.5" />
          <circle cx="120" cy="120" r="104" fill="none" stroke={accent} strokeWidth=".75" strokeDasharray="2 4" />
        </>
      ) : (
        <>
          <path d="M120 10 L214 40 V120 C214 180 170 214 120 232 C70 214 26 180 26 120 V40 Z" fill="none" stroke={accent} strokeWidth="1.5" />
          <path d="M120 22 L202 48 V120 C202 172 164 202 120 218 C76 202 38 172 38 120 V48 Z" fill="none" stroke={accent} strokeWidth=".75" strokeDasharray="2 4" />
        </>
      )}
      <text x="98" y="146" fontSize="104" fill={ink} textAnchor="middle" fontFamily={serif}>{one}</text>
      <text x="146" y="166" fontSize="104" fill={accent} textAnchor="middle" fontFamily={serif} fontStyle="italic">{two}</text>
      <path id="seal-arc" d="M 44 128 A 76 76 0 0 0 196 128" fill="none" />
      <text fontSize="11" letterSpacing="3" fill={ink} fontFamily={serif}>
        <textPath href="#seal-arc" startOffset="50%" textAnchor="middle">{legend}</textPath>
      </text>
    </svg>
  );
}

function Monograma({ data, options, format, qrCodes }: SharedTemplateProps<Options>) {
  const g = geometryOf(format);
  const { ink, accent } = PALETTE[options.color];
  const serif = fontFamily("bodoni-moda");
  const text = fontFamily("libre-baskerville");
  const sans = fontFamily("inter");
  const { couple, ceremony, party, rsvp, issuedAt } = data;
  const longest = Math.max(couple.partnerOne.length, couple.partnerTwo.length);
  const nameSize = g.story ? 6.5 : longest > 30 ? 2.5 : 3.2;
  const css = `
.trim{color:${ink};font-family:'${text}',serif;display:grid;${g.story
    ? "align-content:center;justify-items:center;text-align:center;gap:calc(var(--u)*3);padding:calc(var(--u)*9) calc(var(--u)*8)"
    : "grid-template-columns:34% 1fr;align-items:center;gap:calc(var(--u)*5);padding:calc(var(--u)*5) calc(var(--u)*6)"}}
.seal{width:${g.story ? "calc(var(--u)*50)" : "100%"};height:auto;display:block}
.body{display:grid;gap:calc(var(--u)*${g.story ? 2.2 : 1.1});${g.story ? "" : `border-left:1px solid ${accent};padding-left:calc(var(--u)*4)`}}
.small{font-size:calc(var(--u)*${g.story ? 2.7 : 1.2});line-height:1.55}
.caps{font-family:'${sans}',sans-serif;font-weight:500;font-size:calc(var(--u)*${g.story ? 2.2 : 0.95});letter-spacing:.22em;text-transform:uppercase;color:${accent}}
.names{font-weight:400;line-height:1.12;font-size:calc(var(--u)*${nameSize});overflow-wrap:anywhere}
.names .y{color:${accent};font-style:italic;font-size:.7em}
.links{display:flex;gap:calc(var(--u)*3);${g.story ? "justify-content:center;" : ""}font-size:calc(var(--u)*${g.story ? 2.2 : 0.95})}
.qr-block{display:inline-flex;flex-direction:column;align-items:center;gap:.4em}
.qr svg{width:calc(var(--u)*${g.story ? 13 : 6});height:calc(var(--u)*${g.story ? 13 : 6});display:block}
a{color:${ink}}`;
  const seal = <Seal one={initialOf(couple.partnerOne)} two={initialOf(couple.partnerTwo)} date={ceremony.date} shape={options.seal} ink={ink} accent={accent} serif={serif} />;
  return (
    <Page format={format} background="#fdfcf9" css={css}>
      {seal}
      <div className="body">
        {g.story ? (
          <>
            <p className="caps">Nos casamos</p>
            <h1 className="names" data-block="couple">{firstName(couple.partnerOne)} <span className="y">y</span> {firstName(couple.partnerTwo)}</h1>
            <p className="small" data-block="ceremony">{formatSpanishDate(ceremony.date)}<br />{ceremony.time} horas · {ceremony.address}</p>
            {party ? <p className="small" data-block="party">Recepción {party.time} horas · {party.venue}</p> : null}
          </>
        ) : (
          <>
            <p className="small" data-block="parents">{data.parentsOne.join(" y ")}<br />{data.parentsTwo.join(" y ")}</p>
            <p className="caps">tienen el agrado de invitarle al matrimonio de</p>
            <h1 className="names" data-block="couple">{couple.partnerOne} <span className="y">y</span><br />{couple.partnerTwo}</h1>
            <p className="small" data-block="ceremony">{ceremony.description}<br />{formatSpanishDate(ceremony.date)}, {ceremony.time} horas · {ceremony.address}</p>
            {party ? <p className="small" data-block="party">Recepción {party.time} horas · {party.venue}, {party.address}</p> : null}
            <p className="caps" data-block="rsvp">S.R.C. {rsvp.phones.join(" · ")}{rsvp.email ? ` · ${rsvp.email}` : ""}</p>
            <p className="small"><em>{issuedAt.city}, {issuedAt.label}</em></p>
          </>
        )}
        <Links data={data} format={format} qrCodes={qrCodes} />
      </div>
    </Page>
  );
}

export const monogramaV1 = defineSharedDataTemplate<Options>({
  meta: { id: "monograma", version: 1, name: "Monograma", description: "Sus iniciales entrelazadas en un sello, con la fecha en números romanos." },
  optionsSchema,
  defaultOptions: { color: "azul-noche", seal: "circulo" },
  optionSpecs: [
    { name: "color", label: "Color", choices: { "azul-noche": "Azul noche", "verde-bosque": "Verde bosque", negro: "Negro" } },
    { name: "seal", label: "Sello", choices: { circulo: "Círculo", escudo: "Escudo" } },
  ],
  Component: Monograma,
  fonts: () => ["bodoni-moda", "libre-baskerville", "inter"],
});
