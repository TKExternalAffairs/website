# 班紹介ページ下部のSNS投稿表示

## 目的と範囲

7班紹介ページの最下部に、アカウント名・適切なアイコン・投稿内容・公式アカウントへのリンクを備えた詳細SNS欄を追加する。上部の`SocialLinks`、既存の紹介文・動画・タイムテーブルリンクを維持する。文化祭全体のフッターは現在のリンク表示を維持し、SNSのない食品班は対象外とする。

既存リンク追加はcommit `b02236d`。`docs/plans/social-links.md`はリンク表示までを対象とするため、投稿取得と埋め込みは本計画で扱う。

## 調査結果と構成の判断

- Astro 7の静的サイトをFTPS公開している。バックエンド・認証・APIキー・非公式プロキシは追加しない。
- `src/lib/socialLinks.ts`の班アカウント16件と`stageProjectLinks`のミスター筑駒2件、合計18アカウントを対象とする。既存`SocialIcon.astro`を再利用する。
- 親エージェントはInstagramの公式プロフィール埋め込みを実画面で確認済み（例: `https://www.instagram.com/75kissa/embed/`、直近の画像6件を表示）。公式プロフィールiframeを直接使う。SDK・profile oEmbed APIは利用しない。公式ソースに2025年の投稿も残っているため「2026年の最新投稿」と誤称しない。
- Xは`https://platform.twitter.com/widgets.js`による公式プロフィールタイムライン。公開プロフィールを使い、スクリプトは必要なページで一度だけ読み込む。
- YouTubeは3班のアップロード用プレイリストを公式iframeで表示する。親が公式playlistページの応答タイトルで確認したIDをリテラル設定し、実行時のUC→UU変換に依存しない。
- Mastodonは親がOrigin付きリクエストでCORS許可を実測済み。公開APIのaccount lookupから直近3件のstatusesをブラウザーで取得する。
- note RSSは親が3記事を確認済みだがCORS許可がないためビルド時に取得する。タイトル・日付・短い本文抜粋をHTMLへ保存し、取得日時を明記する。新しい記事の反映にはサイトの再ビルドが必要。

## 対象設定

| 班・ページ | 対象アカウント数 | サービス |
| --- | ---: | --- |
| `ennichi.astro` | 3 | X / Instagram / YouTube |
| `stage.astro` | 4 | 班X・Instagram / ミスター筑駒X・Instagram |
| `kissa.astro` | 1 | Instagram |
| `konto.astro` | 1 | Instagram |
| `taiwa.astro` | 3 | X / Instagram / YouTube |
| `omiyage.astro` | 2 | Mastodon / Instagram |
| `shogai.astro` | 4 | Instagram / YouTube / X / note |

全体でInstagram 8、X 5、YouTube 3、Mastodon 1、note 1。URLと表示名は既存リンク設定を再利用し、必要な埋め込み設定だけを追加する。

| YouTube | channel ID | 確認済みplaylist ID |
| --- | --- | --- |
| 縁日 | `UCEuQsDY21smr6u5tAE5Lsug` | `UUEuQsDY21smr6u5tAE5Lsug` |
| 対話 | `UCuQkWzsfSuXQSuWKzadX80w` | `UUuQkWzsfSuXQSuWKzadX80w` |
| 渉外 | `UC4Tm6He-Lk8FyhYTsrH0-CQ` | `UU4Tm6He-Lk8FyhYTsrH0-CQ` |

## 固定する型・API

`src/lib/socialFeeds.ts`:

```ts
type FeedBase = Pick<SocialLink, "label" | "href" | "detail"> & {
  context?: string; // 例: ミスター筑駒2026
};

export type SocialFeedAccount = FeedBase & (
  | { platform: "instagram"; embedUrl: string }
  | { platform: "x"; handle: string }
  | { platform: "youtube"; playlistId: string }
  | { platform: "mastodon"; server: string; username: string }
  | { platform: "note"; rssUrl: string }
);

// groupSocialLinksと同じ7キーを持つ。stageはMrの2件を含める。
export const groupSocialFeeds = { /* ... */ }
  satisfies Record<keyof typeof groupSocialLinks, SocialFeedAccount[]>;
```

