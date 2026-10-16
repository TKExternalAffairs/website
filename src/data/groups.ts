import stage from "../assets/Webp/groups/stageImage.webp";
import ennichi from "../assets/Webp/groups/ennichi/ennichi_title.webp";
import kissa from "../assets/Webp/groups/kissa/kissa_Title.webp";
import konto from "../assets/Webp/groups/konto/konto_title.webp";
import shogai from "../assets/Webp/groups/特別班渉外事務局.webp";

export const groups = [
  { id: "stage", title: "ステージ班", english: "STAGE", image: stage.src },
  { id: "ennichi", title: "縁日班", english: "ENNICHI", image: ennichi.src },
  { id: "shokuhin", title: "食品班", english: "FOOD", image: "" },
  { id: "kissa", title: "喫茶班", english: "CAFÉ", image: kissa.src },
  { id: "konto", title: "コント班", english: "COMEDY", image: konto.src },
  { id: "taiwa", title: "対話班", english: "DIALOGUE", image: "" },
  {
    id: "shogai",
    title: "渉外事務局",
    english: "EXTERNAL AFFAIRS",
    image: shogai.src,
  },
  { id: "omiyage", title: "お土産部門", english: "SOUVENIRS", image: "" },
];
export const visitorLinks = [
  {
    href: "/groups/ennichi/congestion/",
    title: "縁日班混雑度",
    english: "ENNICHI",
    description: "企画を巡る前に、混雑状況をチェック。",
  },
  {
    href: "/groups/shokuhin/menu/",
    title: "食品班メニュー",
    english: "FOOD MENU",
    description: "文化祭のおいしいひとときを。",
  },
  {
    href: "/groups/kissa/menu/",
    title: "喫茶班メニュー",
    english: "CAFÉ MENU",
    description: "ひと息つきたいときに。",
  },
];
