import { spawn } from "node:child_process";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StateStore, atomicWrite } from "./state-store.mjs";
import { Publisher } from "./publisher.mjs";
import { createVenueServer } from "./server.mjs";
import { operatorConsole } from "./cli.mjs";
import { validateCatalog } from "../../src/lib/congestion-contract.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const build = path.join(root, ".congestion-preview/site");
const runtime = path.join(root, ".congestion-preview/runtime");
async function main() {
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw new Error("Node 24以上を使用してください");
  const env = {
    ...process.env,
    SITE_ENV: "development",
    SITE_URL: "https://specialtest.bunkasai.info",
    SITE_INDEXING: "false",
    CONGESTION_DEMO: "1",
  };
  if (!process.argv.includes("--skip-build")) {
    const astroDirectory = path.join(root, "node_modules/astro");
    const astroPackage = JSON.parse(
      await readFile(path.join(astroDirectory, "package.json"), "utf8"),
    );
    const astroCli = path.join(astroDirectory, astroPackage.bin.astro);
    await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          astroCli,
          "build",
          "--outDir",
          build,
        ],
        { cwd: root, env, stdio: "inherit", windowsHide: true },
      );
      child.once("error", reject);
      child.once("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`デモビルド失敗 (${code})`)),
      );
    });
  }
  const catalog = validateCatalog(
    JSON.parse(await readFile(path.join(build, "games/catalog.json"), "utf8")),
  );
  if (!catalog.demo) throw new Error("デモ専用カタログが必要です");
  await mkdir(runtime, { recursive: true });
  const store = await new StateStore(
    catalog,
    path.join(runtime, catalog.catalog_id),
  ).init();
  if (store.read().session_id === null) {
    await store.command("start", "demo-day");
    for (const [id, level] of [
      ["rhythm", "low"],
      ["bullet-hell", "normal"],
      ["racing", "high"],
      ["pinball", "low"],
    ])
      await store.observe(id, level);
  }
  let published = null;
  const publisher = new Publisher(
    store,
    async (snapshot, isCurrent, onTransferred) => {
      if (!isCurrent()) return false;
      await atomicWrite(
        path.join(runtime, "congestion.json"),
        JSON.stringify(snapshot),
      );
      published = snapshot;
      onTransferred({
        saved_version: snapshot.saved_version,
        generated_at: snapshot.generated_at,
        completed_at: new Date().toISOString(),
      });
      return true;
    },
  );
  const config = { local_origin: "http://127.0.0.1:8787" };
  const server = createVenueServer({
    config,
    catalog,
    store,
    publisher,
    previewRoot: build,
    previewSnapshot: () => published,
  });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(8787, "127.0.0.1", resolve);
    });
  } catch (error) {
    await store.close();
    throw error;
  }
  await publisher.tick();
  operatorConsole({
    server,
    store,
    publisher,
    catalog,
    origin: config.local_origin,
  });
  console.log(
    "\n公開ページのプレビュー: http://127.0.0.1:8787/games/\nデモはこのPC内だけで動作します。外部ホストへの転送は行いません。",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
