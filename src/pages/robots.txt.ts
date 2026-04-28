import type { APIRoute } from "astro";

import { isProductionSite } from "../lib/site";

export const GET: APIRoute = ({site}) => {
  if (!isProductionSite) {
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return new Response(
    `\
    User-agent: *
    Allow: /
    
    Sitemap: ${new URL("sitemap-index.xml", site).href}
    `
  );
};
