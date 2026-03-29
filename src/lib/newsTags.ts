export const NEWS_TAG_IDS = ["announcement", "kyosan", "stage", "ennichi", "kissa", "shokuhin", "conte", "engeki", "taiwa"] as const;

export type NewsTagId = (typeof NEWS_TAG_IDS)[number];

type NewsTagDefinition = {
  label: string;
  bgColor: string;
  textColor: string;
};

export const NEWS_TAGS: Record<NewsTagId, NewsTagDefinition> = {
  announcement: {
    label: "お知らせ",
    bgColor: "#1d4ed8",
    textColor: "#dbeafe",
  },
  kyosan: {
    label: "協賛関連",
    bgColor: "#0f766e",
    textColor: "#ccfbf1",
  },
  stage: {
    label: "ステージ班",
    bgColor: "#9a3412",
    textColor: "#ffedd5",
  },
  ennichi: {
    label: "縁日班",
    bgColor: "#4c1d95",
    textColor: "#ede9fe",
  },
    kissa: {
    label: "喫茶班",
    bgColor: "#7c2d12",
    textColor: "#fff7ed",
  }
    ,
    shokuhin: {
    label: "食品班",
    bgColor: "#166534",
    textColor: "#d1fae5",
  }
    ,
    conte: {
    label: "コント班",
    bgColor: "#831843",
    textColor: "#fce7f3",
  }
    ,
    engeki: {
    label: "演劇班",
    bgColor: "#9d174d",
    textColor: "#fce7f3",
  }
    ,
    taiwa: {
    label: "対話班",
    bgColor: "#4b5563",
    textColor: "#f3f4f6",
  }
};