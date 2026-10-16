export interface Game {
  id: string;
  name: string;
  description: string;
  play_minutes_min: number;
  play_minutes_max: number;
  location: string;
  image?: string;
  category?: string;
}

// 正式なゲーム名・プレイ時間の提供待ち。確認できたものだけ登録する。
// 見た目と操作を確認する例示データは congestion-demo.mjs に分離する。
export const games: Game[] = [];
