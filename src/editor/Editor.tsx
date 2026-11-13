import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Format } from "@/invitations/formats";
import { fieldForIssue, toFormState, toTemplateData, type FormState } from "./form-state";
import { createPreviewScheduler, type PreviewResponse, type PreviewResult } from "./preview-scheduler";

const FORMAT_LABELS: Record<Format, string> = {
  "print-pdf": "Imprenta",
  "digital-pdf": "PDF digital",
  png: "Imagen PNG",
  jpg: "Imagen JPG",
  story: "Historia 9:16",
};

type TemplateOptions = Record<string, string>;

export interface OptionSpec {
  name: string;
  label: string;
  choices: Record<string, string>;
}

interface Props {
  invitationId: string;
  initialData: unknown;
  initialOptions: TemplateOptions;
  optionSpecs: OptionSpec[];
  paid: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

function Field({
  label,
  name,
  value,
  onChange,
  error,
  multiline,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
}) {
  const id = `f-${name}`;
  const props = {
    id,
    name,
    value,
    placeholder,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  };
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? <Textarea rows={3} {...props} /> : <Input type={type} {...props} />}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function OptionGroup({
  spec,
  value,
  onChange,
}: {
  spec: OptionSpec;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5" role="radiogroup" aria-label={spec.label}>
      <span className="text-sm font-medium">{spec.label}</span>
      <div className="flex flex-wrap gap-2">
        {Object.entries(spec.choices).map(([key, text]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            role="radio"
            aria-checked={value === key}
            variant={value === key ? "default" : "outline"}
            onClick={() => onChange(key)}
          >
            {text}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** Editor island (design §5): form on the left, server-rendered watermarked preview on the right. */
export default function Editor({ invitationId, initialData, initialOptions, optionSpecs, paid }: Props) {
  const [form, setForm] = useState<FormState>(() => toFormState(initialData));
  const [options, setOptions] = useState<TemplateOptions>(initialOptions);
  const [format, setFormat] = useState<Format>("png");
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "options", string>>>({});
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [preview, setPreview] = useState<PreviewResult>({ status: "loading" });
  const [lastGood, setLastGood] = useState<{ url: string; overflow: boolean } | null>(null);
  const firstRender = useRef(true);

  const data = useMemo(() => toTemplateData(form), [form]);
  const payload = useMemo(() => ({ data, options, format }), [data, options, format]);

  const scheduler = useMemo(
    () =>
      createPreviewScheduler({
        fetchPreview: async (input, sequence, signal): Promise<PreviewResponse> => {
          const response = await fetch(`/api/invitations/${invitationId}/preview`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...(input as object), sequence }),
            signal,
          });
          const seq = Number(response.headers.get("x-sequence") ?? sequence);
          if (response.status === 200) {
            const url = URL.createObjectURL(await response.blob());
            return { status: "ok", url, overflow: response.headers.get("x-overflow") === "true", sequence: seq };
          }
          if (response.status === 503 || response.status === 429) return { status: "busy", sequence: seq };
          if (response.status === 422) return { status: "invalid", sequence: seq };
          return { status: "failed", sequence: seq };
        },
        onResult: (result) => {
          setPreview(result);
          if (result.status === "ok") {
            setLastGood((previous) => {
              if (previous) URL.revokeObjectURL(previous.url);
              return { url: result.url, overflow: result.overflow };
            });
          }
        },
      }),
    [invitationId],
  );

  useEffect(() => () => scheduler.dispose(), [scheduler]);
  useEffect(() => scheduler.request(payload), [scheduler, payload]);

  // Autosave (debounced). Validation errors from the server are shown inline.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState("saving");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/invitations/${invitationId}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ data, options }),
        });
        const body = await response.json();
        if (response.ok) {
          setErrors({});
          setServerMessage(null);
          setSaveState("saved");
        } else if (body.status === "invalid") {
          const next: typeof errors = {};
          for (const issue of body.issues as { path: string; message: string }[]) {
            next[fieldForIssue(issue.path)] ??= translate(issue.message);
          }
          setErrors(next);
          setServerMessage(null);
          setSaveState("idle");
        } else {
          setServerMessage(body.message ?? "No pudimos guardar los cambios.");
          setSaveState("error");
        }
      } catch {
        setSaveState("error");
        setServerMessage("Sin conexión. Reintentaremos al editar de nuevo.");
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [data, options, invitationId]);

  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setIn = <K extends "parentsOne" | "parentsTwo" | "phones">(key: K, index: number) => (value: string) =>
    setForm((f) => {
      const copy = [...f[key]] as FormState[K];
      copy[index] = value;
      return { ...f, [key]: copy };
    });

