export type SocialPlatform =
  "x" | "instagram" | "youtube" | "mastodon" | "note";

export interface SocialLink {
  platform: SocialPlatform;
  label: string;
  href: string;
  detail?: string;
}

export const groupSocialLinks = {
  ennichi: [
    {
      platform: "x",
      label: "X",
      href: "https://x.com/tk75_ennichi",
      detail: "@tk75_ennichi",
    },
    {
      platform: "instagram",
      label: "Instagram",
      href: "https://www.instagram.com/tk75_ennichi_2026/",
      detail: "@tk75_ennichi_2026",
    },
    {
      platform: "youtube",
      label: "YouTube",
      href: "https://www.youtube.com/channel/UCEuQsDY21smr6u5tAE5Lsug",
      detail: "筑駒縁日班2026『縁日四重奏』",
    },
  ],
  stage: [
    {
      platform: "x",
      label: "X",
      href: "https://x.com/tk75_stage",
      detail: "@tk75_stage",
    },
    {
      platform: "instagram",
      label: "Instagram",
      href: "https://www.instagram.com/tk_stage_2026/",
      detail: "@tk_stage_2026",
    },
  ],
  kissa: [
    {
      platform: "instagram",
      label: "Instagram",
      href: "https://www.instagram.com/75kissa/",
      detail: "@75kissa",
    },
  ],
  konto: [
    {
      platform: "instagram",
      label: "Instagram",
      href: "https://www.instagram.com/75.tk_legendaryparadise/",
      detail: "@75.tk_legendaryparadise",
    },
  ],
  taiwa: [
    {
      platform: "x",
      label: "X",
      href: "https://x.com/taiwahan",
      detail: "@taiwahan",
    },
    {
      platform: "instagram",
      label: "Instagram",
      href: "https://www.instagram.com/tktaiwa.75/",
      detail: "@tktaiwa.75",
    },
    {
      platform: "youtube",
      label: "YouTube",
      href: "https://www.youtube.com/@taiwahan",
      detail: "対話班",
    },
  ],
  omiyage: [
    {
      platform: "mastodon",
      label: "Mastodon",
      href: "https://mstdn.jp/@tk75_omiyage",
      detail: "@tk75_omiyage@mstdn.jp",
    },
    {
      platform: "instagram",
      label: "Instagram",
      href: "https://www.instagram.com/75th.gift/",
      detail: "@75th.gift",
    },
  ],
  shogai: [
    {
      platform: "instagram",
      label: "Instagram",
      href: "https://www.instagram.com/tsukukoma_shogai/",
      detail: "@tsukukoma_shogai",
    },
    {
      platform: "youtube",
      label: "YouTube",
      href: "https://www.youtube.com/channel/UC4Tm6He-Lk8FyhYTsrH0-CQ",
      detail: "筑駒高三特別班Ch.",
    },
    {
      platform: "x",
      label: "X",
      href: "https://x.com/tk2026_koho",
      detail: "@tk2026_koho",
    },
    {
      platform: "note",
      label: "note",
      href: "https://note.com/tk2026_koho",
      detail: "筑駒文化祭 高三特別班 2026",
    },
  ],
} satisfies Record<string, SocialLink[]>;

export const ennichiVideoLinks: SocialLink[] = [
  {
    platform: "youtube",
    label: "班長紹介",
    href: "https://www.youtube.com/watch?v=Sw9Nepq1AQU",
    detail: "YouTube",
  },
  {
    platform: "youtube",
    label: "ヤグラ部門長紹介",
    href: "https://www.youtube.com/watch?v=gDC8AkZ7JxM",
    detail: "YouTube",
  },
];

export const stageProjectLinks: SocialLink[] = [
  {
    platform: "x",
    label: "X",
    href: "https://x.com/mr_tk2026",
    detail: "@mr_tk2026",
  },
  {
    platform: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/mr_tsukukoma_2026/",
    detail: "@mr_tsukukoma_2026",
  },
];

export const stageTimetableLinks: SocialLink[] = [
  {
    platform: "x",
    label: "ステージのタイムテーブル",
    href: "https://x.com/tk75_stage/status/2108512173916070356",
    detail: "Xの投稿",
  },
];

export const taiwaVideoLinks: SocialLink[] = [
  {
    platform: "youtube",
    label: "対話録 #1「古いものはなぜ『よい』か」",
    href: "https://www.youtube.com/watch?v=Hi_2jyAIDNs",
    detail: "YouTube",
  },
];

export const festivalSocialLinks: SocialLink[] = [
  {
    platform: "x",
    label: "X",
    href: "https://x.com/tsukukomafes",
    detail: "@tsukukomafes",
  },
  {
    platform: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/tsukukomafes/",
    detail: "@tsukukomafes",
  },
  {
    platform: "youtube",
    label: "YouTube",
    href: "https://www.youtube.com/channel/UCF7fIp2wc8M79eM2jd-9loQ",
    detail: "筑駒文化祭公式チャンネル",
  },
];
