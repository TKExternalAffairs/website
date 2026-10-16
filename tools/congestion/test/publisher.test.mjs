import test from "node:test";
import assert from "node:assert/strict";
import { Publisher, ftpTransport, makeSnapshot } from "../publisher.mjs";
import { storeFixture, NOW } from "./helpers.mjs";

test("転送中の変更はキューを積まず、次回は最新状態だけ送る", async (t) => {
  const { store } = await storeFixture(t);
  await store.command("start", "demo-day");
  let release;
  const sent = [];
  const publisher = new Publisher(
    store,
    async (snapshot, isCurrent) => {
      sent.push(snapshot);
      if (sent.length === 1)
        await new Promise((resolve) => {
          release = resolve;
        });
      return isCurrent();
    },
    { clock: () => NOW, heartbeatMs: 60000 },
  );
  t.after(() => publisher.close());
  const first = publisher.tick();
  await store.observe("rhythm", "low");
  await store.observe("rhythm", "high");
  publisher.request();
  release();
  await first;
  await publisher.tick();
  assert.deepEqual(
    sent.map((snapshot) => snapshot.saved_version),
    ["1", "3"],
  );
  assert.equal(publisher.status().state, "published");
  assert.equal(sent[1].games[0].level, "high");
});
test("転送失敗はPC保存に影響せず、再試行では最新状態を公開する", async (t) => {
  const { store } = await storeFixture(t);
  await store.command("start", "demo-day");
  let fail = true;
  const publisher = new Publisher(
    store,
    async () => {
      if (fail) throw new Error("password=secret /private-path");
      return true;
    },
    { clock: () => NOW, retryBaseMs: 60000 },
  );
  t.after(() => publisher.close());
  await publisher.tick();
  assert.equal(publisher.status().state, "error");
  assert.ok(!JSON.stringify(publisher.status()).includes("secret"));
  await store.observe("rhythm", "normal");
  assert.equal(store.read().games.rhythm.level, "normal");
  fail = false;
  await publisher.tick();
  assert.equal(
    publisher.status().last_success.saved_version,
    store.read().saved_version,
  );
});
test("heartbeatは発行時刻だけを更新し、確認時刻と保存版は維持する", async (t) => {
  const { store } = await storeFixture(t);
  await store.command("start", "demo-day");
  await store.observe("rhythm", "low");
  const sent = [];
  let now = NOW;
  const publisher = new Publisher(
    store,
    async (snapshot) => {
      sent.push(snapshot);
      return true;
    },
    { clock: () => now },
  );
  t.after(() => publisher.close());
  await publisher.tick();
  now += 60000;
  await publisher.tick();
  assert.equal(sent[0].saved_version, sent[1].saved_version);
  assert.equal(sent[0].games[0].observed_at, sent[1].games[0].observed_at);
  assert.notEqual(sent[0].generated_at, sent[1].generated_at);
});
async function ftpFixture(
  t,
  { renameFails = false, current = true, readbackMatches = true } = {},
) {
  const { store, catalog } = await storeFixture(t);
  const snapshot = makeSnapshot(store.read(), catalog, NOW);
  const calls = [];
  const client = {
    closed: false,
    async access(options) {
      calls.push([
        "access",
        options.secure,
        options.secureOptions.rejectUnauthorized,
      ]);
    },
    async cd(directory) {
      calls.push(["cd", directory]);
    },
    async uploadFrom(source, name) {
      for await (const _ of source) {
        /* consume */
      }
      calls.push(["upload", name]);
    },
    async rename(from, to) {
      calls.push(["rename", from, to]);
      if (renameFails) throw new Error("unsupported");
    },
    async remove(name) {
      calls.push(["remove", name]);
    },
    close() {
      this.closed = true;
      calls.push(["close"]);
    },
  };
  const transport = ftpTransport(
    {
      protocol: "ftps",
      host: "dummy.invalid",
      port: 21,
      directory: "/demo/live/",
      site_url: catalog.site_url,
    },
    {
      clientFactory: () => client,
      fetcher: async (url) => {
        const isCatalog = url.includes("/games/catalog.json");
        calls.push([isCatalog ? "catalog" : "readback"]);
        return new Response(
          JSON.stringify(isCatalog ? catalog : readbackMatches ? snapshot : {}),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  );
  return { calls, run: () => transport(snapshot, () => current) };
}
test("FTPは一時ファイル→rename→HTTPS照合の順で、TLSを検証する", async (t) => {
  const { calls, run } = await ftpFixture(t);
  assert.equal(await run(), true);
  assert.deepEqual(
    calls.map((call) => call[0]),
    ["catalog", "access", "cd", "upload", "rename", "readback", "close"],
  );
  assert.deepEqual(calls[1], ["access", true, true]);
  assert.equal(calls[4][2], "congestion.json");
});
test("ホストがrenameを拒否しても現在の公開JSONは削除しない", async (t) => {
  const { calls, run } = await ftpFixture(t, { renameFails: true });
  await assert.rejects(run());
  assert.ok(
    calls
      .filter((call) => call[0] === "remove")
      .every((call) => call[1].endsWith(".tmp")),
  );
  assert.ok(!calls.some((call) => call[0] === "readback"));
});
test("転送中にセッション・受付が変わった版はrenameせず破棄する", async (t) => {
  const { calls, run } = await ftpFixture(t, { current: false });
  assert.equal(await run(), false);
  assert.ok(!calls.some((call) => call[0] === "rename"));
});
test("FTP成功でもHTTPSで違う内容が返れば公開反映成功にしない", async (t) => {
  const { run } = await ftpFixture(t, { readbackMatches: false });
  await assert.rejects(run(), /MISMATCH/);
});
