# Twitch Livefield / Heatmap 仕様確定 v2.0 Tile 版

## 1. この機能の役割

Heatmap は、**今この瞬間の Twitch ライブ空間の勢力図**を見る機能とする。

この画面で分かることは、v2 でも以下の3点に固定する。

* **Who is big now**
  = 現在視聴者数が大きい配信
* **Who feels active now**
  = 短時間の活動信号が相対的に強い配信
* **Who is rising now**
  = 直近数分で視聴者数が伸びている配信

Heatmap は比較表ではない。
**ライブ空間の瞬間的な熱分布を、直感で掴む画面**とする。
サイト全体の役割分担上、Heatmap は **Now** を担い、Day Flow の「Today」、Battle Lines の「Compare」を食ってはならない。

v1 では bubble field を採用していたが、v2 では **tile / treemap 型の面積占有レイアウト**を正式採用する。
ただし役割自体は変えない。
Heatmap は引き続き、**「いま大きい」「いま伸びている」「いまざわついている」** を一目で読む画面である。

---

## 2. 1タイルの定義

Heatmap 上の1つのタイルは、**その時点で配信中の1ライブセッション**を表す。

配信者単位ではなく、**現在 live の1配信枠**として扱う。

ルールは以下で固定する。

* 同じ配信者が今 live 中なら 1タイル
* 配信終了したらタイルは消滅
* 次回 live 開始時は新しいセッションとして再登場
* 同一セッション重複は許可しない
* 非ライブ枠は表示しない

この定義は元仕様の「現在配信中の1ライブ枠」をそのまま引き継ぐ。

---

## 3. 取得・更新周期

v2 でも **1分ごと更新** で固定する。

### 3.1 収集周期

* サーバー側収集: 1分ごと
* フロント表示更新: 新しい snapshot 到着ごと
* Auto refresh: デフォルト ON
* Manual refresh: あり

### 3.2 理由

* Heatmap は「今感」が重要
* 5分更新では変化が鈍すぎる
* 30秒更新は無料運営前提では過剰
* 1分が「鮮度」と「運営コスト」のバランス点である

この方針は v1 と共通仕様をそのまま維持する。

---

## 4. 表示対象

Heatmap に出す対象は、**その時点で live 中の上位セッション**とする。

### 4.1 初期表示

* デフォルト: **Top 50**
* 切替:

  * Top 20
  * Top 50
  * Top 100

### 4.2 上位判定基準

表示対象へ入るかどうかは、まず **current viewers 順** で決める。

### 4.3 除外条件

* 非ライブ
* 明らかに欠損したレコード
* 重複セッション
* payload 検証に失敗したレコード

Heatmap の件数上限は共通仕様に従う。
デスクトップ最大 Top 100、モバイル最大 Top 50 とする。

---

## 5. Heatmap の見た目ルール

Heatmap の中心は **tile / treemap レイアウト** に固定する。
1タイルの見た目は以下で決める。

### 5.1 タイルの面積

**面積 = 現在視聴者数**

ただし線形ではなく、極端な巨大化を抑える補正を使ってよい。
目的は以下である。

* 大手だけが画面を食いすぎない
* 中規模が比較可能である
* 小規模も完全には消えない

実装では treemap の weight として viewers を使い、必要なら平方根や対数圧縮を挟んでよい。

### 5.2 タイルの基本色

**基本色 = momentum の方向** とする。

* 上昇: 緑系
* 下降: 赤系
* 横ばい: 青灰系

これは bubble 版の「1系統の濃淡」から変更する。
v2 tile 版では、**今伸びているか / 落ちているか / ほぼ横ばいか** を一目で読めることを優先する。

### 5.3 色の強さ

**色の強さ = momentum の強さ** とする。

同じ緑でも、

* 微増: 深い緑または弱い緑
* 急上昇: 明るく強い緑

とし、赤も同様に下降強度で差を付ける。

横ばいは青灰で固定し、緑赤より主張を弱くする。
これにより、

* viewers は面積で読む
* momentum は色で読む

という役割分担を明確にする。

### 5.4 タイルの枠・アクセント

**枠線・上辺アクセント・コーナー装飾** は補助信号用に使う。

優先順位は以下で固定する。

1. 面積 = viewers
2. 色 = momentum
3. 枠 / バッジ / 微発光 = activity

activity まで主色で競わせてはならない。

---

## 6. Activity signal の定義

TwitCasting 版では「コメント速度」を使っていたが、Twitch-only MVP では **sampled short-lived chat session による activity signal** を採用する。

### 6.1 基本方針

Heatmap で扱う activity は、**短時間での活発さを表す補助指標** とする。
ただし v2 でも、**views でも momentum でもない第3の補助信号**として使うにとどめる。

### 6.2 v2 の設計原則

* activity は **必須の主軸ではない**
* viewers と momentum が Heatmap の主役
* activity は取得できる範囲で補助的に使う
* 取得不能なら隠さず縮退表示する
* sampled であることを隠さない

### 6.3 v2 の activity_raw

v2 では、短時間の Twitch chat sampling に基づく以下を使う。

