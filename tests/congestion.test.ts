import test from "node:test";
import assert from "node:assert/strict";
import { getStatusView, MAX_STATUS_AGE_MS } from "../src/lib/congestion.ts";
const now = Date.parse("2026-10-30T01:00:00Z");
const feed = (status: string, age = 0, waitMinutes: unknown = 10) => ({
  version: 1,
  venues: {
    target: {
      status,
      updatedAt: new Date(now - age).toISOString(),
      waitMinutes,
    },
  },
});
test("never shows an old waiting time as current", () => {
  const view = getStatusView(
    feed("crowded", MAX_STATUS_AGE_MS, 30),
    "target",
    now,
  );
  assert.equal(view.label, "情報未更新");
  assert.equal(view.waitMinutes, null);
});
test("active information shows its optional zero-minute estimate", () => {
  const view = getStatusView(feed("open", 0, 0), "target", now);
  assert.equal(view.status, "open");
  assert.equal(view.waitMinutes, 0);
});
test("closed or suspended venues never show a queue estimate", () => {
  for (const status of ["closed", "paused"])
    assert.equal(getStatusView(feed(status), "target", now).waitMinutes, null);
});
test("missing, malformed, future and unsupported data fail to unknown", () => {
  for (const payload of [
    null,
    {},
    { version: 2, venues: {} },
    feed("bad"),
    feed("open", -120001),
    {
      version: 1,
      venues: { target: { status: "open", updatedAt: "invalid" } },
    },
  ]) {
    const view = getStatusView(payload, "target", now);
    assert.equal(view.status, "unknown");
    assert.equal(view.waitMinutes, null);
  }
});
test("unpublished entries remain unpublished and invalid wait estimates are ignored", () => {
  assert.equal(
    getStatusView(
      {
        version: 1,
        venues: { target: { status: "unknown", updatedAt: null } },
      },
      "target",
      now,
    ).reason,
    "unpublished",
  );
  for (const wait of [-1, 1.5, "10", 601])
    assert.equal(
      getStatusView(feed("busy", 0, wait), "target", now).waitMinutes,
      null,
    );
  assert.equal(getStatusView(feed("open"), "missing", now).status, "unknown");
});
