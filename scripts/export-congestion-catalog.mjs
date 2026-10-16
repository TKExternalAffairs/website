import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { validateCatalog } from "../src/lib/congestion-contract.mjs";

const source = path.resolve(process.argv[2] || "dist");
const destination = path.resolve(process.argv[3] || ".congestion/catalog.json");
for (const root of ["public", source]) {
  try {
    await access(path.join(root, "live"));
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  throw new Error(`${root}/live は静的配信に含められません`);
}
const catalog = validateCatalog(
  JSON.parse(await readFile(path.join(source, "games/catalog.json"), "utf8")),
);
await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify(catalog, null, 2) + "\n");
console.log(
  `PC用カタログを出力しました (${catalog.environment}, ${catalog.games.length} games${catalog.demo ? ", DEMO" : ""})`,
);
