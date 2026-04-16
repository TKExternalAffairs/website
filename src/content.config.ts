import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { NEWS_TAG_IDS } from "./lib/newsTags";
import { SITE_ENVIRONMENTS } from "./lib/site";

const newsCollection = defineCollection({
  loader: glob({ base: "./src/content/news", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: image().optional(),
      tags: z.array(z.enum(NEWS_TAG_IDS)).default([]),
      publishTargets: z
        .array(z.enum(SITE_ENVIRONMENTS))
        .default(["production", "development"]),
    }),
});

export const collections = {
  news: newsCollection,
};