* `commentCount`
* `deltaComments`
* `commentsPerMin`
* それを viewers 規模で補正した `agitationRaw`
* UI 用に段階化した `agitationLevel`

### 6.4 activity availability

activity はノードごとに availability を持つ。

* `activityAvailable = true`
  * この window で sampled 観測があり、activity を算出できた
* `activityAvailable = false`
  * sampled 観測が足りない、またはこの window で該当 channel を観測できなかった

補助フラグとして以下を持ってよい。

* `activitySampled`
* `activityUnavailableReason`

### 6.5 原則

* **0 activity** と **unavailable** を混同してはならない
* sampled で観測したが 0 だった場合と、そもそも観測できなかった場合は分ける
* UI 上は基本的に **Activity** と表示する

---

## 7. Activity level の段階表示

タイルの「ざわつき」は **6段階表示** に固定する。

* Lv0: still
* Lv1: faint
* Lv2: low
* Lv3: clear
* Lv4: strong
* Lv5: intense

### 7.1 段階化ルール

固定閾値でも相対分布でもよいが、v2 では **sampled chat が sparse でも Lv0 ばかりにならない** ことを優先する。

採用条件は以下。

* sampled activity が入った配信では、0 以外が意味ある形で出る
* 小規模が activity だけで主役化しすぎない
* viewers 主役を壊さない
* 一部の急騰だけで全体が飽和しない

### 7.2 目的

これにより、

* 昼夜差に耐える
* 大型イベント日にも耐える
* sparse sampled chat でも Heatmap 上で activity の差が見える

### 7.3 補足

段階の切り方自体は v2 仮採用とする。
raw を残し、観測後に再調整可能とする。
この「6段階」という骨格は v1 を維持する。

---

## 8. レイアウト配置

配置は bubble のような自由移動ではなく、**安定した面積占有レイアウト**にする。

### 8.1 配置原則

* viewers 上位ほど大きな面積を占める
* 毎更新で全体の読み順が大崩れしない
* 同一セッションは可能な限り近い場所に残る
* 更新のたびに全面シャッフルしない

### 8.2 v2 配置方式

v2 は **tile / treemap** を正式採用する。
複雑な物理シミュレーションは不要とする。

### 8.3 新規登場

新規タイルは

* フェードイン
* 軽い拡大補間
* 位置確定

の順で入る。

### 8.4 終了タイル

終了タイルは即消しせず、

* 透明度低下
* 少し縮小
* フェードアウト

の順で消す。

---

## 9. アニメーション規則

Heatmap は動きが重要だが、うるさくしない。

### 9.1 許可する動き

* activity level に応じた微パルス
* activity level に応じた微発光
* 高 activity 時だけの弱い振動
* 更新時の位置補間
* hover / tap 時の軽い拡大

### 9.2 禁止する動き

* 常時激しい点滅
* 常時激しい振動
* 毎回の全面再レイアウト
* 粒子の大量散布
* 背景の常時流体演出
* ノード数増加時に破綻するアニメーション乱発

### 9.3 Toggle

ユーザーは以下を切り替え可能とする。

* Animation On
* Animation Off
* Low Load Mode

### 9.4 Off 時

* パルス停止
* 発光弱化
* 位置補間だけ残す

### 9.5 原則

* activityAvailable = true のときだけ activity アニメを許可する
* unavailable タイルは原則静止
* sampled but unavailable は 0 activity のように動かしてはならない

---

## 10. 画面UI構成

Heatmap ページの構成は以下で固定する。

### 10.1 上部

* Page title
* Short description
* Last updated
* Coverage
* Status

### 10.2 Controls

* Top 20 / 50 / 100
* Activity window 1m / 3m / 5m
* Animation On/Off
* Auto refresh On/Off
* Refresh

### 10.3 Main

* Heatmap tile field

### 10.4 Secondary

* Legend
* Summary metrics
* Detail panel

### 10.5 補足

比較用の bubble / tile 並列表示は v2 本番では採用しない。
本番 Heatmap は tile 単独表示とする。
比較用 UI は lab / hidden route に退避してよい。

---

## 11. Detail panel

タイル選択時に以下を表示する。

### 11.1 必須

* streamer name
* current title
* current viewers
* momentum
* current rank by viewers
* stream link

### 11.2 activity 利用可能時のみ

* activity score
* activity level
* current rank by activity
* sampled state

### 11.3 表示原則

* unavailable な値を実測値のように見せない
* 取れない項目は `Not available in current source` や `Not sampled in this window` などで明示
* Panel は PC では右サイド、モバイルでは bottom sheet

### 11.4 配信リンク

配信への遷移導線は必須とする。

* detail panel に `Open stream` ボタンを置く
* 明示的に Twitch へ飛べること

---

## 12. Summary metrics

Heatmap 上部または直下には、**4つだけ**出す。

### 12.1 必須

* Active streams
* Total viewers observed
* Strongest momentum stream

### 12.2 4つ目

activity signal が有効なとき:

* Highest activity stream

activity signal が unavailable のとき:

* Largest live stream

### 12.3 原則

ここでは数字を詰め込みすぎない。
一目で「今の field の雰囲気」が分かればよい。

