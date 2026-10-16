import {
  groupSocialLinks,
  stageMySweetLinks,
  stageProjectLinks,
  type SocialLink,
} from "./socialLinks";

type FeedBase = Pick<SocialLink, "label" | "href" | "detail"> & {
  context?: string;
};

export type SocialFeedAccount = FeedBase &
  (
    | { platform: "instagram"; embedUrl: string; isPrivate?: boolean }
    | { platform: "x"; handle: string }
    | { platform: "youtube"; playlistId: string }
    | { platform: "mastodon"; server: string; username: string }
    | { platform: "note"; rssUrl: string }
  );

export const groupSocialFeeds = {
  ennichi: [
    {
      ...groupSocialLinks.ennichi[0],
      platform: "x",
      handle: "tk75_ennichi",
    },
    {
      ...groupSocialLinks.ennichi[1],
      platform: "instagram",
      embedUrl: "https://www.instagram.com/tk75_ennichi_2026/embed/",
    },
    {
      ...groupSocialLinks.ennichi[2],
      platform: "youtube",
      playlistId: "UUEuQsDY21smr6u5tAE5Lsug",
    },
  ],
  stage: [
    {
      ...groupSocialLinks.stage[0],
      platform: "x",
      handle: "tk75_stage",
    },
    {
      ...groupSocialLinks.stage[1],
      platform: "instagram",
      embedUrl: "https://www.instagram.com/tk_stage_2026/embed/",
    },
    {
      ...stageProjectLinks[0],
      platform: "x",
      context: "ミスター筑駒2026",
      handle: "mr_tk2026",
    },
    {
      ...stageProjectLinks[1],
      platform: "instagram",
      context: "ミスター筑駒2026",
      embedUrl: "https://www.instagram.com/mr_tsukukoma_2026/embed/",
    },
    {
      ...stageMySweetLinks[0],
      platform: "instagram",
      context: "MySweet筑駒2026",
      embedUrl: "https://www.instagram.com/my_sweet_tk/embed/",
      isPrivate: true,
    },
  ],
  kissa: [
    {
      ...groupSocialLinks.kissa[0],
      platform: "instagram",
      embedUrl: "https://www.instagram.com/75kissa/embed/",
    },
  ],
  konto: [
    {
      ...groupSocialLinks.konto[0],
      platform: "instagram",
      embedUrl: "https://www.instagram.com/75.tk_legendaryparadise/embed/",
    },
  ],
  taiwa: [
    {
      ...groupSocialLinks.taiwa[0],
      platform: "x",
      handle: "taiwahan",
    },
    {
      ...groupSocialLinks.taiwa[1],
      platform: "instagram",
      embedUrl: "https://www.instagram.com/tktaiwa.75/embed/",
    },
    {
      ...groupSocialLinks.taiwa[2],
      platform: "youtube",
      playlistId: "UUuQkWzsfSuXQSuWKzadX80w",
    },
  ],
  omiyage: [
    {
      ...groupSocialLinks.omiyage[0],
      platform: "mastodon",
      server: "https://mstdn.jp",
      username: "tk75_omiyage",
    },
    {
      ...groupSocialLinks.omiyage[1],
      platform: "instagram",
      embedUrl: "https://www.instagram.com/75th.gift/embed/",
    },
  ],
  shogai: [
    {
      ...groupSocialLinks.shogai[0],
      platform: "instagram",
      embedUrl: "https://www.instagram.com/tsukukoma_shogai/embed/",
    },
    {
      ...groupSocialLinks.shogai[1],
      platform: "youtube",
      playlistId: "UU4Tm6He-Lk8FyhYTsrH0-CQ",
    },
    {
      ...groupSocialLinks.shogai[2],
      platform: "x",
      handle: "tk2026_koho",
    },
    {
      ...groupSocialLinks.shogai[3],
      platform: "note",
      rssUrl: "https://note.com/tk2026_koho/rss",
    },
  ],
} satisfies Record<keyof typeof groupSocialLinks, SocialFeedAccount[]>;
