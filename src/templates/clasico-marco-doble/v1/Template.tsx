import type { ReactNode } from "react";
import type { Format } from "@/invitations/formats";
import { parseIsoDate } from "@/invitations/iso-date";
import { FONTS } from "./fonts";
import { formats } from "./formats";
import { COLORS, type TemplateOptions } from "./options";
import type { InvitationData } from "./schema";

export interface TemplateProps {
  data: InvitationData;
  options: TemplateOptions;
  format: Format;
  /** Precomputed QR SVG markup keyed by link URL (raster and print formats). */
  qrCodes?: Record<string, string>;
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2027-03-13" -> "sábado 13 de marzo de 2027" (computed in UTC, no locale data needed). */
export function formatSpanishDate(iso: string): string {
  const parts = parseIsoDate(iso);
  if (!parts) throw new Error(`Invalid date ${iso}`);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} de ${MONTHS[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
}

function Link({ url, label, mode, qrCodes }: { url: string; label: string; mode: "qr" | "clickable"; qrCodes?: Record<string, string> }) {
  if (mode === "clickable") return <a href={url} className="link">{label}</a>;
  const svg = qrCodes?.[url];
  return (
    <span className="qr-block">
      {svg ? <span className="qr" dangerouslySetInnerHTML={{ __html: svg }} /> : null}
      <span className="qr-label">{label}</span>
    </span>
  );
}

function Rings() {
  return (
    <svg className="emblem" viewBox="0 0 60 36" aria-hidden="true">
      <circle cx="22" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="38" cy="18" r="13" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CropMarks({ bleed }: { bleed: number }) {
  const m = `${bleed}mm`;
  const style = (pos: Record<string, string>) => ({ position: "absolute" as const, background: "#000", ...pos });
  const marks: ReactNode[] = [];
  for (const v of ["top", "bottom"] as const) {
    for (const h of ["left", "right"] as const) {
      marks.push(<span key={`${v}${h}h`} style={style({ [v]: m, [h]: "0", width: `calc(${m} - 0.5mm)`, height: "0.1mm" })} />);
      marks.push(<span key={`${v}${h}v`} style={style({ [h]: m, [v]: "0", height: `calc(${m} - 0.5mm)`, width: "0.1mm" })} />);
    }
  }
  return <div data-crop-marks="1">{marks}</div>;
}

function css(width: string, ink: string, family: string, double: boolean, story: boolean) {
  const u = `calc(${width} / 100)`;
  return `
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
.page{position:relative;overflow:hidden;color:${ink};font-family:'${family}',serif;text-align:center;--u:${u};background:#fffdf8}
.frame{position:absolute;inset:calc(var(--u)*${story ? 4 : 3});border:calc(var(--u)*0.25) solid ${ink};${double ? `outline:calc(var(--u)*0.12) solid ${ink};outline-offset:calc(var(--u)*-1.1);` : ""}display:flex;flex-direction:column;justify-content:safe center;gap:calc(var(--u)*${story ? 2.2 : 1.1});padding:calc(var(--u)*${story ? 5 : 3}) calc(var(--u)*6)}
.parents{display:flex;justify-content:space-between;gap:calc(var(--u)*4);font-size:calc(var(--u)*${story ? 2.8 : 1.7});line-height:1.3}
${story ? ".parents{flex-direction:column}" : ""}
.parents div{flex:1}
.intro{font-size:calc(var(--u)*${story ? 2.8 : 1.7});font-style:italic}
.couple{font-size:calc(var(--u)*${story ? 6.2 : 3.6});line-height:1.15;font-weight:600;overflow-wrap:anywhere}
.amp{display:block;font-size:0.6em;font-weight:400}
.emblem{width:calc(var(--u)*${story ? 14 : 6});margin:0 auto;display:block;flex-shrink:0;color:${ink}}
.block{font-size:calc(var(--u)*${story ? 2.7 : 1.6});line-height:1.35;overflow-wrap:anywhere}
.when{font-weight:600}
.links{display:flex;justify-content:center;gap:calc(var(--u)*4);flex-wrap:nowrap}
.links>span{max-width:45%}
.qr-block{display:inline-flex;flex-direction:column;align-items:center;gap:calc(var(--u)*0.5);font-size:calc(var(--u)*${story ? 2.2 : 1.2})}
.qr svg{width:calc(var(--u)*${story ? 13 : 8});height:calc(var(--u)*${story ? 13 : 8});display:block}
.link{color:${ink}}
.issued{font-size:calc(var(--u)*${story ? 2.8 : 1.3});font-style:italic}
`;
}

/** Pure render of the invitation; preview and export use this same component (design §5). */
export function Template({ data, options, format, qrCodes }: TemplateProps) {
  const geometry = formats[format];
  const unit = geometry.unit;
  const width = `${geometry.width}${unit}`;
  const height = `${geometry.height}${unit}`;
  const story = geometry.layout === "story";
  const ink = COLORS[options.color];
  const family = FONTS[options.font].family;
  const bleed = geometry.bleed;
  const trimWidth = bleed ? `${geometry.width - 2 * bleed}${unit}` : width;
  const { party, giftRegistry, venueMapUrl } = data;

  return (
    <div className="page" style={{ width, height }}>
      <style>{css(trimWidth, ink, family, options.frame === "doble", story)}</style>
      {bleed ? <CropMarks bleed={bleed} /> : null}
      <div style={{ position: "absolute", inset: bleed ? `${bleed}${unit}` : 0 }}>
        <div className="frame">
          <div className="parents" data-block="parents">
            <div>{data.parentsOne.map((n) => <p key={n}>{n}</p>)}</div>
            <div>{data.parentsTwo.map((n) => <p key={n}>{n}</p>)}</div>
          </div>
          <p className="intro">tienen el agrado de invitar a usted al matrimonio de sus hijos</p>
          {options.emblem === "anillos" ? <Rings /> : null}
          <h1 className="couple" data-block="couple">
            {data.couple.partnerOne}
            <span className="amp">y</span>
            {data.couple.partnerTwo}
          </h1>
          <div className="block" data-block="ceremony">
            <p>{data.ceremony.description}</p>
            <p className="when">
              el {formatSpanishDate(data.ceremony.date)}, a las {data.ceremony.time} horas
            </p>
            <p>{data.ceremony.address}</p>
          </div>
          {party ? (
            <div className="block" data-block="party">
              <p>Y luego a la recepción que se ofrecerá a las {party.time} horas en</p>
              <p className="when">{party.venue}</p>
              <p>{party.address}</p>
            </div>
          ) : null}
          <div className="block" data-block="rsvp">
            <p>
              S.R.C. {data.rsvp.phones.join(" · ")}
              {data.rsvp.email ? ` · ${data.rsvp.email}` : ""}
            </p>
          </div>
          {venueMapUrl || giftRegistry ? (
            <div className="links">
              {venueMapUrl ? (
                <span data-block="map">
                  <Link url={venueMapUrl} label="Cómo llegar" mode={geometry.links} qrCodes={qrCodes} />
                </span>
              ) : null}
              {giftRegistry ? (
                <span className="block" data-block="gift">
                  {giftRegistry.url ? (
                    <Link url={giftRegistry.url} label={giftRegistry.label ?? "Lista de regalos"} mode={geometry.links} qrCodes={qrCodes} />
                  ) : (
                    <span>{giftRegistry.label}</span>
                  )}
                </span>
              ) : null}
            </div>
          ) : null}
          <p className="issued">
            {data.issuedAt.city}, {data.issuedAt.label}
          </p>
        </div>
      </div>
    </div>
  );
}
