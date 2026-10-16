import { readFile } from "node:fs/promises";
import path from "node:path";
import { isIPv4 } from "node:net";
import {
  validateCatalog,
  requireValue,
} from "../../src/lib/congestion-contract.mjs";

export async function loadConfig(filename) {
  const configPath = path.resolve(filename);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const catalog = validateCatalog(
    JSON.parse(
      await readFile(
        path.resolve(path.dirname(configPath), config.catalog),
        "utf8",
      ),
    ),
  );
  for (const key of ["environment", "event_id", "site_url"])
    requireValue(
      config[key] === catalog[key],
      `PC設定とカタログの ${key} が一致しません`,
    );
  requireValue(
    !catalog.demo && catalog.games.length > 0 && catalog.sessions.length > 0,
    "本番運用には正式なゲームと開催セッションが必要です",
  );
  requireValue(
    JSON.stringify(config.sessions) === JSON.stringify(catalog.sessions),
    "PC設定とカタログの開催セッションが一致しません",
  );
  const origin = new URL(config.local_origin);
  requireValue(
    origin.protocol === "http:" &&
      isIPv4(origin.hostname) &&
      !origin.username &&
      !origin.password &&
      origin.pathname === "/" &&
      !origin.search &&
      !origin.hash &&
      origin.origin === config.local_origin,
    "local_origin は固定LAN IPv4のHTTPオリジンを指定してください",
  );
  const port = Number(origin.port || 80);
  requireValue(
    Number.isInteger(port) && port >= 1024 && port <= 65535,
    "PCのポートが不正です",
  );
  requireValue(
    config.listen_host === origin.hostname || config.listen_host === "0.0.0.0",
    "待受アドレスがPC URLと一致しません",
  );
  requireValue(
    typeof config.state_directory === "string" &&
      config.state_directory.length > 0,
    "状態保存ディレクトリが必要です",
  );
  const target = config.transfer;
  requireValue(
    target && ["ftp", "ftps", "ftps-implicit"].includes(target.protocol),
    "転送プロトコルの明示が必要です",
  );
  requireValue(
    target.environment === catalog.environment &&
      target.site_url === catalog.site_url &&
      target.event_id === catalog.event_id,
    "転送先とサイト・イベントの対応が一致しません",
  );
  requireValue(
    target.verified === true,
    "転送先の実機確認後に verified を true にしてください",
  );
  requireValue(
    typeof target.host === "string" &&
      /^[a-zA-Z0-9.-]+$/.test(target.host) &&
      !target.host.endsWith(".invalid"),
    "転送先ホストを確認してください",
  );
  requireValue(
    Number.isInteger(target.port) && target.port > 0 && target.port <= 65535,
    "FTPポートが不正です",
  );
  requireValue(
    typeof target.directory === "string" &&
      /^\/(?:[^\s\\]+\/)*live\/$/.test(target.directory) &&
      !target.directory.includes(".."),
    "転送先は確認済みの /.../live/ を指定してください",
  );
  for (const key of ["user_env", "password_env"])
    requireValue(
      typeof target[key] === "string" &&
        /^[A-Z][A-Z0-9_]+$/.test(target[key]) &&
        process.env[target[key]],
      "FTPの認証用環境変数が未設定です",
    );
  // Network verification happens inside the publisher, so an internet outage
  // cannot prevent local queue management or recovery after a PC restart.
  return {
    config: {
      ...config,
      port,
      state_directory: path.resolve(
        path.dirname(configPath),
        config.state_directory,
      ),
    },
    catalog,
  };
}
