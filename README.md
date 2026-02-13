# Webサイト

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
