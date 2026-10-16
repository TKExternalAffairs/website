import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import {
  acceptance,
  validateCatalog,
} from "../../src/lib/congestion-contract.mjs";

export function makeSnapshot(state, catalog, now = Date.now()) {
  const session = catalog.sessions.find((item) => item.id === state.session_id);
  return {
    schema_version: 1,
    event_id: catalog.event_id,
    environment: catalog.environment,
    catalog_id: catalog.catalog_id,
    session: session
      ? {
          id: session.id,
          starts_at: new Date(session.starts_at).toISOString(),
          ends_at: new Date(session.ends_at).toISOString(),
          accepting: acceptance(state, catalog, now) === "open",
        }
      : null,
    saved_version: state.saved_version,
    generated_at: new Date(now).toISOString(),
    games: Object.entries(state.games).map(([id, entry]) => ({ id, ...entry })),
  };
}

export function ftpTransport(target, { clientFactory, fetcher = fetch } = {}) {
  return async (snapshot, isCurrent, onTransferred = () => {}) => {
    const abort = new AbortController();
    const client = clientFactory
      ? clientFactory()
      : new (await import("basic-ftp")).Client(10000);
    // Fixed prefix and filename; never use game IDs or user input in remote paths.
    const temporary = `congestion-${randomUUID()}.tmp`;
    const deadline = setTimeout(() => {
      abort.abort();
      client.close();
    }, 10000);
    let uploaded = false;
    try {
      const catalogResponse = await fetcher(
        `${target.site_url}/games/catalog.json?verify=${Date.now()}`,
        { cache: "no-store", redirect: "error", signal: abort.signal },
      );
      if (
        !catalogResponse.ok ||
        !/application\/json/i.test(
          catalogResponse.headers.get("content-type") || "",
        )
      )
        throw new Error("PUBLIC_CATALOG_UNAVAILABLE");
      const deployed = validateCatalog(await catalogResponse.json());
      if (
        deployed.catalog_id !== snapshot.catalog_id ||
        deployed.environment !== snapshot.environment ||
        deployed.event_id !== snapshot.event_id
      )
        throw new Error("PUBLIC_CATALOG_MISMATCH");
      await client.access({
        host: target.host,
        port: target.port,
        user: process.env[target.user_env],
        password: process.env[target.password_env],
        secure:
          target.protocol === "ftps-implicit"
            ? "implicit"
            : target.protocol === "ftps",
        secureOptions: { rejectUnauthorized: true },
      });
      await client.cd(target.directory); // Do not create unknown host directories.
      await client.uploadFrom(
        Readable.from([JSON.stringify(snapshot)]),
        temporary,
      );
      uploaded = true;
      if (!isCurrent()) return false;
      // If overwrite/rename is unsupported, fail. Never delete the live file first.
      await client.rename(temporary, "congestion.json");
      uploaded = false;
      onTransferred({
        saved_version: snapshot.saved_version,
        generated_at: snapshot.generated_at,
        completed_at: new Date().toISOString(),
      });
      const response = await fetcher(
        `${target.site_url}/live/congestion.json?v=${encodeURIComponent(snapshot.saved_version)}&t=${Date.now()}`,
        { cache: "no-store", redirect: "error", signal: abort.signal },
      );
      if (
        !response.ok ||
        !/application\/json/i.test(response.headers.get("content-type") || "")
      )
        throw new Error("PUBLIC_READBACK_FAILED");
      const actual = await response.json();
      if (JSON.stringify(actual) !== JSON.stringify(snapshot))
        throw new Error("PUBLIC_READBACK_MISMATCH");
      return true;
    } finally {
      if (uploaded && !client.closed)
        await client.remove(temporary).catch(() => {});
      clearTimeout(deadline);
      client.close();
    }
  };
}

export class Publisher {
  constructor(
    store,
    transport,
    { clock = Date.now, retryBaseMs = 2000, heartbeatMs = 15000 } = {},
  ) {
    this.store = store;
    this.transport = transport;
    this.clock = clock;
    this.retryBaseMs = retryBaseMs;
    this.heartbeatMs = heartbeatMs;
    this.timer = null;
    this.running = null;
    this.stopped = false;
    this.failures = 0;
    this.lastSuccess = null;
    this.lastTransfer = null;
    this.lastError = null;
  }
  status() {
    const version = this.store.read().saved_version;
    return {
      state: this.lastError
        ? "error"
        : this.lastSuccess?.saved_version === version
          ? "published"
          : "pending",
      last_transfer: this.lastTransfer,
      last_success: this.lastSuccess,
      last_error: this.lastError,
    };
  }
  request() {
    if (!this.stopped && !this.running && !this.timer) this.schedule(0);
  }
  schedule(delay) {
    clearTimeout(this.timer);
    if (!this.stopped) this.timer = setTimeout(() => this.tick(), delay);
  }
  tick() {
    if (this.stopped || this.running) return this.running;
    clearTimeout(this.timer);
    this.timer = null;
    this.running = this.publish().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  async publish() {
    const snapshot = makeSnapshot(
      this.store.read(),
      this.store.catalog,
      this.clock(),
    );
    const started = this.clock();
    let delay = this.heartbeatMs;
    try {
      const committed = await this.transport(
        snapshot,
        () =>
          !this.stopped &&
          this.store.read().session_id === (snapshot.session?.id ?? null) &&
          (acceptance(this.store.read(), this.store.catalog, this.clock()) ===
            "open") ===
            (snapshot.session?.accepting ?? false),
        (transfer) => {
          this.lastTransfer = transfer;
        },
      );
      if (committed) {
        this.lastSuccess = {
          saved_version: snapshot.saved_version,
          generated_at: snapshot.generated_at,
          verified_at: new Date(this.clock()).toISOString(),
        };
        this.lastError = null;
      }
      this.failures = 0;
      delay = Math.max(0, this.heartbeatMs - (this.clock() - started));
    } catch {
      // Do not put raw FTP responses (which may contain credentials/paths) in API or logs.
      this.lastError = {
        at: new Date(this.clock()).toISOString(),
        message:
          "公開反映を確認できません。PCに保存済みの最新状態を再試行します。",
      };
      this.failures++;
      delay = Math.min(
        60000,
        this.retryBaseMs * 2 ** Math.min(this.failures - 1, 6),
      );
    } finally {
      this.schedule(delay);
    }
  }
  async close() {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.running;
  }
}
