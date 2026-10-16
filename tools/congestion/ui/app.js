const labels = { low: "すいている", normal: "ふつう", high: "こんでいる" };
const el = (id) => document.getElementById(id);
const choices = [...document.querySelectorAll(".choices button")];
const selector = el("game");
const queryGame = new URLSearchParams(location.search).get("game");
let state = null;
let selected = queryGame || "";
let saving = false;
let reading = false;
let populated = false;
let lastSavedVersion = null;
let uncertain = false;
let connected = false;
let generation = 0;
let sessionDeadline = 0;
const formatTime = (value) =>
  new Date(value).toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
function render() {
  const game = state?.catalog.find((item) => item.id === selected);
  const current = game && state.games[game.id];
  const canAccept =
    state?.acceptance === "open" && Date.now() < sessionDeadline;
  el("connection").textContent = connected
    ? "PCに接続済み"
    : "PCとの通信を確認";
  el("connection").classList.toggle("offline", !connected);
  el("location").textContent = game?.location || "対象のゲームを選んでください";
  el("current-level").textContent = current?.level
    ? labels[current.level]
    : "未確認";
  el("current-level").dataset.level = current?.level || "unknown";
  el("observed").textContent = current?.observed_at
    ? `${formatTime(current.observed_at)} 現地確認${connected ? "" : " · PCとの通信を確認してください"}`
    : "現地確認の情報をお待ちください";
  el("acceptance").textContent = !connected
    ? "PCに接続できません。会場Wi-FiとPCの起動を確認してください。"
    : canAccept
      ? "受付中 · いまの列を確認してタップ"
      : state?.acceptance === "paused"
        ? "受付停止中です。運営者に確認してください。"
        : "現在は受付時間外です。";
  for (const button of choices) {
    button.disabled = saving || !connected || !game || !canAccept;
    button.setAttribute(
      "aria-pressed",
      String(current?.level === button.dataset.level),
    );
    button.querySelector(".check").textContent =
      current?.level === button.dataset.level ? "✓" : "";
  }
  selector.disabled = saving || !populated;
  const publication = state?.publication;
  el("publication").classList.toggle(
    "error",
    !connected || publication?.state === "error",
  );
  if (!connected)
    el("publication").textContent = "公開反映の状態を確認できません";
  else if (publication?.state === "error")
    el("publication").textContent = "公開反映を確認できません · PCで再試行中";
  else if (
    publication?.last_success &&
    BigInt(publication.last_success.saved_version) >=
      BigInt(lastSavedVersion || state.saved_version)
  )
    el("publication").textContent =
      `${state.demo ? "デモページ" : "公開サイト"}で反映を確認 · ${formatTime(publication.last_success.verified_at)}`;
  else el("publication").textContent = "反映待ち · PCには保存されています";
}
async function readStatus() {
  if (reading || saving) return;
  reading = true;
  const requestGeneration = generation;
  try {
    const response = await fetch("/api/status", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("status");
    const next = await response.json();
    if (requestGeneration !== generation) return;
    state = next;
    connected = true;
    const session = state.sessions.find((item) => item.id === state.session_id);
    // Use PC time to measure remaining session duration; the phone clock may differ.
    sessionDeadline = session
      ? Date.now() + Date.parse(session.ends_at) - Date.parse(state.server_time)
      : 0;
    el("demo").hidden = !state.demo;
    if (!populated) {
      selector.replaceChildren(new Option("ゲームを選択してください", ""));
      for (const game of state.catalog)
        selector.add(new Option(game.name, game.id));
      if (selected && !state.catalog.some((game) => game.id === selected)) {
        selected = "";
        el("save-result").textContent =
          "QRのゲームIDが見つかりません。対象を選んでください。";
      }
      selector.value = selected;
      populated = true;
    }
    if (uncertain)
      el("save-result").textContent =
        "結果を確認できません。現在値を読み直しました。列を確認して必要なら選び直してください。";
  } catch {
    if (requestGeneration === generation) connected = false;
  } finally {
    reading = false;
    render();
  }
}
selector.addEventListener("change", () => {
  selected = selector.value;
  lastSavedVersion = null;
  uncertain = false;
  const url = new URL(location.href);
  if (selected) url.searchParams.set("game", selected);
  else url.searchParams.delete("game");
  history.replaceState(null, "", url);
  el("save-result").textContent = "選択すると保存します";
  el("save-result").classList.remove("error");
  render();
});
for (const button of choices)
  button.addEventListener("click", async () => {
    if (button.disabled || saving) return;
    saving = true;
    generation++;
    uncertain = false;
    el("save-result").textContent = "送信中…";
    el("save-result").classList.remove("error");
    render();
    try {
      const response = await fetch(
        `/api/games/${encodeURIComponent(selected)}/congestion`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: button.dataset.level }),
          signal: AbortSignal.timeout(7000),
        },
      );
      if (!response.ok) {
        if (response.status >= 500) throw new Error("uncertain");
        const result = await response.json();
        el("save-result").textContent =
          result.error || "保存できませんでした。状態を確認してください。";
        el("save-result").classList.add("error");
      } else {
        const result = await response.json();
        if (result.ok !== true || !result.saved_version || !result.observed_at)
          throw new Error("uncertain");
        lastSavedVersion = result.saved_version;
        el("save-result").textContent =
          `PCに保存しました · ${formatTime(result.observed_at)} · 版 ${result.saved_version}`;
      }
    } catch {
      uncertain = true;
      el("save-result").textContent =
        "結果を確認できません。PCの現在値を確認しています。";
      el("save-result").classList.add("error");
    } finally {
      saving = false;
      await readStatus();
      render();
    }
  });
el("reload").addEventListener("click", readStatus);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void readStatus();
});
window.addEventListener("online", readStatus);
window.addEventListener("offline", () => {
  connected = false;
  render();
});
setInterval(() => {
  if (!document.hidden) void readStatus();
}, 5000);
setInterval(() => {
  if (!document.hidden) render();
}, 1000);
void readStatus();
