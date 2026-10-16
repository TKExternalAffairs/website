import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCatalog,
  validateSnapshot,
  snapshotCondition,
  gameCondition,
  hostClock,
} from "../../../src/lib/congestion-contract.mjs";
import { makeSnapshot } from "../publisher.mjs";
import { catalogFixture, storeFixture, NOW } from "./helpers.mjs";

test("必須項目、重複ID、不正時間、別環境、重複セッションはビルド検証で拒否", () => {
  const mutations = [
    (c) => c.games.push(c.games[0]),
    (c) => (c.games[0].id = "UPPER"),
    (c) => (c.games[0].name = ""),
    (c) => (c.games[0].play_minutes_min = 0),
    (c) => (c.games[0].play_minutes_max = 1),
    (c) => (c.games[0].play_minutes_min = "3"),
    (c) => (c.site_url = "https://tkspecial.bunkasai.info"),
    (c) => c.sessions.push({ ...c.sessions[0], id: "overlap" }),
    (c) => (c.sessions[0].ends_at = "tomorrow"),
    (c) => (c.games[0].image = "https://example.com/test.jpg"),
  ];
  assert.doesNotThrow(() => validateCatalog(catalogFixture()));
  for (const mutate of mutations) {
    const catalog = catalogFixture();
    mutate(catalog);
    assert.throws(() => validateCatalog(catalog));
  }
});
test("発行が継続しても現地確認時刻は古くなり、低混雑表示を失効させる", async (t) => {
  const { store, catalog } = await storeFixture(t);
  await store.command("start", "demo-day");
  await store.observe("rhythm", "low");
  const snapshot = makeSnapshot(store.read(), catalog, NOW + 601000);
  validateSnapshot(snapshot, catalog, NOW + 601000);
  assert.equal(snapshotCondition(snapshot, catalog, NOW + 601000), "open");
  assert.equal(
    gameCondition(snapshot.games[0], catalog, NOW + 601000),
    "stale",
  );
  assert.equal(snapshot.games[0].observed_at, new Date(NOW).toISOString());
});
test("公開JSONの期限切れ、前日情報、未確認、停止中を区別する", async (t) => {
  const { store, catalog } = await storeFixture(t);
  await store.command("start", "demo-day");
  let snapshot = makeSnapshot(store.read(), catalog, NOW);
  assert.equal(gameCondition(snapshot.games[0], catalog, NOW), "unknown");
  assert.equal(snapshotCondition(snapshot, catalog, NOW + 60000), "offline");
  assert.equal(snapshotCondition(snapshot, catalog, NOW + 86400000), "closed");
  await store.command("stop");
  snapshot = makeSnapshot(store.read(), catalog, NOW);
  assert.equal(snapshotCondition(snapshot, catalog, NOW), "paused");
});
test("別イベント・別カタログ・未来・不正値・不正セッションのJSONを拒否", async (t) => {
  const { store, catalog } = await storeFixture(t);
  await store.command("start", "demo-day");
  const snapshot = makeSnapshot(store.read(), catalog, NOW);
  for (const change of [
    { event_id: "wrong" },
    { environment: "production" },
    { catalog_id: "bad" },
    { session: { ...snapshot.session, id: "yesterday" } },
    { generated_at: new Date(NOW + 2000).toISOString() },
    { saved_version: 1 },
    { saved_version: "-1" },
    {
      games: [
        {
          id: "rhythm",
          level: "empty",
          observed_at: new Date(NOW).toISOString(),
        },
      ],
    },
    { session: { ...snapshot.session, ends_at: "2026-10-15T00:00:00Z" } },
  ])
    assert.throws(() =>
      validateSnapshot({ ...snapshot, ...change }, catalog, NOW),
    );
});

test("公開JSONの未登録IDを無視し、欠落IDはNULLとする", async (t) => {
  const { store, catalog } = await storeFixture(t);
  const snapshot = makeSnapshot(store.read(), catalog, NOW);
  snapshot.games = [
    {
      id: "unregistered",
      level: "low",
      observed_at: new Date(NOW).toISOString(),
    },
  ];
  const result = validateSnapshot(snapshot, catalog, NOW);
  assert.equal(result.games.length, catalog.games.length);
  assert.ok(
    result.games.every(
      (game) => game.level === null && game.observed_at === null,
    ),
  );
});

test("HTTP Dateが必須で、以降は端末時計ではなく経過時間で判定する", () => {
  assert.throws(() => hostClock(null, 0, () => 0));
  assert.throws(() => hostClock("invalid", 0, () => 0));
  let elapsed = 500;
  const clock = hostClock(new Date(NOW).toUTCString(), 500, () => elapsed);
  assert.equal(clock(), NOW);
  elapsed += 60000;
  assert.equal(clock(), NOW + 60000);
});
