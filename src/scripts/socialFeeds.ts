export {};

interface TwitterWidgets {
  createTimeline(
    source: { sourceType: "profile"; screenName: string },
    target: HTMLElement,
    options: { height: number; theme: string; lang: string; dnt: boolean },
  ): Promise<HTMLElement | undefined>;
}

declare global {
  interface Window {
    twttr?: { widgets?: TwitterWidgets };
  }
}

let twitterScript: Promise<TwitterWidgets> | undefined;

function loadTwitter(): Promise<TwitterWidgets> {
  if (window.twttr?.widgets) return Promise.resolve(window.twttr.widgets);
  if (twitterScript) return twitterScript;

  twitterScript = new Promise<TwitterWidgets>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.dataset.socialTwitter = "true";
    const timer = window.setTimeout(() => fail(), 10_000);

    function fail() {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error("X widget unavailable"));
    }

    script.onerror = fail;
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.twttr?.widgets) resolve(window.twttr.widgets);
      else fail();
    };
    document.head.append(script);
  }).catch((error: unknown) => {
    twitterScript = undefined;
    throw error;
  });
  return twitterScript;
}

function whenVisible(element: HTMLElement, load: () => void) {
  if (!("IntersectionObserver" in window)) {
    load();
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        load();
      }
    },
    { rootMargin: "200px" },
  );
  observer.observe(element);
  return observer;
}

function setState(
  element: HTMLElement,
  state: "loading" | "ready" | "empty" | "error",
  message = "",
) {
  element.dataset.state = state;
  element.setAttribute("aria-busy", String(state === "loading"));
  const status = element.querySelector<HTMLElement>("[data-feed-status]");
  if (status) {
    status.textContent = message;
    status.hidden = state === "ready";
  }
  const retry = element.querySelector<HTMLButtonElement>("[data-feed-retry]");
  if (retry) retry.hidden = state !== "error";
}

class SocialXTimeline extends HTMLElement {
  private observer?: IntersectionObserver;
  private loading = false;

  connectedCallback() {
    if (this.dataset.initialized) return;
    this.dataset.initialized = "true";
    this.querySelector("[data-feed-retry]")?.addEventListener("click", () => {
      void this.load();
    });
    this.observer = whenVisible(this, () => void this.load());
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  private async load() {
    if (this.loading) return;
    const host = this.querySelector<HTMLElement>("[data-x-mount]");
    const handle = this.dataset.handle;
    if (!host || !handle) return;
    this.loading = true;
    setState(this, "loading", "公開投稿を読み込んでいます…");
    const mount = document.createElement("div");
    host.replaceChildren(mount);
    let timer: number | undefined;

    try {
      const rendered = await Promise.race([
        loadTwitter().then((widgets) => {
          if (!this.isConnected) return;
          return widgets.createTimeline(
            { sourceType: "profile", screenName: handle },
            mount,
            { height: 600, theme: "dark", lang: "ja", dnt: true },
          );
        }),
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(
            () => reject(new Error("X timeline timed out")),
            12_000,
          );
        }),
      ]);
      if (!rendered) throw new Error("X timeline unavailable");
      setState(this, "ready");
    } catch {
      host.replaceChildren();
      setState(
        this,
        "error",
        "投稿を表示できませんでした。最新の投稿は下のリンクからXでご覧ください。",
      );
    } finally {
      window.clearTimeout(timer);
      this.loading = false;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function httpsUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function externalLink(href: string, label: string) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  const notice = document.createElement("span");
  notice.className = "sr-only";
  notice.textContent = "（新しいタブで開きます）";
  link.append(notice);
  return link;
}

function plainText(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("script, style").forEach((node) => node.remove());
  parsed.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  parsed.querySelectorAll("p").forEach((node) => node.append("\n"));
  const text = parsed.body.textContent?.trim() ?? "";
  return text.length > 1_200 ? `${text.slice(0, 1_200)}…` : text;
}

function mastodonPost(status: Record<string, unknown>) {
  const url = httpsUrl(status.url);
  if (!url) return null;
  const article = document.createElement("article");
  article.className = "social-feed__post";
  if (typeof status.created_at === "string") {
    const date = new Date(status.created_at);
    if (Number.isFinite(date.getTime())) {
      const time = document.createElement("time");
      time.dateTime = date.toISOString();
      time.textContent = new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Tokyo",
      }).format(date);
      article.append(time);
    }
  }

  const body = document.createElement("div");
  const content = document.createElement("p");
  content.textContent =
    typeof status.content === "string" ? plainText(status.content) : "";
  if (content.textContent) body.append(content);

  if (Array.isArray(status.media_attachments)) {
    const media = document.createElement("div");
    media.className = "social-feed__media";
    status.media_attachments
      .filter(isRecord)
      .slice(0, 4)
      .forEach((attachment) => {
        const source = httpsUrl(attachment.url);
        if (!source) return;
        const preview =
          httpsUrl(attachment.preview_url) ??
          (attachment.type === "image" ? source : null);
        const link = externalLink(source, "添付ファイルを見る");
        if (preview) {
          const image = document.createElement("img");
          image.src = preview;
          image.alt =
            typeof attachment.description === "string" && attachment.description
              ? attachment.description
              : attachment.type === "image"
                ? "投稿の添付画像"
                : "投稿の添付動画のプレビュー";
          image.loading = "lazy";
          image.decoding = "async";
          image.referrerPolicy = "no-referrer";
          link.replaceChildren(image);
          link.setAttribute(
            "aria-label",
            `${image.alt}（新しいタブで開きます）`,
          );
        }
        media.append(link);
      });
    if (media.childElementCount) body.append(media);
  }

  if (status.sensitive || status.spoiler_text) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent =
      typeof status.spoiler_text === "string" && status.spoiler_text
        ? status.spoiler_text
        : "投稿内容を表示";
    details.append(summary, body);
    article.append(details);
  } else {
    article.append(body);
  }
  article.append(externalLink(url, "投稿をMastodonで見る"));
  return article;
}