  const complete = Object.keys(errors).length === 0 && !!form.partnerOne && !!form.partnerTwo;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <form className="grid gap-6" onSubmit={(e) => e.preventDefault()} aria-label="Datos de la invitación">
        <Section title="Novios">
          <Field label="Nombre completo de la novia o novio" name="partnerOne" value={form.partnerOne} onChange={set("partnerOne")} error={errors.partnerOne} />
          <Field label="Nombre completo de la novia o novio" name="partnerTwo" value={form.partnerTwo} onChange={set("partnerTwo")} error={errors.partnerTwo} />
          {paid ? <p className="text-sm text-muted-foreground">Los nombres quedaron fijados al pagar; puedes corregir errores menores.</p> : null}
        </Section>
        <Section title="Padres">
          <Field label="Padres (primera familia) — nombre 1" name="parentsOne0" value={form.parentsOne[0]} onChange={setIn("parentsOne", 0)} error={errors.parentsOne} />
          <Field label="Padres (primera familia) — nombre 2 (opcional)" name="parentsOne1" value={form.parentsOne[1]} onChange={setIn("parentsOne", 1)} />
          <Field label="Padres (segunda familia) — nombre 1" name="parentsTwo0" value={form.parentsTwo[0]} onChange={setIn("parentsTwo", 0)} error={errors.parentsTwo} />
          <Field label="Padres (segunda familia) — nombre 2 (opcional)" name="parentsTwo1" value={form.parentsTwo[1]} onChange={setIn("parentsTwo", 1)} />
        </Section>
        <Section title="Ceremonia">
          <Field label="Descripción" name="ceremonyDescription" multiline value={form.ceremonyDescription} onChange={set("ceremonyDescription")} error={errors.ceremonyDescription} placeholder="Ceremonia religiosa que se efectuará en…" />
          <Field label="Dirección" name="ceremonyAddress" value={form.ceremonyAddress} onChange={set("ceremonyAddress")} error={errors.ceremonyAddress} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" name="ceremonyDate" type="date" value={form.ceremonyDate} onChange={set("ceremonyDate")} error={errors.ceremonyDate} />
            <Field label="Hora" name="ceremonyTime" type="time" value={form.ceremonyTime} onChange={set("ceremonyTime")} error={errors.ceremonyTime} />
          </div>
        </Section>
        <Section title="Recepción (opcional)">
          <Field label="Lugar" name="partyVenue" value={form.partyVenue} onChange={set("partyVenue")} error={errors.partyVenue} />
          <Field label="Dirección" name="partyAddress" value={form.partyAddress} onChange={set("partyAddress")} error={errors.partyAddress} />
          <Field label="Hora" name="partyTime" type="time" value={form.partyTime} onChange={set("partyTime")} error={errors.partyTime} />
        </Section>
        <Section title="Confirmación (S.R.C.)">
          <Field label="Teléfono 1" name="phone0" type="tel" value={form.phones[0]} onChange={setIn("phones", 0)} error={errors.phones} placeholder="+56 9 1234 5678" />
          <Field label="Teléfono 2 (opcional)" name="phone1" type="tel" value={form.phones[1]} onChange={setIn("phones", 1)} />
          <Field label="Teléfono 3 (opcional)" name="phone2" type="tel" value={form.phones[2]} onChange={setIn("phones", 2)} />
          <Field label="Email (opcional)" name="rsvpEmail" type="email" value={form.rsvpEmail} onChange={set("rsvpEmail")} error={errors.rsvpEmail} />
        </Section>
        <Section title="Lugar y fecha de emisión">
          <Field label="Ciudad" name="issuedCity" value={form.issuedCity} onChange={set("issuedCity")} error={errors.issuedCity} />
          <Field label="Texto de fecha" name="issuedLabel" value={form.issuedLabel} onChange={set("issuedLabel")} error={errors.issuedLabel} placeholder="octubre 2026" />
        </Section>
        <Section title="Enlaces (opcionales)">
          <Field label="Enlace al mapa del lugar (https)" name="venueMapUrl" type="url" value={form.venueMapUrl} onChange={set("venueMapUrl")} error={errors.venueMapUrl} />
          <Field label="Lista de regalos: texto" name="giftLabel" value={form.giftLabel} onChange={set("giftLabel")} error={errors.giftLabel} />
          <Field label="Lista de regalos: enlace (https)" name="giftUrl" type="url" value={form.giftUrl} onChange={set("giftUrl")} error={errors.giftUrl} />
          <Field label="Dirección para el sobre" name="envelopeAddress" value={form.envelopeAddress} onChange={set("envelopeAddress")} error={errors.envelopeAddress} />
        </Section>
        <Section title="Estilo">
          {optionSpecs.map((spec) => (
            <OptionGroup
              key={spec.name}
              spec={spec}
              value={options[spec.name]}
              onChange={(v) => setOptions((o) => ({ ...o, [spec.name]: v }))}
            />
          ))}
        </Section>
      </form>

