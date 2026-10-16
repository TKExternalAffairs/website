import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createVenueServer } from "../server.mjs";
import { storeFixture } from "./helpers.mjs";

async function fixture(t) {
  const { store, catalog } = await storeFixture(t);
  await store.command("start", "demo-day");
  const publisher = {
    request() {},
    status: () => ({ state: "pending", last_success: null, last_error: null }),
  };
  // Test server chooses an ephemeral port first; config Host is resolved by incoming authority.
  const config = { local_origin: "http://127.0.0.1:8787" };
  const server = createVenueServer({ config, catalog, store, publisher });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const request = (route, options = {}) =>
    new Promise((resolve, reject) => {
      const outgoing = http.request(
        new URL(route, url),
        {
          method: options.method || "GET",
          headers: { Host: "127.0.0.1:8787", ...options.headers },
        },
        (incoming) => {
          const chunks = [];
          incoming.on("data", (chunk) => chunks.push(chunk));
          incoming.on("end", () =>
            resolve(
              new Response(Buffer.concat(chunks), {
                status: incoming.statusCode,
                headers: incoming.headers,
              }),
            ),
          );
        },
      );
      outgoing.on("error", reject);
      outgoing.end(options.body);
    });
  const post = (body, headers = {}, route = "/api/games/rhythm/congestion") =>
    request(route, {
      method: "POST",
      headers: {
        Origin: config.local_origin,
        "Content-Type": "application/json",
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  return { request, post, store };
}
test("APIは保存成功だけを返し、公開反映とは区別する", async (t) => {
  const { post, request } = await fixture(t);
  const response = await post({ level: "normal" });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.publication, "pending");
  assert.equal(typeof result.saved_version, "string");
  const status = await (await request("/api/status")).json();
  assert.equal(status.games.rhythm.level, "normal");
  assert.equal(status.saved_version, result.saved_version);
  assert.equal(status.games.rhythm.observed_at, result.observed_at);
  assert.ok(
    !JSON.stringify(status).match(/password|state_directory|transfer|user_env/),
  );
});
test("Origin、Host、Content-Type、不正JSON、2KB超過を拒否", async (t) => {
  const { post, request } = await fixture(t);
  assert.equal(
    (await post({ level: "low" }, { Origin: "https://evil.example" })).status,
    403,
  );
  assert.equal((await post({ level: "low" }, { Origin: "null" })).status, 403);
  assert.equal((await post({ level: "low" }, { Origin: "" })).status, 403);
  assert.equal(
    (await post({ level: "low" }, { "Content-Type": "text/plain" })).status,
    415,
  );
  assert.equal((await post("{")).status, 400);
  assert.equal((await post("x".repeat(2049))).status, 413);
  assert.equal(
    (await request("/api/status", { headers: { Host: "evil.example" } }))
      .status,
    403,
  );
});
test("3値以外、未知ゲーム、追加キー、配列を拒否する", async (t) => {
  const { post } = await fixture(t);
  for (const body of [
    { level: null },
    { level: "normal", other: true },
    { level: "__proto__" },
    [],
    null,
    2,
  ])
    assert.equal((await post(body)).status, 400);
  assert.equal(
    (await post({ level: "low" }, {}, "/api/games/missing/congestion")).status,
    404,
  );
});
test("停止中の保存、破壊的API、CORS、リポジトリファイルの公開を拒否", async (t) => {
  const { post, request, store } = await fixture(t);
  await store.command("stop");
  assert.equal((await post({ level: "low" })).status, 409);
  for (const pathname of ["/api/reset", "/api/start", "/api/stop"])
    assert.equal((await post({}, {}, pathname)).status, 405);
  for (const pathname of [
    "/.git/config",
    "/package.json",
    "/.congestion/state.json",
    "/staff/congestion/../../config.example.json",
    "/live/congestion.json",
  ])
    assert.equal((await request(pathname)).status, 404);
  assert.equal(
    (await request("/api/status")).headers.get("access-control-allow-origin"),
    null,
  );
});
test("スタッフ画面とアセットはPCから配信し、no-storeとCSPを付ける", async (t) => {
  const { request } = await fixture(t);
  for (const route of [
    "/staff/congestion/",
    "/staff/congestion/app.js",
    "/staff/congestion/style.css",
  ]) {
    const response = await request(route);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.match(
      response.headers.get("content-security-policy"),
      /connect-src 'self'/,
    );
    assert.ok(!(await response.text()).includes("https://"));
  }
});
