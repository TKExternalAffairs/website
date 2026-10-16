# SNS・関連コンテンツリンクの掲載計画

## 目的と期待する動作

各班の紹介ページと共通フッターから、会話で整理した公式アカウント・紹介コンテンツへ移動できるようにする。各リンクにはサービスを識別できるSVGアイコンと日本語の表示名を付ける。新しいタブで開くことを利用者へ伝え、キーボードと小画面でも操作できるようにする。

## 調査結果と制約

- Astro 7、Tailwind CSS 4を使用。`Layout.astro`は全ページ共通の`Footer.astro`を描画する。
- 班紹介は`Title.astro`と`GroupDetailBox.astro`を利用している。本文の幅は通常80%、小画面90%。既存の黒地・白文字・細い罫線の意匠に合わせる。
- `omiyage.astro`と`shogai.astro`は本文が空。既存の`Title`とリンク欄を追加し、未提供の紹介文や画像は作らない。
- リンク追加用の既存コンポーネント、計画文書の既存ディレクトリはないため、この文書を`docs/plans`に保存する。
- 新規依存、外部アイコンCDN、iframeは不要。既存の紹介文・日程を変更しない。ミスター筑駒の開催時刻はSNS間に不一致があったため転記しない。
- 文化祭全体のYouTubeは先行調査で運用情報に揺れがあったが、今回の指示対象URLに含まれるため掲載する。アカウントへのリンクとして扱い、2026年の活動内容を断定する説明は追加しない。

## 対象とURL

| 対象ファイル | 基本リンク | 関連コンテンツ |
| --- | --- | --- |
| `src/pages/groups/ennichi.astro` | `https://x.com/tk75_ennichi` / `https://www.instagram.com/tk75_ennichi_2026/` / `https://www.youtube.com/channel/UCEuQsDY21smr6u5tAE5Lsug` | 班長紹介 `https://www.youtube.com/watch?v=Sw9Nepq1AQU` / ヤグラ部門長紹介 `https://www.youtube.com/watch?v=gDC8AkZ7JxM` |
| `src/pages/groups/stage.astro` | `https://x.com/tk75_stage` / `https://www.instagram.com/tk_stage_2026/` / ミスター筑駒 `https://x.com/mr_tk2026` / ミスター筑駒 `https://www.instagram.com/mr_tsukukoma_2026/` | タイムテーブル `https://x.com/tk75_stage/status/2108512173916070356` |
| `src/pages/groups/kissa.astro` | `https://www.instagram.com/75kissa/` | — |
| `src/pages/groups/konto.astro` | `https://www.instagram.com/75.tk_legendaryparadise/` | — |
| `src/pages/groups/taiwa.astro` | `https://x.com/taiwahan` / `https://www.instagram.com/tktaiwa.75/` / `https://www.youtube.com/@taiwahan` | 対話録 #1 `https://www.youtube.com/watch?v=Hi_2jyAIDNs` |
| `src/pages/groups/omiyage.astro` | `https://mstdn.jp/@tk75_omiyage` / `https://www.instagram.com/75th.gift/` | — |
| `src/pages/groups/shogai.astro` | `https://www.instagram.com/tsukukoma_shogai/` / `https://www.youtube.com/channel/UC4Tm6He-Lk8FyhYTsrH0-CQ` / `https://x.com/tk2026_koho` / `https://note.com/tk2026_koho` | — |
| `src/components/layout/Footer.astro` | `https://x.com/tsukukomafes` / `https://www.instagram.com/tsukukomafes/` / `https://www.youtube.com/channel/UCF7fIp2wc8M79eM2jd-9loQ` | — |

掲載先は計8箇所、基本リンク21件、関連コンテンツ4件。

## 構成と実装順序・担当

主担当とworkerの所有範囲を以下に固定する。合意した共通APIを使い、同一ファイルの並列編集を避ける。

1. **worker: 共通データ**
   - `src/lib/socialLinks.ts`に`SocialPlatform = 'x' | 'instagram' | 'youtube' | 'mastodon' | 'note'`、`SocialLink { platform; label; href; detail?: string }`をexportする。
   - `groupSocialLinks`、`ennichiVideoLinks`、`stageProjectLinks`（ミスター筑駒）、`stageTimetableLinks`、`taiwaVideoLinks`、`festivalSocialLinks`をexportする。
2. **主担当: 共通部品**
   - `src/components/SocialIcon.astro`にローカルSVGを用意する。装飾SVGは`aria-hidden`、`focusable="false"`とし、表示ラベルでサービスを識別できるようにする。
   - `src/components/SocialLinks.astro`のpropsは`title: string`、`description?: string`、`links: SocialLink[]`、`compact?: boolean`とする。44px程度以上の操作領域、折り返し、長い文字の折り返し、明確な`focus-visible`を備える。
   - 外部リンクに`target="_blank"`と`rel="noopener noreferrer"`を指定する。各リンクの読み上げ文字列に「新しいタブで開きます」を含め、欄にも新規タブで開く旨を簡潔に表示する。
3. **worker: 班ページへの配置**
   - 7ページで共通部品と対応データを読み込み、`Title`直後に公式SNS欄を置く。ステージ班の通常アカウントとミスター筑駒をラベルで区別する。
   - 縁日・ステージ・対話には関連コンテンツ欄も置き、個別の動画名・投稿名とサービスアイコンを表示する。埋め込みは行わない。
   - お土産部門・渉外事務局は自己終了している`Layout`を開閉要素へ変更し、`Title`と公式SNS欄を追加する。使われていない`GroupIntroBox`のimportを削除する。
4. **主担当: 共通フッター**
   - フッター内に「文化祭公式SNS」の見出しと3リンクを追加する。高三特別班のSNSと文化祭全体のSNSを名称で識別できるようにする。
5. **主担当: 確認・報告**
   - 以下の確認を行い、実施した確認内容と未確認項目を正確に報告する。

## 確認と受け入れ基準

- 差分を確認し、25件のURLと掲載先が上表に一致し、既存の本文・画像・サイト設定に無関係な変更がない。
- `npm run check`と`npm run build`でAstroの型・テンプレート・静的出力を確認する。テストの追加・実行は行わない。環境起因または既存の失敗があれば今回の変更との関係を示す。
- 生成HTMLまたはブラウザーで、7班ページのリンク、共通フッターの3リンク、SVGアイコン、`target`/`rel`、読み上げ文字列を確認する。
- ブラウザーで確認可能なら小画面幅と通常幅で折り返し・読みやすさ・Tab移動時のフォーカスを確認する。実施できない場合は未確認として報告する。
- URLは会話で提示されたものをそのまま使用する。今回の実装では全SNSへの再調査・ログイン・投稿は不要。

## リスク・未解決事項

- 外部SNSの閲覧制限やアカウント運用状態はサイト側で制御できない。前の調査を引き継いでリンクを追加する。
- 全体YouTubeの運用情報とミスター筑駒の開催時刻に前述の制約があるが、今回のリンク表示実装を止める未解決の設計判断はない。

計画の自己確認: 既存Layoutの経路、空ページの処理、全25URL、担当、表示・操作要件、確認方法を記載した。実装規模に対して共通部品2つとデータ1つの追加に留める。
