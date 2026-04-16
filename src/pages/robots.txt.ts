import type { APIRoute } from "astro";

import { isProductionSite, SITE_URL } from "../lib/site";

export const GET: APIRoute = () => {
  if (!isProductionSite) {
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return new Response(
    `User-agent: *\nAllow: /\nSitemap: ${new URL("/sitemap.xml", SITE_URL).toString()}\n`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
};
