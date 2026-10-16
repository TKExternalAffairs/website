import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  acceptance,
  LEVELS,
  isObject,
} from "../../src/lib/congestion-contract.mjs";

const uiRoot = fileURLToPath(new URL("./ui/", import.meta.url));
const uiFiles = new Map([
  ["/staff/congestion/", ["index.html", "text/html; charset=utf-8"]],
  ["/staff/congestion/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/staff/congestion/style.css", ["style.css", "text/css; charset=utf-8"]],
  [
    "/staff/congestion/voyage/voyage-logo.webp",
    ["voyage/voyage-logo.webp", "image/webp"],
  ],
  ["/staff/congestion/voyage/ship.webp", ["voyage/ship.webp", "image/webp"]],
  ["/staff/congestion/voyage/paper.webp", ["voyage/paper.webp", "image/webp"]],
  ["/staff/congestion/voyage/wave.webp", ["voyage/wave.webp", "image/webp"]],
]);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2",
};
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
async function bodyJson(request) {
  if (
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
      request.headers["content-type"] || "",
    )
  )
    throw new HttpError(415, "JSON形式で送信してください");
  if (
    request.headers["content-encoding"] &&
    request.headers["content-encoding"] !== "identity"
  )
    throw new HttpError(415, "圧縮本文は使用できません");
  if (Number(request.headers["content-length"]) > 2048)
    throw new HttpError(413, "送信内容が大きすぎます");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2048) throw new HttpError(413, "送信内容が大きすぎます");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "JSON形式が不正です");
  }
}
export function createVenueServer({
  config,
  catalog,
  store,
  publisher,
  previewRoot,
  previewSnapshot,
}) {
  const allowedHost = new URL(config.local_origin).host;
  return http.createServer(
    { requestTimeout: 10000, headersTimeout: 10000, maxHeaderSize: 8192 },
    async (request, response) => {
      const send = (
        status,
        value,
        type = "application/json; charset=utf-8",
      ) => {
        response.writeHead(status, {
          "Content-Type": type,
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          "X-Frame-Options": "DENY",
        });
        response.end(
          type.startsWith("application/json") && !Buffer.isBuffer(value)
            ? JSON.stringify(value)
            : value,
        );
      };
      try {
        if (request.headers.host !== allowedHost)
          throw new HttpError(403, "設定されたPC URLを使用してください");
        const url = new URL(request.url, config.local_origin);
        if (request.method === "GET" && url.pathname === "/api/status") {
          const state = store.read();
          return send(200, {
            schema_version: 1,
            event_id: catalog.event_id,
            demo: catalog.demo,
            catalog: catalog.games,
            sessions: catalog.sessions,
            session_id: state.session_id,
            acceptance: acceptance(state, catalog, store.clock()),
            saved_version: state.saved_version,
            games: state.games,
            server_time: new Date(store.clock()).toISOString(),
            publication: publisher.status(),
          });
        }
        const update =
          /^\/api\/games\/([a-z0-9]+(?:-[a-z0-9]+)*)\/congestion$/.exec(
            url.pathname,
          );
        if (request.method === "POST" && update) {
          if (request.headers.origin !== config.local_origin)
            throw new HttpError(403, "PCのスタッフ画面から操作してください");
          if (!catalog.games.some((game) => game.id === update[1]))
            throw new HttpError(404, "登録されていないゲームです");
          const data = await bodyJson(request);
          if (
            !isObject(data) ||
            Object.keys(data).length !== 1 ||
            typeof data.level !== "string" ||
            !Object.hasOwn(LEVELS, data.level)
          )
            throw new HttpError(400, "3つの混雑状況から選択してください");
          // Enqueue-time validation in observe also closes the race with console stop/session changes.
          if (acceptance(store.read(), catalog, store.clock()) !== "open")
            throw new HttpError(409, "現在は受付時間外、または受付停止中です");
          let state;
          try {
            state = await store.observe(update[1], data.level);
          } catch {
            throw new HttpError(
              503,
              "PCへの保存を確認できません。状態を読み直してください",
            );
          }
          publisher.request();
          return send(200, {
            ok: true,
            saved_version: state.saved_version,
            observed_at: state.games[update[1]].observed_at,
            publication: "pending",
          });
        }
        if (request.method !== "GET")
          throw new HttpError(405, "この操作は使用できません");
        if (url.pathname === "/staff/congestion") {
          response.writeHead(302, {
            Location: `/staff/congestion/${url.search}`,
          });
          return response.end();
        }
        const asset = uiFiles.get(url.pathname);
        if (asset) {
          response.setHeader(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
          );
          return send(
            200,
            await readFile(path.join(uiRoot, asset[0])),
            asset[1],
          );
        }
        // Only the explicit demo launcher can expose the separately built static preview.
        if (catalog.demo && previewRoot) {
          if (url.pathname === "/live/congestion.json") {
            const snapshot = previewSnapshot?.();
            if (!snapshot) throw new HttpError(503, "プレビューの発行待ちです");
            return send(200, snapshot);
          }
          if (
            url.pathname.startsWith("/api/") ||
            url.pathname.startsWith("/staff/")
          )
            throw new HttpError(404, "ページがありません");
          let relative;
          try {
            relative = decodeURIComponent(url.pathname);
          } catch {
            throw new HttpError(400, "URLが不正です");
          }
          if (
            relative.includes("\\") ||
            relative.includes("\0") ||
            relative.split("/").some((part) => part.startsWith("."))
          )
            throw new HttpError(404, "ページがありません");
          const filename = path.resolve(
            previewRoot,
            `.${relative.endsWith("/") ? relative + "index.html" : relative}`,
          );
          const within = path.relative(path.resolve(previewRoot), filename);
          if (within.startsWith("..") || path.isAbsolute(within))
            throw new HttpError(404, "ページがありません");
          const type = mime[path.extname(filename)];
          if (!type) throw new HttpError(404, "ページがありません");
          try {
            return send(200, await readFile(filename), type);
          } catch (error) {
            if (error.code !== "ENOENT" && error.code !== "EISDIR") throw error;
          }
        }
        throw new HttpError(404, "ページがありません");
      } catch (error) {
        if (!response.headersSent)
          send(error instanceof HttpError ? error.status : 500, {
            ok: false,
            error:
              error instanceof HttpError
                ? error.message
                : "PC側でエラーが発生しました。運営者へ連絡してください。",
          });
        else response.end();
      }
    },
  );
}
