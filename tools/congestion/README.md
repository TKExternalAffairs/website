# 会場PC 混雑情報の運用

Node 24、会場PC1台を前提とする。設定・状態・認証情報を置く `.congestion/` と `.congestion-preview/` はGit除外。ポート開放や会場ネットワークの設定は自動では変更しない。

## まず画面を試す

```powershell
npm ci
npm run congestion:preview
```

- 公開画面: <http://127.0.0.1:8787/games/>
- スタッフ画面: <http://127.0.0.1:8787/staff/congestion/?game=rhythm>

このデモはPC内限定。例示のゲーム・時間・混雑を表示し、外部へのFTPは行わない。保存内容は `.congestion-preview/runtime/` に残る。同じ日の再起動で確認時刻を自動更新しないため、時間が経つと「情報が古くなっています」になる。スタッフ画面で再選択すると新しい現地確認になる。初回のみデモ値を投入する。`stop` / `resume` / `reset` / `status` も試せる。終了は同じ端末で `quit`。

## 会場へ持ち込む前

1. 実機iOS/AndroidとPCで、会場Wi-Fi内のHTTP通信、端末分離の有無、固定/予約LAN IPv4、会場で許可されたポートを確認する。
2. PCからDNS・HTTPS・予定ホストへのFTP/FTPS・パッシブ転送を確認する。HTTPが使えるだけでFTPが使えると判断しない。
3. テスト公開先で一時名転送→既存 `congestion.json` へのrename中も連続取得し、欠落や途中JSONがないことを確認する。先行削除は行わない。
4. 公開URLのDateヘッダーとPC時刻、キャッシュ回避、通常デプロイと同時に `/live/` が残ること、アクセス容量を確認する。閲覧数Nなら約N/15リクエスト毎秒が目安。
5. 正式ゲーム名・紹介・プレイ時間・場所・画像と、日別の日本時間の受付区間を確認する。電源・スリープ停止・時刻同期・PC担当者と復旧担当者を決める。

成立しない場合は基本案を本番稼働させず、[実装仕様](../../docs/congestion/architecture.md)を見直す。設定例の `verified:false` は確認記録を得た後にだけtrueへ変更する。今回の実装で実ホストの安全な置換や回線の成立は確認していない。

## 正式カタログと設定

`src/data/games.ts` に登録する例（値は説明用）:

```ts
{
  id: "sample-game", // 公開後に不用意に変更しない
  name: "確認済みのゲーム名",
  description: "確認済みの紹介文",
  play_minutes_min: 3,
  play_minutes_max: 5,
  location: "確認済みの場所",
  // image: "/images/game.webp", // public/ 内のサイト相対パス
}
```

`src/data/congestion-event.ts` のsessionsに日別の `id`、`label`、`starts_at`、`ends_at` を登録する。日時は `2026-11-01T09:00:00+09:00` のような日本時間。日程例は仮であり正式予定ではない。重複・不正順序・日跨ぎはビルドで拒否する。

テスト向けビルドの例:

```powershell
$env:SITE_ENV = 'development'
$env:SITE_URL = 'https://specialtest.bunkasai.info'
npm run check
npm run test:congestion
npm run build
```

`dist/games/catalog.json` と同じ内容が `.congestion/catalog.json` に出力される。サイトは既存workflowで対応する環境へ配信する。カタログの内容が変わったらPC側も同じビルドのJSONへ更新する。稼働中のカタログや状態ファイルを書き換えない。受付を止めて新しい作業領域で再起動する。

`config.example.json` を `.congestion/config.json` に、`.env.example` を `.congestion/.env` にコピーする。設定例のアドレス・ホスト・ID・日時・認証情報はすべてダミー。実際の環境・公開URL・イベント・sessionsは生成JSONから転記し、別の正本として編集しない。

| 項目                                   | 指定                                                            |
| -------------------------------------- | --------------------------------------------------------------- |
| environment/site_url/event_id/sessions | 生成カタログと一致する値                                        |
| catalog                                | config.jsonから見たカタログJSONの相対パス                       |
| local_origin                           | 固定/予約した `http://<LAN-IPv4>:8787`。末尾スラッシュなし      |
| listen_host                            | そのIPv4または0.0.0.0。PC管理ポートをインターネットに公開しない |
| state_directory                        | config.jsonからの相対パス。環境・イベントで別領域               |
| transfer                               | 確認したFTPホスト・ポート・protocol・ `/.../live/` と環境対応   |
| user_env/password_env                  | 認証情報が入ったローカル環境変数の名前                          |

