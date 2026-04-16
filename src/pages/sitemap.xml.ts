import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

import {
  isProductionSite,
  isVisibleInCurrentSite,
  SITE_URL,
} from "../lib/site";

const STATIC_PATHS = [
  "/",
  "/before-donating/",
  "/news/",
  "/groups/",
  "/groups/ennichi/",
  "/groups/kissa/",
  "/groups/konto/",
  "/groups/omiyage/",
  "/groups/shogai/",
  "/groups/shokuhin/",
  "/groups/stage/",
  "/groups/taiwa/",
  "/kyousan/onegai/",
];

export const GET: APIRoute = async () => {
  if (!isProductionSite) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" />',
      {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
        },
      },
    );
  }

  const newsItems = (await getCollection("news")).filter((item) =>
    isVisibleInCurrentSite(item.data.publishTargets),
  );
  const urls = [
    ...STATIC_PATHS,
    ...newsItems.map((item) => `/news/${item.id}/`),
  ].map((pathname) => new URL(pathname, SITE_URL).toString());

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls
      .map((url) => `\n  <url><loc>${url}</loc></url>`)
      .join("")}\n</urlset>`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    },
  );
};
