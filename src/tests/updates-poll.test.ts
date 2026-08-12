import { describe, expect, it, vi } from "vitest";
import { resolveUpdate } from "../core/updates.js";
import type { Update } from "../types/komodo.js";
import { makeMockClient } from "./helpers.js";

function makeUpdate(overrides: Partial<Update> = {}): Update {
  return {
    _id: { $oid: "u1" },
    operation: "RestartStack",
    start_ts: 0,
    success: false,
    operator: "tester",
    target: { type: "Stack", id: "s1" },
    logs: [],
    status: "InProgress",
    ...overrides,
  } as Update;
}

describe("resolveUpdate", () => {
  it("returns the submitted update untouched when wait is false", async () => {
    const mockClient = makeMockClient();
    const submitted = makeUpdate();

    const resolved = await resolveUpdate(mockClient, submitted, {
      wait: false,
    });

    expect(resolved).toBe(submitted);
    expect(mockClient.read).not.toHaveBeenCalled();
  });

  it("returns immediately when the update is already Complete", async () => {
    const mockClient = makeMockClient();
    const submitted = makeUpdate({ status: "Complete", success: true });

    const resolved = await resolveUpdate(mockClient, submitted, {});

    expect(resolved).toBe(submitted);
    expect(mockClient.read).not.toHaveBeenCalled();
  });

  it("polls GetUpdate until the update completes", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.read)
      .mockResolvedValueOnce(makeUpdate({ status: "InProgress" }))
      .mockResolvedValueOnce(makeUpdate({ status: "Complete", success: true }));

    const resolved = await resolveUpdate(mockClient, makeUpdate(), {}, 1);

    expect(resolved.status).toBe("Complete");
    expect(resolved.success).toBe(true);
    expect(mockClient.read).toHaveBeenCalledWith("GetUpdate", { id: "u1" });
  });

  it("keeps polling after a transient GetUpdate failure", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.read)
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(makeUpdate({ status: "Complete", success: true }));

    const resolved = await resolveUpdate(mockClient, makeUpdate(), {}, 1);

    expect(resolved.status).toBe("Complete");
    expect(resolved.success).toBe(true);
    expect(mockClient.read).toHaveBeenCalledTimes(2);
  });

  it("returns the latest known update when every poll fails", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.read).mockRejectedValue(new Error("timeout"));
    const submitted = makeUpdate();

    const resolved = await resolveUpdate(
      mockClient,
      submitted,
      { wait_timeout_seconds: 0.02 },
      1,
    );

    expect(resolved).toBe(submitted);
    expect(mockClient.read).toHaveBeenCalled();
  });

  it("does not overshoot the deadline when a poll hangs", async () => {
    const mockClient = makeMockClient();
    // A read that never settles — mimics a GetUpdate hanging until the
    // client's own request timeout, well past our wait deadline.
    vi.mocked(mockClient.read).mockReturnValue(new Promise(() => {}));
    const submitted = makeUpdate();

    const startedAt = Date.now();
    const resolved = await resolveUpdate(
      mockClient,
      submitted,
      { wait_timeout_seconds: 0.05 },
      1,
    );
    const elapsed = Date.now() - startedAt;

    expect(resolved).toBe(submitted);
    expect(elapsed).toBeLessThan(500);
  });

  it("returns the latest state when the timeout elapses", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.read).mockResolvedValue(
      makeUpdate({ status: "InProgress" }),
    );

    const resolved = await resolveUpdate(
      mockClient,
      makeUpdate(),
      { wait_timeout_seconds: 0.02 },
      1,
    );

    expect(resolved.status).toBe("InProgress");
  });
});
