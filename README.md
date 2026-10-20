# Webサイト

## 制作資料

- [デザインガイド](DESIGN.md): Voyageの配色・書体・素材・レイアウト・共通部品と共同編集時の確認事項。
- [当日情報の運用資料](docs/voyage-redesign.md): メニュー登録、混雑情報の形式、配信前に決める事項。

## ディレクトリ構成

```text
/
├── public/
│   └── favicon.svg
├── src/
│   ├── assets/    : 各種画像ファイルを置く場所
│   ├── components/
│   │   ├── shared/: ボタン・カードなど再利用可能なコンポーネント
|   |   ├── layout/: Layout.astroでしか使わないコンポーネント
|   |   └── .../   : 各ページでしか使わないコンポーネント
│   ├── layouts    : 全ページに共通のもの(ヘッダーなど)
│   └── pages      : それぞれのページ
└── package.json
```

## npmスクリプト一覧

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 画像変換 bot

`src/assets/Images` 配下の画像を WebP に変換して、同じディレクトリ構成のまま `src/assets/Webp` 配下へ出力できます。

### ローカル実行

```bash
npm run convert:images
```

- 対応形式: `avif`, `bmp`, `gif`, `jpeg`, `jpg`, `png`, `tif`, `tiff`, `webp`
- 出力先: `src/assets/Webp`
- 品質設定: 環境変数 `WEBP_QUALITY` で変更可能です。未指定時は `80` を使用します。
- 同期動作: 元画像が削除された場合、対応する `src/assets/Webp` 側の古い `.webp` も自動削除します。

### GitHub Actions

`.github/workflows/webp-bot.yml` により、`src/assets/Images/**` への push 時、または手動実行時に自動変換を行います。

- 生成後、`src/assets/Webp` に差分があれば `github-actions[bot]` が同じブランチへコミットします。
- 生成コミットは `src/assets/Webp` しか変更しないため、このワークフローが無限ループすることはありません。

## デプロイ運用

- `master` は本番サイト `tkspecial.bunkasai.info`、`dev` はテストサイト `specialtest.bunkasai.info` に対応します。
- デプロイ workflow は `.github/workflows/deploy-ftps.yaml` です。
- push で自動デプロイし、各公開先へ `dist/` を同期します。workflow は「Deploy via FTPS」という名前ですが、`protocol` は未指定です。実際の接続方式・ホストの FTPS 対応は運営側で確認してください。
- GitHub Secrets に `FTPS_HOST_TKSPECIAL`、`FTPS_USER_TKSPECIAL`、`FTPS_PASS_TKSPECIAL`、`FTPS_PATH_TKSPECIAL`、`FTPS_HOST_SPECIALTEST`、`FTPS_USER_SPECIALTEST`、`FTPS_PASS_SPECIALTEST`、`FTPS_PATH_SPECIALTEST` を登録してください。

## 縁日ゲーム・混雑情報

Node 24 を使用します。Astroなどの依存関係は、取り込んだ最新の `master` の指定を維持しています。

```powershell
npm ci
npm run congestion:preview
```

公開画面のデモは <http://127.0.0.1:8787/games/>、スタッフ画面は <http://127.0.0.1:8787/staff/congestion/?game=rhythm> です。3択で保存し、15秒周期でデモの公開情報へ反映します。このプレビューはPC内限定で、外部ホストには転送しません。`quit` で終了します。

本番のゲームと日時は未登録です。例示データは通常の `npm run build` に入りません。正式情報を `src/data/games.ts` と `src/data/congestion-event.ts` に登録すると、`/games/` とPC用カタログが同じ情報から生成されます。

- [実装仕様](docs/congestion/architecture.md)
- [実装・検証記録](docs/congestion/implementation-plan.md)
- [PCの準備、当日の起動、停止、復旧、QR](tools/congestion/README.md)

`npm run check` / `npm run test:congestion` / `npm run build` で検証できます。`/live/` は通常デプロイから除外し、実行時JSONを `public/` や `dist/` に置くとカタログ出力でエラーになります。
