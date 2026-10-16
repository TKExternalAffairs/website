import {
  validateSnapshot,
  snapshotCondition,
  gameCondition,
  hostClock,
  LEVELS,
} from "../lib/congestion-contract.mjs";
import type { congestionCatalog } from "../lib/congestion-catalog";

const data = document.getElementById("congestion-catalog");
const summary = document.getElementById("congestion-summary");
const refresh = document.querySelector<HTMLButtonElement>(
  "#congestion-refresh",
);
if (data && summary && refresh) {
  const catalog: typeof congestionCatalog = JSON.parse(
    data.textContent || "{}",
  );
  const cards = [...document.querySelectorAll<HTMLElement>("[data-game-id]")];
  type Snapshot = {
    saved_version: string;
    generated_at: string;
    games: Array<{
      id: string;
      level: keyof typeof LEVELS | null;
      observed_at: string | null;
    }>;
  };
  let snapshot: Snapshot | null = null;
  let greatestVersion = -1n;
  let greatestPublication = 0;
  let busy = false;
  let hostNow: (() => number) | null = null;
  let requestGeneration = 0;
  let nextPoll: ReturnType<typeof setTimeout> | undefined;
  const time = (value: string) =>
    new Date(value).toLocaleTimeString("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
    });
  const globalLabels: Record<string, string> = {
    unavailable:
      "混雑情報は未配信、または取得できません · 現地でご確認ください",
    offline: "混雑情報の配信が止まっている可能性があります",
    closed: "現在は混雑情報の受付時間外です",
    paused: "混雑情報の受付を停止しています",
    open: "15〜18秒ごとに混雑情報を確認",
  };
  const cardLabels: Record<string, string> = {
    ...LEVELS,
    unknown: "未確認",
    stale: "情報が古くなっています",
    unavailable: "未配信・取得不可",
    offline: "更新が途切れています",
    closed: "受付時間外",
    paused: "受付停止中",
  };
  function render() {
    const now = hostNow?.() ?? NaN;
    const state = snapshotCondition(snapshot, catalog, now);
    summary!.textContent = globalLabels[state];
    for (const card of cards) {
      const entry = snapshot?.games.find(
        (game) => game.id === card.dataset.gameId,
      );
      const condition =
        state === "open"
          ? gameCondition(entry, catalog, now)
          : state === "offline" && !entry?.level
            ? "unknown"
            : state;
      const badge = card.querySelector<HTMLElement>("[data-congestion-level]")!;
      const observed = card.querySelector<HTMLElement>("[data-observed-time]")!;
      badge.dataset.congestionLevel = condition;
      badge.textContent = cardLabels[condition];
      observed.textContent =
        state === "open" && entry?.observed_at
          ? `${time(entry.observed_at)} 現地確認${condition === "stale" ? " · 再確認待ち" : ""}`
          : condition === "unknown"
            ? "現地確認の情報をお待ちください"
            : "現在の状況は現地でお尋ねください";
    }
  }
  async function poll() {
    if (busy || document.hidden || !cards.length) return;
    clearTimeout(nextPoll);
    busy = true;
    const generation = requestGeneration;
    refresh!.disabled = true;
    try {
      const url = new URL("/live/congestion.json", window.location.origin);
      url.searchParams.set("t", String(Date.now()));
      const response = await fetch(url, {
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      const clock = hostClock(
        response.headers.get("date"),
        performance.now(),
        () => performance.now(),
      );
      if (
        Number(response.headers.get("age") || 0) > 0 ||
        (hostNow && clock() + 1000 < hostNow())
      )
        throw new Error("cached or regressed host clock");
      if (
        !response.ok ||
        !/application\/json/i.test(response.headers.get("content-type") || "")
      )
        throw new Error("unavailable");
      const text = await response.text();
      if (text.length > 131072) throw new Error("oversized");
      const next: Snapshot = validateSnapshot(
        JSON.parse(text),
        catalog,
        clock(),
      );
      const version = BigInt(next.saved_version);
      const published = Date.parse(next.generated_at);
      if (version < greatestVersion || published < greatestPublication)
        throw new Error("older snapshot");
      if (generation !== requestGeneration || document.hidden) return;
      greatestVersion = version;
      greatestPublication = published;
      snapshot = next;
      hostNow = clock;
    } catch {
      snapshot = null;
    } finally {
      busy = false;
      refresh!.disabled = false;
      render();
      if (!document.hidden)
        nextPoll = setTimeout(
          poll,
          generation !== requestGeneration
            ? 0
            : catalog.poll_seconds * 1000 + Math.random() * 3000,
        );
    }
  }
  refresh.addEventListener("click", poll);
  document.addEventListener("visibilitychange", () => {
    clearTimeout(nextPoll);
    requestGeneration++;
    snapshot = null;
    if (!document.hidden) {
      render();
      void poll();
    }
  });
  window.addEventListener("offline", () => {
    snapshot = null;
    render();
  });
  window.addEventListener("online", () => void poll());
  // Expire already-rendered values even if a fetch stalls or the tab has been suspended.
  if (cards.length) {
    setInterval(() => {
      if (!document.hidden) render();
    }, 1000);
    void poll();
  }
}