`protocol` は `ftp` / `ftps`（explicit TLS）/ `ftps-implicit` を明示。FTPSの証明書検証は無効化しない。既存workflowはprotocol未指定で、名称だけを根拠にFTPSを選ばない。`transfer.verified` は実ホストの転送・置換・キャッシュ・配信共存を確認してからtrueへ。

本番とテストでは設定・状態領域・公開ディレクトリを分ける。秘密をソースや公開カタログへ入れない。認証ファイルはPCの運営者だけが読める権限で管理する。

## 当日の起動と操作

```powershell
node --env-file=.congestion/.env tools/congestion/cli.mjs .congestion/config.json
```

環境・イベント・日程・設定が一致しなければ起動を拒否する。公開カタログは各発行でHTTPS照合する。外向き通信が途切れてもローカルの保存は続けられ、転送は最新状態から再試行する。

サーバーを起動した**同じ端末**に入力する:

|コマンド|動作|
|`sessions`|登録済みの日程を表示|
|`select <id>`|日程を選んで受付停止。別日なら全件NULL|
|`start <id>`|その日の時間内に受付開始。別日なら全件NULL|
|`stop`|受付停止。確認時刻は維持|
|`resume`|選択済みの時間内に再開。確認時刻は維持|
|`reset`|受付停止し全ゲームをNULLへ初期化|
|`status`|全ゲーム、受付、保存版、最終転送と公開HTTPS確認、エラー|
|`publish`|最新状態の発行を手動で試行|
|`qr`|PC内で印刷用staff-qr.htmlを状態ディレクトリへ生成|
|`quit`|受付停止を保存して最終発行を試み、終了|

`qr` の出力HTMLをPCで開いて印刷する。生成はローカルで完結し、URLを外部QRサービスへ渡さない。正式LAN URLのQRだけを当日配布する。デモの127.0.0.1は他端末用ではない。QRにはゲームIDが入るが権限はない。スタッフ画面で他のゲームへも切替できる。

スタッフは会場Wi-FiでQRを読み、現地の列を見て3択を押す。同じ状況でも5分以内を目安に人が再確認する運用案。PC保存と公開反映は別々に表示される。応答が不明なら現在状態を読み直し、必要なときだけ現地を再確認して選び直す。

## 障害と復旧

- **PC保存成功・公開失敗:** PC内の状態は保存されている。外向き回線・FTP・公開カタログの一致・HTTPS読戻しを確認する。コンソールでは `last_transfer` と `last_success` を区別する。旧版のキャッシュが返れば反映済みにしない。
- **PCへ接続できない:** Wi-Fi、固定IP、PC起動、許可されたファイアウォール範囲を確認。公開ページは別経路なので、見られることがPCへの接続成功を意味しない。
- **プロセス異常終了:** 同じ設定・カタログ・状態領域で再起動する。ロックが残る場合は記録されたPIDとPCのプロセスを確認し、このサーバーが終了している場合だけ `server.lock` を削除する。複数PC・複数状態領域で同じ公開先を同時発行しない。
- **状態破損:** 必ずプロセスを停止。壊れた `state.json` を別名で保全し、`state.json.bak` の内容・環境・イベント・セッションを確認してから `state.json` へコピーし再起動する。稼働中に別CLIで状態を書き換えない。復旧で確認時刻を新しくしない。
- **バックアップによる版の巻き戻り:** 既存タブは古い版を拒否する。復旧担当者は公開中の版を確認し、停止した復旧状態のsaved_versionを公開版より大きい値に調整してから起動する。混雑値・observed_atは変更しない。これは停止中の明示復旧だけで行う。
- **日付変更:** 翌日の登録IDを `start <id>`。前日の状態は全件NULLとなる。時間外は自動で更新を拒否し、公開側もHTTP時刻で時間外表示にする。

ホストで原子的な置換が成立しないと分かった場合に、先行削除へ切り替えてはいけない。設計を改訂する。通常デプロイで `dangerous-clean-slate` を使わず、`/live/` の除外を維持する。

## 確認コマンド

```powershell
npm run check
npm run test:congestion
npm run build
```

自動テストはPC内の一時領域・ローカルHTTP・模擬FTPを使う。実ホストへ接続しない。会場スマホ、パッシブポート、実ホストの交換・キャッシュ・配信共存、45秒目標・ホスト容量は別途リハーサルで記録する。