      <section className="grid content-start gap-4 lg:sticky lg:top-6" aria-label="Vista previa">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Formato">
          {(Object.keys(FORMAT_LABELS) as Format[]).map((f) => (
            <Button key={f} type="button" size="sm" role="tab" aria-selected={format === f} variant={format === f ? "default" : "outline"} onClick={() => setFormat(f)}>
              {FORMAT_LABELS[f]}
            </Button>
          ))}
        </div>
        <div className="relative grid min-h-64 place-items-center rounded-lg border bg-muted/40 p-4">
          {lastGood ? (
            <img src={lastGood.url} alt="Vista previa de la invitación con marca de agua" className={`max-h-[75vh] w-auto shadow-md transition-opacity ${preview.status === "loading" ? "opacity-60" : ""}`} />
          ) : (
            <p className="text-sm text-muted-foreground">Completa los datos para ver la vista previa.</p>
          )}
          <div aria-live="polite" className="absolute bottom-3 left-3 right-3 text-center text-sm">
            {preview.status === "loading" ? <span className="rounded bg-background/90 px-2 py-1">Actualizando vista previa…</span> : null}
            {preview.status === "invalid" ? <span className="rounded bg-background/90 px-2 py-1">Completa los campos marcados para actualizar la vista previa.</span> : null}
            {preview.status === "failed" ? (
              <span className="inline-flex items-center gap-2 rounded bg-background/90 px-2 py-1">
                No pudimos generar la vista previa.
                <Button type="button" size="sm" variant="outline" onClick={() => scheduler.retry(payload)}>
                  Reintentar
                </Button>
              </span>
            ) : null}
          </div>
        </div>
        {lastGood?.overflow && preview.status !== "loading" ? (
          <p role="alert" className="text-sm text-destructive">
            El texto no cabe en el diseño. Acorta algún campo largo (descripción, direcciones o nombres).
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {{ idle: "", saving: "Guardando…", saved: "Cambios guardados", error: "" }[saveState]}
          </span>
          {paid ? (
            <a className="text-sm font-medium underline" href={`/invitaciones/${invitationId}/descargas`}>Ir a descargas</a>
          ) : (
            <Button asChild disabled={!complete}>
              <a href={`/invitaciones/${invitationId}/pagar`} aria-disabled={!complete}>Continuar al pago</a>
            </Button>
          )}
        </div>
        {serverMessage ? <p role="alert" className="text-sm text-destructive">{serverMessage}</p> : null}
      </section>
    </div>
  );
}

function translate(message: string) {
  if (/required|expected/i.test(message)) return "Este campo es obligatorio o tiene un formato inválido.";
  if (/url|https/i.test(message)) return "Usa un enlace que comience con https://";
  if (/email/i.test(message)) return "Ingresa un email válido.";
  return message;
}
