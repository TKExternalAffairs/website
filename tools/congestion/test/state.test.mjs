import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { StateStore } from "../state-store.mjs";
import { acceptance } from "../../../src/lib/congestion-contract.mjs";
import { storeFixture, NOW } from "./helpers.mjs";

test("初期状態はNULLで、開始前は保存を拒否する", async (t) => {
  const { store } = await storeFixture(t);
  assert.ok(
    Object.values(store.read().games).every((entry) => entry.level === null),
  );
  await assert.rejects(store.observe("rhythm", "low"));
  assert.equal(store.read().saved_version, "0");
});
test("同時更新は保存順に直列化し、再選択も確認時刻を更新する", async (t) => {
  const { store, setNow } = await storeFixture(t);
  await store.command("start", "demo-day");
  const writes = await Promise.all([
    store.observe("rhythm", "low"),
    store.observe("rhythm", "normal"),
    store.observe("rhythm", "high"),
  ]);
  assert.deepEqual(
    writes.map((state) => state.saved_version),
    ["2", "3", "4"],
  );
  assert.equal(store.read().games.rhythm.level, "high");
  setNow(NOW + 1000);
  await store.observe("rhythm", "high");
  assert.equal(
    store.read().games.rhythm.observed_at,
    new Date(NOW + 1000).toISOString(),
  );
});
test("停止とスマホ更新が競合しても、停止後の更新は受け付けない", async (t) => {
  const { store } = await storeFixture(t);
  await store.command("start", "demo-day");
  const results = await Promise.allSettled([
    store.command("stop"),
    store.observe("rhythm", "low"),
  ]);
  assert.equal(results[1].status, "rejected");
  assert.equal(store.read().games.rhythm.level, null);
});
test("時間外の開始・更新と未知のゲーム・混雑値を拒否する", async (t) => {
  const { store, catalog, setNow } = await storeFixture(t);
  await store.command("start", "demo-day");
  await assert.rejects(store.observe("missing", "low"));
  await assert.rejects(store.observe("rhythm", "unknown"));
  setNow(Date.parse(catalog.sessions[0].ends_at));
  assert.equal(acceptance(store.read(), catalog, store.clock()), "closed");
  await assert.rejects(store.observe("rhythm", "low"));
  await assert.rejects(store.command("start", "demo-day"));
});
test("新セッションへ切り替えると全件NULLになり、前日の値を持ち越さない", async (t) => {
  const { store, catalog, setNow } = await storeFixture(t);
  catalog.sessions.push({
    id: "day-two",
    label: "二日目",
    starts_at: "2026-10-15T09:00:00+09:00",
    ends_at: "2026-10-15T16:00:00+09:00",
  });
  await store.command("start", "demo-day");
  await store.observe("rhythm", "low");
  setNow(Date.parse("2026-10-15T01:00:00Z"));
  await store.command("start", "day-two");
  assert.ok(
    Object.values(store.read().games).every(
      (entry) => entry.level === null && entry.observed_at === null,
    ),
  );
});
test("再起動は保存状態を復元し、確認時刻を変更しない", async (t) => {
  const { store, catalog, directory } = await storeFixture(t);
  await store.command("start", "demo-day");
  await store.observe("rhythm", "normal");
  const before = store.read();
  await store.close();
  const restarted = await new StateStore(
    catalog,
    directory,
    () => NOW + 60000,
  ).init();
  t.after(() => restarted.close());
  assert.deepEqual(restarted.read(), before);
});
test("直前の正常状態がバックアップに残り、破損した状態は自動初期化しない", async (t) => {
  const { store, catalog, directory } = await storeFixture(t);
  await store.command("start", "demo-day");
  const before = store.read();
  await store.observe("rhythm", "high");
  assert.deepEqual(
    JSON.parse(await readFile(`${store.filename}.bak`, "utf8")),
    before,
  );
  await store.close();
  await writeFile(store.filename, "{broken");
  await assert.rejects(new StateStore(catalog, directory).init());
  assert.equal(await readFile(store.filename, "utf8"), "{broken");
});
test("状態ファイルだけ失われた場合はバックアップを無視して初期化しない", async (t) => {
  const { store, catalog, directory } = await storeFixture(t);
  await store.command("start", "demo-day");
  await store.close();
  await unlink(store.filename);
  await assert.rejects(
    new StateStore(catalog, directory).init(),
    /バックアップ/,
  );
});
test("同じ作業領域での二重起動を拒否する", async (t) => {
  const { catalog, directory } = await storeFixture(t);
  await assert.rejects(new StateStore(catalog, directory).init(), /使用中/);
});
test("保存失敗は成功にならず、次の正常な更新を妨げない", async (t) => {
  const { store, directory } = await storeFixture(t);
  await store.command("start", "demo-day");
  const before = store.read();
  const original = store.filename;
  store.filename = path.join(directory, "cannot-replace-directory");
  await mkdir(store.filename);
  await assert.rejects(store.observe("rhythm", "high"));
  assert.deepEqual(store.read(), before);
  store.filename = original;
  await store.observe("rhythm", "low");
  assert.equal(store.read().games.rhythm.level, "low");
});
test("resetは受付を止めてNULL化、resumeは確認時刻を改変しない", async (t) => {
  const { store } = await storeFixture(t);
  await store.command("start", "demo-day");
  await store.observe("rhythm", "normal");
  const observed = store.read().games.rhythm.observed_at;
  await store.command("stop");
  await store.command("resume");
  assert.equal(store.read().games.rhythm.observed_at, observed);
  await store.command("reset");
  assert.equal(store.read().accepting, false);
  assert.equal(store.read().games.rhythm.level, null);
});
