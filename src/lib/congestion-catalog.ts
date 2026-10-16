import process from "node:process";
import { createHash } from "node:crypto";
import { games, type Game } from "../data/games";
import { congestionEvent } from "../data/congestion-event";
import { demoContent } from "../data/congestion-demo.mjs";
import { validateCatalog } from "./congestion-contract.mjs";
import { currentSiteEnvironment, SITE_URL } from "./site";

const demo = process.env.CONGESTION_DEMO === "1";
if (demo && (currentSiteEnvironment !== "development" || process.env.CI))
  throw new Error("デモデータはローカル development ビルド専用です");
const content = demo ? demoContent() : { ...congestionEvent, games };
const data = {
  ...congestionEvent,
  ...content,
  schema_version: 1 as const,
  environment: currentSiteEnvironment,
  site_url: SITE_URL,
  demo,
  games: content.games as Game[],
};
export const congestionCatalog = {
  ...data,
  catalog_id: createHash("sha256").update(JSON.stringify(data)).digest("hex"),
};
validateCatalog(congestionCatalog);
