// Shared, dependency-free validation used by the build, venue PC and browser.
export const LEVELS = Object.freeze({
  low: "すいている",
  normal: "ふつう",
  high: "こんでいる",
});
export const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export const isTime = (value) => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|\+09:00)$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value))
  )
    return false;
  return (
    new Date(Date.parse(value) + (value.endsWith("+09:00") ? 9 * 3600000 : 0))
      .toISOString()
      .slice(0, 19) === value.slice(0, 19)
  );
};
export function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
export function validateCatalog(catalog) {
  requireValue(
    isObject(catalog) && catalog.schema_version === 1,
    "カタログ形式が不正です",
  );
  requireValue(
    ["production", "development"].includes(catalog.environment),
    "環境が不正です",
  );
  requireValue(
    ID.test(catalog.event_id) && typeof catalog.event_id === "string",
    "イベントIDが不正です",
  );
  requireValue(
    typeof catalog.catalog_id === "string" &&
      /^[a-f0-9]{64}$/.test(catalog.catalog_id),
    "カタログIDが不正です",
  );
  const expected =
    catalog.environment === "production"
      ? "https://tkspecial.bunkasai.info"
      : "https://specialtest.bunkasai.info";
  requireValue(catalog.site_url === expected, "公開URLと環境が一致しません");
  requireValue(
    typeof catalog.demo === "boolean" &&
      !(catalog.demo && catalog.environment === "production"),
    "デモは本番で使用できません",
  );
  requireValue(
    Array.isArray(catalog.games) && Array.isArray(catalog.sessions),
    "ゲーム・セッション一覧が不正です",
  );
  const gameIds = new Set();
  for (const game of catalog.games) {
    requireValue(
      isObject(game) &&
        typeof game.id === "string" &&
        ID.test(game.id) &&
        !gameIds.has(game.id),
      "ゲームIDが不正または重複しています",
    );
    gameIds.add(game.id);
    for (const key of ["name", "description", "location"])
      requireValue(
        typeof game[key] === "string" && game[key].trim().length > 0,
        `${game.id}: ${key}が必要です`,
      );
    requireValue(
      Number.isInteger(game.play_minutes_min) &&
        game.play_minutes_min > 0 &&
        Number.isInteger(game.play_minutes_max) &&
        game.play_minutes_max >= game.play_minutes_min,
      `${game.id}: プレイ時間が不正です`,
    );
    requireValue(
      game.image === undefined ||
        (typeof game.image === "string" &&
          /^\/(?!\/)/.test(game.image) &&
          !game.image.includes("..")),
      `${game.id}: 画像はサイト内のパスを指定してください`,
    );
  }
  const sessionIds = new Set();
  let previousEnd = -Infinity;
  for (const session of catalog.sessions) {
    requireValue(
      isObject(session) &&
        typeof session.id === "string" &&
        ID.test(session.id) &&
        !sessionIds.has(session.id),
      "セッションIDが不正または重複しています",
    );
    sessionIds.add(session.id);
    requireValue(
      typeof session.label === "string" && session.label.trim(),
      "セッション名が必要です",
    );
    requireValue(
      isTime(session.starts_at) &&
        isTime(session.ends_at) &&
        session.starts_at.endsWith("+09:00") &&
        session.ends_at.endsWith("+09:00"),
      "開催時刻は日本時間（+09:00）で指定してください",
    );
    requireValue(
      session.starts_at.slice(0, 10) === session.ends_at.slice(0, 10) &&
        Date.parse(session.starts_at) < Date.parse(session.ends_at) &&
        Date.parse(session.starts_at) >= previousEnd,
      "日別セッションの時間・順序・重複を確認してください",
    );
    previousEnd = Date.parse(session.ends_at);
  }
  for (const key of [
    "poll_seconds",
    "publication_ttl_seconds",
    "observation_ttl_seconds",
    "clock_tolerance_seconds",
  ])
    requireValue(
      Number.isInteger(catalog[key]) && catalog[key] > 0,
      `設定 ${key} が不正です`,
    );
  requireValue(
    catalog.publication_ttl_seconds > catalog.poll_seconds,
    "公開有効期限は取得間隔より長くしてください",
  );
  return catalog;
}
export function sessionAt(catalog, id) {
  return catalog.sessions.find((session) => session.id === id);
}
export function acceptance(state, catalog, now = Date.now()) {
  const session = sessionAt(catalog, state.session_id);
  if (
    !session ||
    now < Date.parse(session.starts_at) ||
    now >= Date.parse(session.ends_at)
  )
    return "closed";
  return state.accepting ? "open" : "paused";
}
export function validateEntries(entries, catalog, sessionId) {
  requireValue(
    isObject(entries) && Object.keys(entries).length === catalog.games.length,
    "ゲーム状態の数が一致しません",
  );
  const session = sessionAt(catalog, sessionId);
  for (const game of catalog.games) {
    const entry = entries[game.id];
    requireValue(
      isObject(entry) &&
        (entry.level === null ||
          (typeof entry.level === "string" &&
            Object.hasOwn(LEVELS, entry.level))),
      "混雑値が不正です",
    );
    requireValue(
      entry.level === null
        ? entry.observed_at === null
        : isTime(entry.observed_at),
      "確認時刻が不正です",
    );
    if (entry.observed_at !== null)
      requireValue(
        session &&
          Date.parse(entry.observed_at) >= Date.parse(session.starts_at) &&
          Date.parse(entry.observed_at) < Date.parse(session.ends_at),
        "確認時刻がセッション外です",
      );
  }
}
export function validateSnapshot(snapshot, catalog, now = Date.now()) {
  requireValue(
    isObject(snapshot) &&
      snapshot.schema_version === 1 &&
      snapshot.event_id === catalog.event_id &&
      snapshot.environment === catalog.environment &&
      snapshot.catalog_id === catalog.catalog_id,
    "別イベント・環境・カタログの情報です",
  );
  requireValue(
    typeof snapshot.saved_version === "string" &&
      /^(0|[1-9]\d*)$/.test(snapshot.saved_version),
    "版番号が不正です",
  );
  requireValue(Number.isFinite(now), "公開ホストの時刻を確認できません");
  const session = snapshot.session;
  if (session !== null) {
    requireValue(isObject(session), "セッションが不正です");
    const expected = sessionAt(catalog, session.id);
    requireValue(
      expected &&
        isTime(session.starts_at) &&
        isTime(session.ends_at) &&
        Date.parse(expected.starts_at) === Date.parse(session.starts_at) &&
        Date.parse(expected.ends_at) === Date.parse(session.ends_at) &&
        typeof session.accepting === "boolean",
      "セッションID・区間・受付状態が一致しません",
    );
  }
  requireValue(isTime(snapshot.generated_at), "生成時刻が不正です");
  const published = Date.parse(snapshot.generated_at);
  requireValue(
    published <= now + catalog.clock_tolerance_seconds * 1000,
    "発行時刻が未来です",
  );
  requireValue(Array.isArray(snapshot.games), "ゲーム状態の形式が不正です");
  const known = new Set(catalog.games.map((game) => game.id));
  const entries = {};
  for (const entry of snapshot.games) {
    requireValue(
      isObject(entry) && typeof entry.id === "string",
      "ゲーム状態の形式が不正です",
    );
    if (!known.has(entry.id)) continue;
    requireValue(
      !Object.hasOwn(entries, entry.id),
      "ゲーム状態が重複しています",
    );
    Object.defineProperty(entries, entry.id, {
      value: { level: entry.level, observed_at: entry.observed_at },
      enumerable: true,
    });
  }
  for (const { id } of catalog.games)
    if (!Object.hasOwn(entries, id))
      Object.defineProperty(entries, id, {
        value: { level: null, observed_at: null },
        enumerable: true,
      });
  validateEntries(entries, catalog, session?.id ?? null);
  for (const entry of Object.values(entries))
    if (entry.observed_at !== null)
      requireValue(
        Date.parse(entry.observed_at) <= published,
        "確認時刻が生成時刻より後です",
      );
  return {
    ...snapshot,
    games: Object.entries(entries).map(([id, entry]) => ({ id, ...entry })),
  };
}
export function snapshotCondition(snapshot, catalog, now = Date.now()) {
  if (!snapshot) return "unavailable";
  const session = sessionAt(catalog, snapshot.session?.id);
  if (
    !session ||
    now < Date.parse(session.starts_at) ||
    now >= Date.parse(session.ends_at)
  )
    return "closed";
  if (!snapshot.session.accepting) return "paused";
  if (
    now - Date.parse(snapshot.generated_at) >=
    catalog.publication_ttl_seconds * 1000
  )
    return "offline";
  return "open";
}
export function gameCondition(entry, catalog, now = Date.now()) {
  if (!entry || entry.level === null) return "unknown";
  if (
    now - Date.parse(entry.observed_at) >=
      catalog.observation_ttl_seconds * 1000 ||
    Date.parse(entry.observed_at) > now + catalog.clock_tolerance_seconds * 1000
  )
    return "stale";
  return entry.level;
}

// HTTP Date + monotonic elapsed time: visitor device wall-clock changes are irrelevant.
export function hostClock(dateHeader, receivedAt, monotonicNow) {
  const hostTime =
    typeof dateHeader === "string" ? Date.parse(dateHeader) : NaN;
  requireValue(Number.isFinite(hostTime), "HTTP Dateがありません");
  return () => hostTime + Math.max(0, monotonicNow() - receivedAt);
}
