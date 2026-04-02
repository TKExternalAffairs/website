// @ts-check
/// <reference types="node" />
import { defineConfig } from "astro/config";
import process from "node:process";

import react from "@astrojs/react";

import tailwindcss from "@tailwindcss/vite";

const siteEnvironment = process.env.SITE_ENV ?? "production";
const siteUrl =
  process.env.SITE_URL ??
  (siteEnvironment === "development"
    ? "https://specialtest.bunkasai.info"
    : "https://tkspecial.bunkasai.info");

const siteBase = process.env.SITE_BASE ?? "/";

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  base: siteBase,

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },
  redirects: {
    "/beforedonation": "/before-donating",
  },
  /*experimental: {
    fonts: [
      {
        provider: fontProviders.adobe({ id: "hxo7nit" }),
        name: "AH Hakushu Addressing Font",
        cssVariable: "--font-hakushu",
        weights: [600]
      }
    ]
  }*/
});