---

## 13. ラベル表示

全タイルに常時フルラベルは出さない。

### 13.1 常時表示

* Top 10: name + viewers
* 11〜20位: name only
* それ以下: hidden または省略表示

### 13.2 hover / tap 時

* full info
* selected tile emphasis
* other tiles dim

### 13.3 理由

Heatmap は密度が高いので、常時全文字表示は禁止する。
この方針は v1 を維持する。

---

## 14. モバイル挙動

モバイルでは見せ方を簡略化する。

### 14.1 残すもの

* Top 20 / 50
* Activity window 1m / 3m
* Refresh
* Animation On/Off
* タイルタップ詳細

### 14.2 削るもの

* Top 100
* 細かいラベル密度設定
* 長い説明文
* 比較用 UI

### 14.3 詳細表示

詳細は **bottom sheet** で出す。

### 14.4 追加原則

* hover 前提 UI 禁止
* タップだけで主操作が完了すること
* 低負荷モードへの切替を許容する
* タイル本体タップは選択、リンクアイコンは外部遷移と役割を分ける

---

## 15. データ保存

後で式調整・再計算できるよう、raw は保存する。
ただし無料運営前提のため、保存は **minute snapshot 主体** に寄せる。

### 15.1 最低保存項目

* timestamp
* stream_id
* streamer_id
* streamer_name
* title
* current viewers
* started_at
* language
* category or game label if available
* momentum_raw
* activity_raw if available
* activity_level if available
* activity availability state
* source_status
* coverage_note

### 15.2 保存方針

* **D1**: 履歴保存の本体
* **KV**: 必須ではない。使う場合も最新軽量 payload のみ
* 1セッション1行の過剰分解より、minute snapshot 単位保存を優先してよい

### 15.3 原則

* 後で係数調整できる raw は残す
* 無料枠を壊す保存設計は禁止
* 取得不能な値は null を許可する
* 見栄えのための捏造補完は禁止

---

## 16. 状態設計

Heatmap は以下の状態を持つ。

### 16.1 loading

* skeleton 表示
* `Loading live field...`

### 16.2 live

* 通常表示
* last updated が現在に近い

### 16.3 stale

* 最終更新が遅延
* 黄色 note
* 最後の正常状態を維持

### 16.4 partial

* 一部対象欠損
* activity signal unavailable
* coverage 制限
* sampled coverage 不足
* 集計途中

のいずれかがある

### 16.5 empty

* 条件に一致する live stream なし
* reset / widen controls を促す

### 16.6 error

* 赤 note
* retry 導線
* demo 切替可能

### 16.7 demo

* デモデータで仮表示
* 本番と明確に区別

共通仕様にある loading / live / stale / partial / empty / error / demo を Heatmap にも完全適用する。

---

## 17. Heatmap がやらないこと

v2 の Heatmap では以下をやらない。

* クロスプラットフォーム比較
* game / category 別クラスタを主役にすること
* ログイン保存
* follow ベース優先表示
* 配信者プロフィール分析
* コメント本文解析
* VOD / Clip 深部連携
* Battle Lines 的な精密時系列比較
* Day Flow 的な1日俯瞰
* bubble / tile 比較 UI の本番常設

Heatmap はあくまで **瞬間観測** に限定する。
この「瞬間観測に限定する」という制約は v1 を維持する。

---

## 18. v2 完成条件

Heatmap の完成条件はこれで固定する。

### 18.1 必須

* 現在 live 中の Top N を表示できる
* viewers に応じてタイル面積が変わる
* momentum が色で見える
* activity signal が使える時は level 反映される
* activity signal が使えない時は partial / unavailable が分かる
* sampled / unavailable / zero を区別できる
* 1分更新が滑らかに反映される
* タイル選択で詳細が見られる
* 各配信へ飛べる明示リンクがある
* stale / partial / empty / error / demo が分かる
* モバイルで最低限の操作ができる
* Top 100 でも崩れず、低負荷モードで生き残れる

### 18.2 不可

* 更新のたびに配置が崩れる
* 小規模配信が activity だけで主役化しすぎる
* viewers 主役が失われる
* activity unavailable を隠して通常値のように見せる
* sampled zero と unavailable を同一視する
* モバイルで操作不能
* 何を見ているか説明なしで分からない
* 背景タブ放置で描画が暴走する

---

## 19. UI 文言の基準

Heatmap 画面で使う v2 英語文言は以下の思想で固定する。

* 難しい専門語を増やさない
* `Now` が伝わる短文にする
* official を装わない
* activity が unavailable の時は隠さず言う
* sampled であることを必要な範囲で明示する

例:

* `Live heat field of Twitch streams right now`
* `Updated every minute`
* `Activity uses sampled short-lived chat windows`
* `Showing top live streams by viewers`
* `Not sampled in this window`

文言の最終 wording 自体は copy pack で別定義してよいが、方向性はこの仕様に従う。

---

## 20. この機能の一言定義

**Heatmap is the “Now” view of Twitch Livefield: a live tile field that shows which streams are biggest, rising, and actively reacting right now.**
