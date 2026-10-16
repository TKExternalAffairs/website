import { readFile, open, rename, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  acceptance,
  sessionAt,
  validateEntries,
  requireValue,
  isObject,
  LEVELS,
} from "../../src/lib/congestion-contract.mjs";

export async function atomicWrite(filename, data) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(data, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    // Same-directory rename replaces the old file. Never delete the destination first.
    await rename(temporary, filename);
  } finally {
    await handle?.close();
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
const emptyGames = (catalog) =>
  Object.fromEntries(
    catalog.games.map(({ id }) => [id, { level: null, observed_at: null }]),
  );

export class StateStore {
  constructor(catalog, directory, clock = Date.now) {
    this.catalog = catalog;
    this.directory = path.resolve(directory);
    this.filename = path.join(this.directory, "state.json");
    this.clock = clock;
    this.queue = Promise.resolve();
    this.state = null;
    this.lock = null;
  }
  validate(state) {
    requireValue(
      isObject(state) &&
        state.schema_version === 1 &&
        state.catalog_id === this.catalog.catalog_id &&
        state.event_id === this.catalog.event_id &&
        state.environment === this.catalog.environment,
      "保存状態の形式・環境・カタログが一致しません",
    );
    requireValue(
      typeof state.saved_version === "string" &&
        /^(0|[1-9]\d*)$/.test(state.saved_version),
      "保存版番号が不正です",
    );
    requireValue(typeof state.accepting === "boolean", "受付状態が不正です");
    requireValue(
      state.session_id === null || !!sessionAt(this.catalog, state.session_id),
      "保存セッションが不正です",
    );
    requireValue(
      state.session_id !== null || !state.accepting,
      "セッションなしで受付できません",
    );
    validateEntries(state.games, this.catalog, state.session_id);
    return state;
  }
  async init() {
    await mkdir(this.directory, { recursive: true });
    try {
      this.lock = await open(
        path.join(this.directory, "server.lock"),
        "wx",
        0o600,
      );
    } catch (error) {
      if (error.code === "EEXIST")
        throw new Error(
          "PC状態は使用中です。停止を確認してから運用手順に沿ってロックを復旧してください",
        );
      throw error;
    }
    try {
      await this.lock.writeFile(JSON.stringify({ pid: process.pid }));
      let source;
      try {
        source = await readFile(this.filename, "utf8");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        let backupExists = true;
        try {
          await readFile(`${this.filename}.bak`);
        } catch (backupError) {
          if (backupError.code === "ENOENT") backupExists = false;
          else throw backupError;
        }
        requireValue(
          !backupExists,
          "状態ファイルがありません。バックアップから明示的に復旧してください",
        );
      }
      if (source !== undefined) this.state = this.validate(JSON.parse(source));
      else {
        this.state = {
          schema_version: 1,
          catalog_id: this.catalog.catalog_id,
          event_id: this.catalog.event_id,
          environment: this.catalog.environment,
          saved_version: "0",
          session_id: null,
          accepting: false,
          games: emptyGames(this.catalog),
        };
        await atomicWrite(this.filename, JSON.stringify(this.state));
      }
      return this;
    } catch (error) {
      await this.close();
      throw error;
    }
  }
  read() {
    return structuredClone(this.state);
  }
  enqueue(change) {
    const operation = this.queue.then(async () => {
      const next = this.read();
      change(next, this.clock());
      next.saved_version = (BigInt(this.state.saved_version) + 1n).toString();
      this.validate(next);
      await atomicWrite(`${this.filename}.bak`, JSON.stringify(this.state));
      await atomicWrite(this.filename, JSON.stringify(next));
      this.state = next;
      return this.read();
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  observe(gameId, level) {
    return this.enqueue((state, now) => {
      requireValue(
        Object.hasOwn(state.games, gameId),
        "登録されていないゲームです",
      );
      requireValue(Object.hasOwn(LEVELS, level), "混雑値が不正です");
      requireValue(
        acceptance(state, this.catalog, now) === "open",
        "現在は受付時間外、または受付停止中です",
      );
      state.games[gameId] = { level, observed_at: new Date(now).toISOString() };
    });
  }
  command(command, sessionId) {
    return this.enqueue((state, now) => {
      if (["select", "start"].includes(command)) {
        requireValue(
          !!sessionAt(this.catalog, sessionId),
          "登録セッションIDを指定してください",
        );
        if (state.session_id !== sessionId) {
          state.session_id = sessionId;
          state.games = emptyGames(this.catalog);
        }
        state.accepting = command === "start";
        if (command === "start")
          requireValue(
            acceptance(state, this.catalog, now) === "open",
            "セッションの開催時間外です",
          );
      } else if (command === "resume") {
        state.accepting = true;
        requireValue(
          acceptance(state, this.catalog, now) === "open",
          "セッションの開催時間外です",
        );
      } else if (command === "stop") state.accepting = false;
      else if (command === "reset") {
        state.accepting = false;
        state.games = emptyGames(this.catalog);
      } else throw new Error("不明な運営コマンドです");
    });
  }
  async close() {
    await this.queue;
    if (this.lock) {
      await this.lock.close();
      this.lock = null;
      await unlink(path.join(this.directory, "server.lock"));
    }
  }
}
