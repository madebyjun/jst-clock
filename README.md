# jst-clock

撮影した映像の時刻ずれを測るための、ミリ秒まで表示する日本標準時の時計。カメラで画面ごと撮影して、映像のタイムコードや別の時計と比べる用途を想定している。

複数の時刻源（自前の Cloudflare Worker、Akamai、NICT、timeapi.io、time.now）に問い合わせ、各時刻源について「正しい時刻が必ず入る区間」を往復時間から求め、区間の重なりが最大になる範囲（Marzullo法）の中央を表示する。重ならない時刻源は除外する。画面下のグラフで、その区間と合議の範囲、推定値の推移を見られる。

```sh
pnpm install
pnpm dev          # 開発サーバー（ローカルでは /api/time がこのマシンの時計を返すので「除外」になるのが正常）
pnpm typecheck
pnpm test:e2e     # ビルド → プレビュー → E2E。結果は artifacts/e2e-report.md とスクショ、時刻コードは artifacts/timecode/（ffmpeg が必要）
BASE_URL=https://… pnpm test:e2e   # デプロイ済みのURLに対して実行
OFFLINE=1 pnpm test:e2e            # 実ネットワーク試験を飛ばす
pnpm run deploy   # cf deploy（手動）。その後 BASE_URL を付けて E2E を流し、本番の自前Workerを確かめる
```

## 使い方

- `?min` 時計だけを表示する
- `?lag=ms` 表示遅れを手動で足す（描画1フレーム分は自動で補正済み）
- `?code=1` 映像から機械で読める時刻帯（毎フレーム）と、補正の状態を載せたQR（2Hz）を数字の下に出す。設計は [docs/timecode.md](docs/timecode.md)

## 撮影した映像から時刻を読む

ffmpeg が必要（`FFMPEG` / `FFPROBE` で場所を指定できる）。

```sh
node tools/decode-timecode.ts movie.mp4 --out movie.csv          # 映像（1フレーム1行）
node tools/decode-timecode.ts a.png b.png                         # 画像（それぞれ独立に読む）
node tools/decode-timecode.ts movie.mp4 --corners 100,200,900,200,900,350,100,350   # 白枠の四隅を手で与える（左上・右上・右下・左下）
node tools/decode-timecode.ts movie.mp4 --around 2026-10-13T00:00:00Z               # QRが読めないときの時刻の基準
```

CSV の列は `frame, pts, status, n, n_hi, frac, n_t, t_ms, t_iso, t28, t_est_ms, synced, verified, slewing, qr`。確定した時刻は `status` が `ok`（1枚だけ写っている）か `mixed`（2枚が混ざり、多く写った方）の行の `t_ms`（表示値、Unix ms）で、その値を描いたフレームの番号が `n_t`。`blend` は2枚の混ざりで番号 `n`〜`n_hi` と後の値の割合 `frac` だけ、`multi` は3枚以上の混ざりで何も返さない。`t_est_ms` は条件を満たすときだけの補間値で、確定値ではない。`qr` はその時点で最新のQRの中身。

## ファイル

- [docs/failure-modes.md](docs/failure-modes.md) 時刻がずれる・壊れる原因と、その対策・確認方法の一覧
- `src/index.ts` `/api/time` を返す Worker
- `src/client/sources.ts` 時刻源の定義
- `src/client/clock.ts` 区間の収集と合議
- `src/client/viz.ts` 同期の様子のグラフ
- `src/client/timecode.ts` `src/client/timecode-format.ts` 機械で読める時刻帯とQR
- `tools/decode-timecode.ts` 映像・画像から時刻帯を読むデコーダ
- `e2e/` E2E。実ネットワーク試験は NTP（UDP）で別に測った時刻と突き合わせる
