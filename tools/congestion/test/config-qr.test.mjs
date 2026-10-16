import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../config.mjs";
import { exportStaffQR } from "../qr.mjs";
import { storeFixture } from "./helpers.mjs";

test("PC設定の誤環境・未確認転送先・日時の不一致で起動しない", async (t) => {
  const { catalog, directory } = await storeFixture(t);
  const actual = { ...catalog, demo: false };
  await writeFile(path.join(directory, "catalog.json"), JSON.stringify(actual));
  const config = JSON.parse(
    await readFile(new URL("../config.example.json", import.meta.url), "utf8"),
  );
  const filename = path.join(directory, "config.json");
  const check = async (value) => {
    await writeFile(filename, JSON.stringify(value));
    await assert.rejects(loadConfig(filename));
  };
  await check({ ...config, environment: "production" });
  await check({ ...config, event_id: catalog.event_id });
  await check({
    ...config,
    event_id: catalog.event_id,
    sessions: catalog.sessions,
  });
});
test("QRはゲームごとのURLをPC内で生成し、HTMLをエスケープする", async (t) => {
  const { catalog, directory } = await storeFixture(t);
  catalog.games[0].name = '<script>alert("test")</script>';
  const filename = await exportStaffQR(
    catalog,
    "http://127.0.0.1:8787",
    directory,
  );
  const html = await readFile(filename, "utf8");
  assert.equal((html.match(/<svg/g) || []).length, catalog.games.length);
  assert.ok(html.includes("/staff/congestion/?game=rhythm"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("https://"));
});
