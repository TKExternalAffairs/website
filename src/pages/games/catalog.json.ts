import type { APIRoute } from "astro";
import { congestionCatalog } from "../../lib/congestion-catalog";
export const prerender = true;
export const GET: APIRoute = () =>
  new Response(JSON.stringify(congestionCatalog), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
