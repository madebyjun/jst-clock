# jst-clock

撮影した映像の時刻ずれを測るための、ミリ秒まで表示する日本標準時の時計。カメラで画面ごと撮影して、映像のタイムコードや別の時計と比べる用途を想定している。

複数の時刻源（自前の Cloudflare Worker、Akamai、NICT、timeapi.io、time.now）に問い合わせ、各時刻源について「正しい時刻が必ず入る区間」を往復時間から求め、区間の重なりが最大になる範囲（Marzullo法）の中央を表示する。重ならない時刻源は除外する。画面下のグラフで、その区間と合議の範囲、推定値の推移を見られる。

```sh
pnpm install
pnpm dev          # 開発サーバー（ローカルでは /api/time がこのマシンの時計を返すので「除外」になるのが正常）
pnpm typecheck
pnpm test:e2e     # ビルド → プレビュー → E2E。結果は artifacts/e2e-report.md とスクショ
BASE_URL=https://… pnpm test:e2e   # デプロイ済みのURLに対して実行
OFFLINE=1 pnpm test:e2e            # 実ネットワーク試験を飛ばす
pnpm run deploy   # cf deploy（手動）。その後 BASE_URL を付けて E2E を流し、本番の自前Workerを確かめる
```

## 使い方

- `?min` 時計だけを表示する
- `?lag=ms` 表示遅れを手動で足す（描画1フレーム分は自動で補正済み）

## ファイル

- [docs/failure-modes.md](docs/failure-modes.md) 時刻がずれる・壊れる原因と、その対策・確認方法の一覧
- `src/index.ts` `/api/time` を返す Worker
- `src/client/sources.ts` 時刻源の定義
- `src/client/clock.ts` 区間の収集と合議
- `src/client/viz.ts` 同期の様子のグラフ
- `e2e/` E2E。実ネットワーク試験は NTP（UDP）で別に測った時刻と突き合わせる
