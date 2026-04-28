/**
 * `article` metaプロパティ
 *
 * @see https://ogp.me/#type_article
 */
export type ArticleProp =
  | { type: "published_time"; content: Date }
  | { type: "modified_time"; content: Date }
  | { type: "expiration_time"; content: Date }
  | { type: "author"; content: [string] }
  | { type: "section"; content: string }
  | { type: "tag"; content: [string] };

export type OgpType = "website" | "article";