class SocialMastodonFeed extends HTMLElement {
  private observer?: IntersectionObserver;
  private controller?: AbortController;
  private loading = false;

  connectedCallback() {
    if (this.dataset.initialized) return;
    this.dataset.initialized = "true";
    this.querySelector("[data-feed-retry]")?.addEventListener("click", () => {
      void this.load();
    });
    this.observer = whenVisible(this, () => void this.load());
  }

  disconnectedCallback() {
    this.observer?.disconnect();
    this.controller?.abort();
  }

  private async load() {
    if (this.loading) return;
    const server = httpsUrl(this.dataset.server);
    const username = this.dataset.username;
    const posts = this.querySelector<HTMLElement>("[data-mastodon-posts]");
    if (!server || !username || !posts) return;
    this.loading = true;
    this.controller = new AbortController();
    const timer = window.setTimeout(() => this.controller?.abort(), 8_000);
    setState(this, "loading", "公開投稿を読み込んでいます…");

    try {
      const lookupUrl = new URL("/api/v1/accounts/lookup", server);
      lookupUrl.searchParams.set("acct", username);
      const options = {
        signal: this.controller.signal,
        credentials: "omit" as const,
      };
      const lookup = await fetch(lookupUrl, options);
      if (!lookup.ok) throw new Error("Mastodon account unavailable");
      const account: unknown = await lookup.json();
      if (
        !isRecord(account) ||
        typeof account.id !== "string" ||
        !/^\d+$/.test(account.id)
      ) {
        throw new Error("Invalid Mastodon account");
      }
      const statusesUrl = new URL(
        `/api/v1/accounts/${account.id}/statuses`,
        server,
      );
      statusesUrl.search = "limit=3&exclude_replies=true&exclude_reblogs=true";
      const response = await fetch(statusesUrl, options);
      if (!response.ok) throw new Error("Mastodon posts unavailable");
      const statuses: unknown = await response.json();
      if (!Array.isArray(statuses)) throw new Error("Invalid Mastodon posts");
      const articles = statuses
        .filter(isRecord)
        .slice(0, 3)
        .map(mastodonPost)
        .filter((post): post is HTMLElement => post !== null);
      posts.replaceChildren(...articles);
      setState(
        this,
        articles.length ? "ready" : "empty",
        "公開投稿はまだありません。",
      );
    } catch {
      setState(
        this,
        "error",
        "投稿を取得できませんでした。最新の投稿は下のリンクからMastodonでご覧ください。",
      );
    } finally {
      window.clearTimeout(timer);
      this.loading = false;
    }
  }
}

if (!customElements.get("social-x-timeline")) {
  customElements.define("social-x-timeline", SocialXTimeline);
}
if (!customElements.get("social-mastodon-feed")) {
  customElements.define("social-mastodon-feed", SocialMastodonFeed);
}
