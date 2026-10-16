import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { demoContent } from "../../../src/data/congestion-demo.mjs";
import { StateStore } from "../state-store.mjs";
export const NOW = Date.parse("2026-10-14T03:00:00Z");
export function catalogFixture() {
  const data = {
    ...demoContent(new Date(NOW)),
    schema_version: 1,
    environment: "development",
    site_url: "https://specialtest.bunkasai.info",
    demo: true,
    poll_seconds: 15,
    publication_ttl_seconds: 60,
    observation_ttl_seconds: 600,
    clock_tolerance_seconds: 1,
  };
  return {
    ...data,
    catalog_id: createHash("sha256").update(JSON.stringify(data)).digest("hex"),
  };
}
export async function storeFixture(t, catalog = catalogFixture()) {
  const directory = await mkdtemp(path.join(tmpdir(), "ennichi-test-"));
  let now = NOW;
  const store = await new StateStore(catalog, directory, () => now).init();
  t.after(() => store.close());
  return {
    store,
    directory,
    catalog,
    setNow: (value) => {
      now = value;
    },
  };
}