`src/components/SocialFeedSection.astro`のpropsは`accounts: SocialFeedAccount[]`、`title?: string`、`description?: string`。既定見出しはユーザー要件に合わせて「SNSの最新投稿」とする。各ページ末尾で`<SocialFeedSection accounts={groupSocialFeeds.班キー} />`を1回描画する。

`src/lib/noteFeed.ts`は`loadNoteFeed(rssUrl: string): Promise<NoteFeedSnapshot>`をexportする。`NoteFeedSnapshot`は`{ status: "ok" | "empty" | "error"; fetchedAt: string; entries: NoteFeedEntry[] }`、`NoteFeedEntry`は`{ title: string; url: string; publishedAt: string; excerpt: string }`。`fetchedAt`と有効な`publishedAt`はISO日時、不明な公開日は空文字にする。成功時のみ取得日時を表示する。コンポーネントのfrontmatterからnoteに限って呼び出し、ブラウザーへRSS parserを送らない。

## 実装順と所有範囲

1. **設定・ページ担当worker**: `src/lib/socialFeeds.ts`と7班の`src/pages/groups/*.astro`のみを所有する。上記APIと確認済みIDで設定を作り、既存本文・関連リンクの後、閉じる`Layout`の直前にSNS欄を追加する。ミスター筑駒は`context`で班本体と区別する。
2. **note担当worker**: `src/lib/noteFeed.ts`、`package.json`、`package-lock.json`を所有する。ビルド専用の小さな依存`rss-parser`を追加し、公式READMEを根拠に`parseString`と`contentSnippet`を使う。RSS取得には約8秒のtimeoutを設け、HTTP失敗・不正データ・空配列でthrowを上位へ漏らさない。公開日順の直近3件を返し、抜粋を約160文字に短縮する。リンクは有効なHTTPSのnote記事URLに限定する。RSSの未信頼HTMLをそのまま挿入しない。
3. **親エージェント**: `src/components/SocialFeedSection.astro`と`src/scripts/socialFeeds.ts`を所有する。共通カード・各サービス表示・XとMastodonのクライアント処理を実装し、noteモジュールを統合する。設定・note担当とはAPI確定後に並行作業できる。
4. **親エージェント**: 下記の確認と必要な修正を行う。型/APIや取得方針に重大な変更が必要になった場合は、この計画を更新してから依存作業を進める。

### 各サービスと表示状態

- **共通**: 既存の黒地・白文字の意匠に合わせ、見出し・アイコン・アカウント名・外部リンクを全カードに置く。iframeやJSが動かなくても外部リンクを操作できる。新しいタブの説明、`rel="noopener noreferrer"`、明確なフォーカスを付ける。PCは必要に応じ2列、小画面は1列で横にはみ出さない。
- **Instagram**: 設定済み公式プロフィールiframe、`loading="lazy"`、一意の内容を説明する`title`、幅100%と十分なレスポンシブ高さを用いる。クロスオリジンiframeの`load`だけでは投稿の表示成功を判定できないため、常設の「Instagramで見る」を残す。
- **YouTube**: `https://www.youtube.com/embed/videoseries?list=確認済みID`を遅延読み込みし、16:9比率・説明用`title`・全画面表示対応を設定する。自動再生はしない。外部のチャンネルリンクを残す。
- **X**: 公式プロフィールのタイムライン要素を初期HTMLに出し、必要時に共有Promise等でwidgets.jsの重複読込を防ぐ。約12秒の上限と失敗案内を備え、スクリプト拒否・表示不能でも公式プロフィールへのリンクを残す。他サービスの表示を巻き込まない。
- **Mastodon**: `server/api/v1/accounts/lookup?acct=username`→`accounts/{id}/statuses?limit=3&exclude_replies=true&exclude_reblogs=true`。約8秒の取得上限、読み込み中・投稿なし・失敗・再試行を備える。HTML本文は`DOMParser`の`textContent`へ変換し、作成した要素へ`textContent`として設定する。投稿日時、添付画像のプレビューとalt、HTTPSの投稿リンクを表示する。`innerHTML`や未信頼HTMLの挿入を使わない。
- **note**: ビルド取得したタイトル・日付・本文抜粋をAstroの通常式でescape表示する。取得日時は日本時間で「○月○日時点」と示し、サイト更新時に反映する旨を簡潔に添える。空・失敗時もnote公式リンクを残す。外部取得失敗でサイト全体のビルドを失敗させない。

