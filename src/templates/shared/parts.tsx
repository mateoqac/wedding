import type { CSSProperties, ReactNode } from "react";
import type { Format } from "@/invitations/formats";
import { formats } from "@/templates/clasico-marco-doble/v1/formats";
import type { InvitationData } from "@/templates/clasico-marco-doble/v1/schema";

export { formatSpanishDate } from "@/templates/clasico-marco-doble/v1/Template";

export interface SharedTemplateProps<O> {
  data: InvitationData;
  options: O;
  format: Format;
  qrCodes?: Record<string, string>;
}

export function geometryOf(format: Format) {
  const g = formats[format];
  const trimWidth = `${g.width - 2 * g.bleed}${g.unit}`;
  return { ...g, story: g.layout === "story", trimWidth };
}

function CropMarks({ bleed }: { bleed: number }) {
  const m = `${bleed}mm`;
  const marks: ReactNode[] = [];
  for (const v of ["top", "bottom"] as const) {
    for (const h of ["left", "right"] as const) {
      const base: CSSProperties = { position: "absolute", background: "#000" };
      marks.push(<span key={`${v}${h}h`} style={{ ...base, [v]: m, [h]: 0, width: `calc(${m} - 0.5mm)`, height: "0.1mm" }} />);
      marks.push(<span key={`${v}${h}v`} style={{ ...base, [h]: m, [v]: 0, height: `calc(${m} - 0.5mm)`, width: "0.1mm" }} />);
    }
  }
  return <div data-crop-marks="1">{marks}</div>;
}

/**
 * Page shell shared by templates: exact page size, bleed and crop marks for print, and a
 * `--u` unit equal to 1% of the trim width so every size scales with the format.
 */
export function Page({ format, background, css, children }: { format: Format; background: string; css: string; children: ReactNode }) {
  const g = geometryOf(format);
  return (
    <div className="page" style={{ width: `${g.width}${g.unit}`, height: `${g.height}${g.unit}`, position: "relative", overflow: "hidden", background }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}.page{--u:calc(${g.trimWidth} / 100)}${css}`}</style>
      {g.bleed ? <CropMarks bleed={g.bleed} /> : null}
      <div className="trim" style={{ position: "absolute", inset: g.bleed ? `${g.bleed}${g.unit}` : 0 }}>
        {children}
      </div>
    </div>
  );
}

/** A link rendered as a QR code (print and images) or as a clickable anchor (digital PDF). */
export function LinkOut({ url, label, format, qrCodes, className }: { url: string; label: string; format: Format; qrCodes?: Record<string, string>; className?: string }) {
  if (formats[format].links === "clickable") return <a href={url} className={className}>{label}</a>;
  const svg = qrCodes?.[url];
  return (
    <span className={`qr-block ${className ?? ""}`}>
      {svg ? <span className="qr" dangerouslySetInnerHTML={{ __html: svg }} /> : null}
      <span className="qr-label">{label}</span>
    </span>
  );
}

/** Map and gift links of the shared data, or null when the couple left both empty. */
export function Links({ data, format, qrCodes, className }: { data: InvitationData; format: Format; qrCodes?: Record<string, string>; className?: string }) {
  const { venueMapUrl, giftRegistry } = data;
  if (!venueMapUrl && !giftRegistry) return null;
  return (
    <div className={className ?? "links"}>
      {venueMapUrl ? (
        <span data-block="map"><LinkOut url={venueMapUrl} label="Cómo llegar" format={format} qrCodes={qrCodes} /></span>
      ) : null}
      {giftRegistry ? (
        <span data-block="gift">
          {giftRegistry.url ? (
            <LinkOut url={giftRegistry.url} label={giftRegistry.label ?? "Lista de regalos"} format={format} qrCodes={qrCodes} />
          ) : (
            <span>{giftRegistry.label}</span>
          )}
        </span>
      ) : null}
    </div>
  );
}

/** First given name ("María José Pérez" -> "María"), used for short names in stories. */
export const firstName = (fullName: string) => fullName.trim().split(/\s+/)[0] ?? fullName;

/** Uppercase first letter, keeping accents ("álvaro" -> "Á"); "?" for empty input. */
export const initialOf = (fullName: string) => fullName.trim().charAt(0).toLocaleUpperCase("es-CL") || "?";

/** "2027-03-13" -> "13 · 03 · 2027". */
export const dottedDate = (iso: string) => iso.split("-").reverse().join(" · ");
