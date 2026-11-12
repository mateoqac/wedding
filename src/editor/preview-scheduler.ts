export const DEBOUNCE_MS = 500;
/** Editor backoff when the preview service answers 503 (D2). */
export const BACKOFF_MS = [500, 1000, 2000, 4000];

export type PreviewResponse =
  | { status: "ok"; url: string; overflow: boolean; sequence: number }
  | { status: "busy"; sequence: number }
  | { status: "invalid"; sequence: number }
  | { status: "failed"; sequence: number };

export type FetchPreview = (input: unknown, sequence: number, signal: AbortSignal) => Promise<PreviewResponse>;

export type PreviewResult =
  | { status: "loading" }
  | { status: "ok"; url: string; overflow: boolean }
  | { status: "invalid" }
  | { status: "failed" };

/**
 * Debounces preview requests, tags each one with an increasing sequence number, aborts the
 * superseded in-flight request and drops stale responses (design §5).
 */
export function createPreviewScheduler({
  fetchPreview,
  onResult,
}: {
  fetchPreview: FetchPreview;
  onResult: (result: PreviewResult) => void;
}) {
  let sequence = 0;
  let latest = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: AbortController | undefined;

  async function run(input: unknown, attempt: number, seq: number) {
    if (seq !== latest) return;
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    let response: PreviewResponse;
    try {
      response = await fetchPreview(input, seq, controller.signal);
    } catch {
      if (controller.signal.aborted || seq !== latest) return;
      response = { status: "failed", sequence: seq };
    }
    if (seq !== latest || response.sequence !== seq) return;

    if (response.status === "busy") {
      if (attempt < BACKOFF_MS.length) {
        timer = setTimeout(() => void run(input, attempt + 1, seq), BACKOFF_MS[attempt]);
      } else {
        onResult({ status: "failed" });
      }
      return;
    }
    if (response.status === "ok") onResult({ status: "ok", url: response.url, overflow: response.overflow });
    else onResult({ status: response.status });
  }

  return {
    request(input: unknown) {
      clearTimeout(timer);
      onResult({ status: "loading" });
      timer = setTimeout(() => {
        sequence++;
        latest = sequence;
        void run(input, 0, sequence);
      }, DEBOUNCE_MS);
    },
    /** Immediately re-runs the last request (retry button). */
    retry(input: unknown) {
      clearTimeout(timer);
      sequence++;
      latest = sequence;
      onResult({ status: "loading" });
      void run(input, 0, sequence);
    },
    dispose() {
      clearTimeout(timer);
      inFlight?.abort();
    },
  };
}
