# Voyage デザインと当日情報

対象はトップ、`/groups/` 以下、`/kyousan/onegai/`。それ以外のページは既存レイアウトのままです。公開先・GitHub Actions・依存バージョンは変更していません。

## デザイン素材

`public/images/voyage/` の船・ワードマーク・波・背景は、提供された「2026年度筑駒文化祭PC版HPのai.ai」のPDF互換部分から抽出しています。船とワードマークはSVG、波と背景は表示用WebPです。元のAIはリポジトリに含めていません。配置と書体はPC参考デザインからスマホへ展開しています。

共通部品は `src/components/voyage/`、色・余白・レスポンシブ表示は `src/styles/voyage.css`。既存の班紹介本文・写真と協賛企業のデータ・順序・リンクを保っています。

## メニュー

- `/groups/shokuhin/menu/`、`/groups/kissa/menu/`
- 確定した内容を `src/data/visitor.ts` の `foodMenu` / `cafeMenu` に登録します。空配列は準備中と表示します。
- 必須: `id`（ページ内で一意なID）、`name`、`category`、`priceLabel`（税込/チケット等も含めて正確に）、`availability`。
- `availability` は `planned` / `available` / `sold-out` / `paused`。
- 任意: `description`、`image`（公開画像パス）、`allergens`（確認済みの情報だけ）。
- 混雑表示は未確定のため無効です。更新元の運用が決まったら `showMenuCongestion` の該当班を `true` にします。

## 混雑情報

- `/groups/ennichi/congestion/`。初期値はすべて未配信です。実際の待ち時間を捏造しません。
- 表示単位は現在の紹介にある4部門です。個別アトラクにする場合は `ennichiAreas` と更新データのIDを揃えて変更してください。
- ブラウザは同一オリジンの `/data/festival-status.json` を約1分ごとと手動操作で取得します。非表示中は定期取得を止め、復帰時に取得します。
- 初期ファイルは `public/data/festival-status.json`。公開する情報だけを格納します。
- 形式は `{ "version": 1, "venues": { "ID": { "status": "busy", "updatedAt": "ISO8601タイムゾーン付き日時", "waitMinutes": 10 } } }`。
- `status`: `unknown`（未配信）、`open`（空いている）、`busy`（やや混雑）、`crowded`（混雑）、`paused`（受付停止）、`closed`（終了）。
- 配信状態には正しい `updatedAt` が必要です。15分以上経過した情報は情報未更新、取得失敗や不正データは確認不可とし、古い待ち時間は消します。日時は日本時間表示です。
- `waitMinutes` は任意の0〜600の整数。受付停止・終了時には表示しません。
- 現段階では管理画面・外部APIはありません。静的JSONを更新する場合は再デプロイが必要です。本番運用前に担当者・更新元・更新間隔・公開方法を決め、このパスへ情報を供給してください。既存FTPS運用を使うかAPI化するかは未決定です。

## 確認

Node 24.x、`npm ci`、`npm run check`、`npm run build`。混雑状態の境界条件は `node --experimental-strip-types --test tests/congestion.test.ts`。

`master` / `dev` へのpushはそれぞれ本番 / テスト環境への自動公開につながります。作業ブランチからの取り込みは共同編集者と確認してください。

## 2026-10-14 の検証

- Node 24.19.0。`npm run check`: エラー・警告なし。`npm run build`: 成功。
- `tests/congestion.test.ts`: 5件成功（古い情報、0分、受付停止/終了、不正データ、未配信）。
- PC幅1440px・スマホ幅390pxでトップ、班紹介、メニュー、混雑度、協賛ページを実画面確認。メニュー開閉、Escape、混雑の手動更新、戻る操作後のカウントダウン再開を確認。
- 既存の班紹介の全paragraphsと画像参照、協賛データ・順序・本文・リンクを元のコミットと比較して保持を確認。
- 全対象ページの内部リンク先とH1の一意性を確認。
- 依存lockfile・公開workflowは変更なし。ニュース等の対象外ページは既存の表示を維持。
