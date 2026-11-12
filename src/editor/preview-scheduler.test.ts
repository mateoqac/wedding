import { describe, expect, it, vi } from "vitest";
import { BACKOFF_MS, createPreviewScheduler, type FetchPreview } from "./preview-scheduler";

const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe("preview scheduler", () => {
  it("debounces input and sends increasing sequence numbers", async () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const fetchPreview: FetchPreview = async (_input, sequence) => {
      calls.push(sequence);
      return { status: "ok", url: `img-${sequence}`, overflow: false, sequence };
    };
    const shown: string[] = [];
    const scheduler = createPreviewScheduler({ fetchPreview, onResult: (r) => r.status === "ok" && shown.push(r.url) });

    scheduler.request({ v: 1 });
    await tick(200);
    scheduler.request({ v: 2 });
    await tick(500);
    expect(calls).toEqual([1]);
    expect(shown).toEqual(["img-1"]);
    scheduler.request({ v: 3 });
    await tick(500);
    expect(calls).toEqual([1, 2]);
    vi.useRealTimers();
  });

  it("aborts superseded requests and discards stale responses", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    let resolveFirst: (v: Awaited<ReturnType<FetchPreview>>) => void = () => {};
    const fetchPreview: FetchPreview = (_input, sequence, signal) => {
      signals.push(signal);
      if (sequence === 1) return new Promise((r) => { resolveFirst = r; });
      return Promise.resolve({ status: "ok", url: "img-2", overflow: false, sequence });
    };
    const shown: string[] = [];
    const scheduler = createPreviewScheduler({ fetchPreview, onResult: (r) => r.status === "ok" && shown.push(r.url) });

    scheduler.request({ v: 1 });
    await tick(500);
    scheduler.request({ v: 2 });
    await tick(500);
    expect(signals[0].aborted).toBe(true);
    resolveFirst({ status: "ok", url: "img-1", overflow: false, sequence: 1 });
    await tick(0);
    expect(shown).toEqual(["img-2"]);
    vi.useRealTimers();
  });

  it("retries busy responses with backoff 0.5/1/2/4 s, then reports failure", async () => {
    vi.useFakeTimers();
    expect(BACKOFF_MS).toEqual([500, 1000, 2000, 4000]);
    let calls = 0;
    const fetchPreview: FetchPreview = async (_input, sequence) => {
      calls++;
      return { status: "busy", sequence };
    };
    const results: string[] = [];
    const scheduler = createPreviewScheduler({ fetchPreview, onResult: (r) => results.push(r.status) });
    scheduler.request({ v: 1 });
    await tick(500); // debounce
    expect(calls).toBe(1);
    await tick(500 + 1000 + 2000 + 4000);
    expect(calls).toBe(5);
    expect(results).toEqual(["loading", "failed"]);
    vi.useRealTimers();
  });
});
