# Milliclock

https://milliclock.com （リポジトリ名と Worker 名は jst-clock のまま）

撮影した映像の時刻ずれを測るための、ミリ秒まで表示する日本標準時の時計。カメラで画面ごと撮影して、映像のタイムコードや別の時計と比べる用途を想定している。

複数の時刻源（自前の Cloudflare Worker、Akamai、NICT、timeapi.io、time.now）に問い合わせ、各時刻源について「正しい時刻が必ず入る区間」を往復時間から求め、区間の重なりが最大になる範囲（Marzullo法）の中央を表示する。重ならない時刻源は除外する。画面下のグラフで、その区間と合議の範囲、推定値の推移を見られる。

```sh
pnpm install
pnpm dev          # 開発サーバー（ローカルでは /api/time がこのマシンの時計を返すので「除外」になるのが正常）
pnpm typecheck
pnpm test:e2e     # ビルド → プレビュー → E2E。結果は artifacts/e2e-report.md とスクショ、時刻コードは artifacts/timecode/（ffmpeg が必要）
BASE_URL=https://… pnpm test:e2e   # デプロイ済みのURLに対して実行
OFFLINE=1 pnpm test:e2e            # 実ネットワーク試験を飛ばす
GPU=1 pnpm test:e2e                # macOS の実GPU（Metal）で描かせ、背景の流体を動かしたまま全試験を走らせる。背景の録画とスクショは artifacts/bg/
pnpm assets       # OG画像とファビコンのPNGを scripts/og.html・public/favicon.svg から作り直す（生成物はコミットする）
pnpm run deploy   # cf deploy（手動）。その後 BASE_URL を付けて E2E を流し、本番の自前Workerを確かめる
```

## 使い方

- 右上でタイムゾーン（任意の IANA 名）と言語を切り替えられる。歯車の設定でアニメーション・機械可読タイムコード・グラフと表・表示遅れの追加補正を変えられ、「初期状態に戻す」で言語・タイムゾーンも含めて端末の既定に戻る
- 言語ごとのURLは `/{言語タグ}/`（例 `/ja/` `/en/` `/pt-BR/` `/zh-TW/`）。`/` は英語（x-default）で、言語を選んだことがなくブラウザが別の対応言語を希望していれば、その言語のURLへ移る
- `?min` 時計だけを表示する（その表示の間だけ。保存しない）
- `?lag=ms` 表示遅れを手動で足す（描画1フレーム分は自動で補正済み。保存しない）
- `?tz=Area/City` タイムゾーンを指定する（保存しない。存在しない名前なら端末のタイムゾーン）
- `?code=1` / `?code=0` 映像から機械で読める時刻帯（毎フレーム）と、補正の状態を載せたQR（2Hz）を数字の下に出す・出さない（保存しない。保存するなら設定の「機械可読タイムコード」）。設計は [docs/timecode.md](docs/timecode.md)
- `?bg=off` 背景（インクの流体）を出さない。`?bg=force` GPUが無くソフトウェア描画になる端末でも流体を動かす（どちらも保存しない。動きを止めるだけなら設定の「アニメーション」）

## 撮影した映像から時刻を読む

ffmpeg が必要（`FFMPEG` / `FFPROBE` で場所を指定できる）。

```sh
node tools/decode-timecode.ts movie.mp4 --out movie.csv          # 映像（1フレーム1行）
node tools/decode-timecode.ts a.png b.png                         # 画像（それぞれ独立に読む）
node tools/decode-timecode.ts movie.mp4 --corners 100,200,900,200,900,350,100,350   # 白枠の四隅を手で与える（左上・右上・右下・左下。表示用の回転を適用した、再生ソフトで見たままの向きの画素座標）
node tools/decode-timecode.ts movie.mp4 --around 2026-10-13T00:00:00Z               # QRが読めないときの時刻の基準
```

CSV の列は `frame, pts, status, n, n_hi, frac, n_t, t_ms, t_iso, t28, t_est_ms, synced, verified, slewing, qr`。確定した時刻は `status` が `ok`（1枚だけ写っている）か `mixed`（2枚が混ざり、多く写った方）の行の `t_ms`（表示値、Unix ms）で、その値を描いたフレームの番号が `n_t`。`blend` は2枚の混ざりで番号 `n`〜`n_hi` と後の値の割合 `frac` だけ、`multi` は3枚以上の混ざりで何も返さない。`t_est_ms` は条件を満たすときだけの補間値で、確定値ではない。`qr` はその時点で最新のQRの中身。

## 検索と共有

- 各言語のページは Worker が JS なしで読める HTML を返す: タイトル・説明・canonical・hreflang（`/` が英語と x-default、`/en/` は `/` を正規とする）・OGP・Twitter カード・JSON-LD（WebSite / WebApplication / FAQPage）・時計の下の解説とFAQ
- `/robots.txt` `/sitemap.xml` `/site.webmanifest` も Worker が返す。`/api/time` は `X-Robots-Tag: noindex`
- 正規のオリジンは `cloudflare.config.ts` の `SITE_ORIGIN`。独自ドメインを付けたらそこに設定する（空ならリクエストのオリジン）
- OG画像は言語共通の1枚（`public/og/card-<内容ハッシュ>.png`、1年キャッシュ）。タイトルと説明はカードの文字として各言語で出るので、画像には言語に依らない数字と製品名だけを置く

## ファイル

- [docs/failure-modes.md](docs/failure-modes.md) 時刻がずれる・壊れる原因と、その対策・確認方法の一覧
- `src/index.ts` `/api/time` を返し、`/` と `/{lang}/` の HTML を翻訳して返す Worker
- `src/shared/` 製品名・対応言語・翻訳文（Worker とページで共有）。`src/shared/seo/` は検索結果と解説の文言（Worker だけが使う）
- `scripts/assets.ts` OG画像・ファビコンの生成
- `src/client/settings.ts` 設定の保存と購読（`settings.get/set/subscribe/reset`）
- `src/client/zone.ts` タイムゾーンの時刻計算
- `src/client/sources.ts` 時刻源の定義
- `src/client/clock.ts` 区間の収集と合議
- `src/client/viz.ts` 同期の様子のグラフ
- `src/client/timecode.ts` `src/client/timecode-format.ts` 機械で読める時刻帯とQR
- `tools/decode-timecode.ts` 映像・画像から時刻帯を読むデコーダ
- `e2e/` E2E。実ネットワーク試験は NTP（UDP）で別に測った時刻と突き合わせる