## 確認・受け入れ基準

- 差分と生成HTMLで7ページ・18アカウントを確認し、上部SNS・本文・関連コンテンツ・フッターが維持されている。
- `npm run check`と`npm run build`を実行する。テストの追加・実行はしない。取得を制限してもnoteのfallbackを含む静的HTMLを生成できる。
- 実ブラウザーのPC幅とモバイル幅で、Instagramの投稿画像、YouTube各playlist、Xタイムライン、Mastodon直近3件、noteの記事内容を確認する。再生・表示が外部側で制限されるサービスは、観測結果とfallbackの動作を区別して報告する。
- JSまたは外部通信をブロックした状態でリンクが残り、Mastodonの再試行・空/失敗案内が機能することを手動確認する。Xスクリプトが同一ページで複数読込されないこと、非対象ページでは読込されないことを確認する。
- 小画面の横スクロール、カード幅、長い名前、キーボードフォーカス、iframeの`title`、新規タブ説明を確認する。実施していない確認は未確認として報告する。

## リスク・残る制限と根拠

外部埋め込みはCookie・ログイン状態・追跡防止・サービス側変更で表示できない場合があるため、18アカウントすべての直接リンクを常時保持する。Instagram等の表示順は公式埋め込みに従い、更新時刻や表示件数をサイト側で保証しない。noteの更新頻度は再ビルドに依存する。実装を止める未決定の設計事項はない。

根拠: 親の公式埋め込み・HTTP/CORS実測結果、および[rss-parser公式README](https://github.com/rbren/rss-parser)（TypeScript、`parseString`、HTML除去済み`contentSnippet`）。既存コードの再確認は`SocialLinks.astro`、`socialLinks.ts`、`stage.astro`、`astro.config.mts`、`package.json`に限定し、完了済みの外部調査は繰り返していない。

自己確認: API・全18件・静的ホスティング・時点情報・失敗経路・安全な本文表示・作業所有範囲・受け入れ基準を確認済み。

## 実施結果（2026年10月16日）

実装完了。7班ページの末尾に18アカウントの詳細SNS欄を追加し、生成HTMLで既存の上部リンクの維持を確認した。noteの3記事は本文抜粋・公開日・取得日を表示し、更新はビルド時に反映する。

- Astro checkは49ファイル、エラー0・警告0。既存の`shokuhin.astro`の未使用importに関するhintが1件。buildは15ページ成功。テストの追加・実行はしていない。
- PC幅1280px・モバイル幅375pxで表示を確認。喫茶のInstagramは画像6件を読み込み、iframeを含め横にはみ出さず、投稿クリックで新しいタブへ移動できた。Instagramはステージ班本体を除く7アカウントで実表示を確認し、漫才・コントの動画タイル6件も表示された。
- YouTubeの3つのアップロードiframeで最新タイトルを確認（縁日「ネットミームクイズ後編」、対話「#5 生き急ぎ」、渉外「YouTubeはじめました」）。Mastodonは現在の公開投稿1件について、本文・日時を実行時に取得表示した。
- ステージページのXアカウント2件に対し、widgets.jsは1回だけ読み込まれた。本ブラウザーではXの表示が12秒でtimeoutとなり、再試行と公式リンクのfallbackを確認した。
- `tk_stage_2026/embed/`はInstagram側でリンクの問題・プロフィール削除の可能性を示す画面となった。プロフィール自体は先行調査で確認済みであり、削除とは断定できない。埋め込みへの制限や非対応の可能性が残るため、公式プロフィールへのリンクを併設している。

JSの完全無効化・強制的なネットワーク遮断・公開投稿ゼロを人工的に作る確認は未実施。空・エラー時のfallbackはコードで確認した。外部サービスの表示制限は上記の実測結果として残る。
