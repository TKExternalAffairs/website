import process from "node:process";

export const SITE_ENVIRONMENTS = ["production", "development"] as const;

export type SiteEnvironment = (typeof SITE_ENVIRONMENTS)[number];

export const SITE_NAME = "高三特別班";

export const currentSiteEnvironment: SiteEnvironment =
  process.env.SITE_ENV === "development" ? "development" : "production";

export const SITE_URL =
  process.env.SITE_URL?.replace(/\/+$/, "") ??
  (currentSiteEnvironment === "development"
    ? "https://specialtest.bunkasai.info"
    : "https://tkspecial.bunkasai.info");

export const SITE_BASE = process.env.SITE_BASE ?? "/";

export const isDevelopmentSite = currentSiteEnvironment === "development";

export const isProductionSite = currentSiteEnvironment === "production";

export const siteIndexingEnabled =
  process.env.SITE_INDEXING === "false" ? false : isProductionSite;

export const isVisibleInCurrentSite = (
  publishTargets: readonly SiteEnvironment[],
) => publishTargets.includes(currentSiteEnvironment);

export const canonicalUrl = (pathname: string) =>
  new URL(pathname, SITE_URL).toString();
