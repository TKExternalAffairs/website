import Parser from "rss-parser";

export interface NoteFeedEntry {
  title: string;
  url: string;
  publishedAt: string;
  excerpt: string;
}

export interface NoteFeedSnapshot {
  status: "ok" | "empty" | "error";
  fetchedAt: string;
  entries: NoteFeedEntry[];
}

const snapshots = new Map<string, Promise<NoteFeedSnapshot>>();
const parser = new Parser();
const maxFeedBytes = 1_000_000;

function noteUrl(value: unknown, path: RegExp): URL | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      url.hostname === "note.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      path.test(url.pathname)
    ) {
      url.search = "";
      url.hash = "";
      return url;
    }
  } catch {
    // Invalid external links are omitted from the snapshot.
  }
}

function plainText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

function publishedDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

async function fetchSnapshot(rssUrl: string): Promise<NoteFeedSnapshot> {
  const fetchedAt = new Date().toISOString();
  const fallback: NoteFeedSnapshot = {
    status: "error",
    fetchedAt,
    entries: [],
  };
  const feedUrl = noteUrl(rssUrl, /^\/[\w-]+\/rss\/?$/u);
  if (!feedUrl) return fallback;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(feedUrl, {
      signal: controller.signal,
      redirect: "error",
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!response.ok || !response.body) return fallback;
    const contentLength = Number(response.headers.get("content-length"));
    if (contentLength > maxFeedBytes) {
      await response.body.cancel();
      return fallback;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let xml = "";
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > maxFeedBytes) {
          await reader.cancel();
          return fallback;
        }
        xml += decoder.decode(chunk.value, { stream: true });
      }
      xml += decoder.decode();
    } finally {
      reader.releaseLock();
    }

    if (!xml.trim()) return { status: "empty", fetchedAt, entries: [] };
    const feed = await parser.parseString(xml);
    if (!Array.isArray(feed.items)) return fallback;
    if (!feed.items.length) return { status: "empty", fetchedAt, entries: [] };

    const seen = new Set<string>();
    const entries: NoteFeedEntry[] = [];
    for (const item of feed.items) {
      const url = noteUrl(item.link, /^\/[\w-]+\/n\/n[a-zA-Z0-9]+\/?$/u)?.href;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      // rss-parser strips HTML and decodes entities in contentSnippet.
      // All returned fields are rendered as text by the Astro component.
      const excerpt = Array.from(plainText(item.contentSnippet));
      entries.push({
        title: plainText(item.title) || "noteの記事",
        url,
        publishedAt: publishedDate(item.isoDate) || publishedDate(item.pubDate),
        excerpt:
          excerpt.length > 160
            ? `${excerpt.slice(0, 160).join("")}…`
            : excerpt.join(""),
      });
    }
    entries.sort(
      (a, b) =>
        (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0),
    );
    return entries.length
      ? { status: "ok", fetchedAt, entries: entries.slice(0, 3) }
      : fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

/** Build-time only: cache concurrent requests and keep network failures local. */
export function loadNoteFeed(rssUrl: string): Promise<NoteFeedSnapshot> {
  let snapshot = snapshots.get(rssUrl);
  if (!snapshot) {
    snapshot = fetchSnapshot(rssUrl);
    snapshots.set(rssUrl, snapshot);
  }
  return snapshot;
}
