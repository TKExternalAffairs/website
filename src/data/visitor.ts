export interface MenuItem {
  id: string;
  name: string;
  category: string;
  description?: string;
  priceLabel: string;
  image?: string;
  allergens?: string;
  availability: "planned" | "available" | "sold-out" | "paused";
}
// 確定した商品・価格だけを登録する。空配列は「準備中」を表示。
export const foodMenu: MenuItem[] = [];
export const cafeMenu: MenuItem[] = [];
// 更新元・運用が決まった段階で有効にする。
export const showMenuCongestion = { shokuhin: false, kissa: false };
export const ennichiAreas = [
  { id: "ennichi-yagura", name: "ヤグラ部門", english: "YAGURA" },
  { id: "ennichi-attractions", name: "アトラク部門", english: "ATTRACTIONS" },
  { id: "ennichi-dagashi", name: "駄菓子部門", english: "DAGASHI" },
  { id: "ennichi-garafuru", name: "ガラ古部門", english: "GARAFURU" },
];
