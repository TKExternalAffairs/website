// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
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
