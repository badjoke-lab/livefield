# Twitch Livefield / Heatmap 仕様確定 v1.0 改訂版

## 1. この機能の役割

Heatmap は、**今この瞬間の Twitch ライブ空間の勢力図**を見る機能とする。

この画面で分かることは、v1 では以下の3点に固定する。

* **Who is big now**
  = 現在視聴者数が大きい配信
* **Who feels active now**
  = 短時間の活動信号が相対的に強い配信
* **Who is rising now**
  = 直近数分で視聴者数が伸びている配信

Heatmap は比較表ではない。
**ライブ空間の瞬間的な熱分布を、直感で掴む画面**とする。
サイト全体の役割分担上、Heatmap は **Now** を担い、Day Flow の「Today」、Battle Lines の「Compare」を食ってはならない。 

---

## 2. 1ノードの定義

Heatmap 上の1つのノードは、**その時点で配信中の1ライブセッション**を表す。

配信者単位ではなく、**現在 live の1配信枠**として扱う。

ルールは以下で固定する。

* 同じ配信者が今 live 中なら 1ノード
* 配信終了したらノードは消滅
* 次回 live 開始時は新しいセッションとして再登場
* 同一セッション重複は許可しない
* 非ライブ枠は表示しない

この定義は元仕様の「現在配信中の1ライブ枠」を引き継ぐ。

---

## 3. 取得・更新周期

v1 では **1分ごと更新** で固定する。

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

この方針は元仕様と共通仕様をそのまま維持する。 

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

Heatmap の中心は **Canvas 上の bubble field** に固定する。
1ノードの見た目は以下で決める。

### 5.1 ノードの大きさ

**大きさ = 現在視聴者数**

ただし線形ではなく、半径は平方根圧縮を使う。

例:

`radius = base + scale * sqrt(viewers)`

これにより、

* 大手だけが巨大化しすぎない
* 中規模も見える
* 小規模も消えにくい

### 5.2 ノードの色

**色の濃さ = viewers の相対順位**

* 上位ほど濃い
* 下位ほど薄い
* 色相は 1系統で固定
* 多色カテゴリ分けはしない

色はカテゴリではなく、**存在感の強弱**だけに使う。

### 5.3 ノードの発光

**発光 = momentum**

momentum は、直近 snapshot と比較した伸びで決める。

`momentum_raw = (viewers_now - viewers_prev) / max(viewers_prev, 20)`

* 増加していれば発光
* 横ばいは弱い
* 減少時は発光なしまたは極小

発光は外周リングまたは外周グローで表現し、ノード本体色は変えすぎない。

---

## 6. Activity signal の定義

TwitCasting 版では「コメント速度」を使っていたが、Twitch-only MVP では **provider-independent な activity signal** に置き換える。

### 6.1 基本方針

Heatmap で扱う activity は、**短時間での活発さを表す補助指標** とする。
ただし v1 では、**views でも momentum でもない第3の補助信号**として使うにとどめる。

### 6.2 v1 の設計原則

* activity は **必須の主軸ではない**
* viewers と momentum が Heatmap の主役
* activity は取得できる範囲で補助的に使う
* 取得不能なら隠さず縮退表示する

### 6.3 v1 の activity_raw

v1 では以下のいずれかを provider 実装で採用してよい。

* 短時間の interaction signal
* 短時間の visibility change signal
* 短時間の stream activity proxy
* 将来の chat-derived signal

ただし、**どの signal を使うかは method に明記**し、
取得不能な時は `activity_unavailable` を状態として扱う。

### 6.4 正規化

activity_raw は、その瞬間の viewers 規模に対して極端に小規模が有利になりすぎないよう、相対補正を行う。

例:

`activity_norm = activity_raw / sqrt(viewers + base_floor)`

係数の詳細は shared 定数で管理し、あとから調整可能にする。

### 6.5 用語

UI 上は基本的に **Activity** と表示する。
内部概念として `agitation` を残してもよいが、v1 の表面文言は Twitch 向けに **Activity** を優先する。

---

## 7. Activity level の段階表示

ノードの「ざわつき」は **6段階表示** に固定する。

* Lv0: still
* Lv1: faint
* Lv2: low
* Lv3: clear
* Lv4: strong
* Lv5: intense

### 7.1 段階化ルール

固定閾値ではなく、**その瞬間の観測対象内での相対分布**で切る。

初期ルール:

* 下位30% → Lv0
* 30–50% → Lv1
* 50–70% → Lv2
* 70–85% → Lv3
* 85–95% → Lv4
* 上位5% → Lv5

### 7.2 目的

これにより、

* 昼夜差に耐える
* 大型イベント日にも耐える
* 絶対値固定より破綻しにくい

### 7.3 補足

この式と閾値は **v1 仮採用** とする。
raw を残し、観測後に再調整可能とする。
この「6段階」「相対分布で切る」という骨格は元仕様を維持する。

---

## 8. ノード配置

配置は「見た目重視のランダム」ではなく、**安定して読める配置**にする。

### 8.1 配置原則

* viewers 上位ほど中央寄り
* 下位ほど外周寄り
* 毎更新で大移動しない
* 同一セッションは前回位置から滑らかに補間
* ノード同士は重なりすぎない

### 8.2 v1 配置方式

v1 は複雑な force simulation を主役にしない。
基本は **安定配置 + 軽い衝突回避** でよい。

### 8.3 新規登場

新規ノードは外周からフェードインして定位置へ入る。

### 8.4 終了ノード

終了ノードは即消しせず、

* 透明度低下
* 少し縮小
* フェードアウト

の順で消す。

この配置思想とアニメーション抑制は元仕様を維持する。 

---

## 9. アニメーション規則

Heatmap は動きが重要だが、うるさくしない。

### 9.1 許可する動き

* Activity level に応じた微振動
* momentum に応じた発光
* 更新時の位置補間
* hover / tap 時の軽い拡大

### 9.2 禁止する動き

* 常時激しい飛び跳ね
* 毎回の全面再レイアウト
* 粒子の大量散布
* 背景の常時流体演出
* ノード数増加時に破綻する発光乱発

### 9.3 Toggle

ユーザーは以下を切り替え可能とする。

* Animation On
* Animation Off
* Low Load Mode

### 9.4 Off 時

* 震え停止
* 発光弱化
* 位置補間だけ残す

この方針は Heatmap 独自仕様と共通仕様の両方を踏襲する。 

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

* Heatmap canvas

### 10.4 Secondary

* Legend
* Summary metrics
* Detail panel

### 10.5 補足

元仕様の `Comment window 1m / 3m / 5m` は、Twitch-only MVP では **Activity window 1m / 3m / 5m** に変更する。
activity signal が取れない provider 状況では、この control は disabled または hidden にしてよい。

---

## 11. Detail panel

ノード選択時に以下を表示する。

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

### 11.3 表示原則

* unavailable な値を実測値のように見せない
* 取れない項目は `Not available in current source` などで明示
* Panel は PC では右サイド、モバイルでは bottom sheet

元仕様の詳細パネル構造は維持しつつ、comments/min 依存だけを activity 表現へ差し替える。 

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

全ノードに常時ラベルは出さない。

### 13.1 常時表示

* Top 10: name + viewers
* 11〜20位: name only
* それ以下: hidden

### 13.2 hover / tap 時

* full info
* selected node emphasis
* other nodes dim

### 13.3 理由

Heatmap は密度が高いので、常時全文字表示は禁止する。
この方針は元仕様を維持する。 

---

## 14. モバイル挙動

モバイルでは見せ方を簡略化する。

### 14.1 残すもの

* Top 20 / 50
* Activity window 1m / 3m
* Refresh
* Animation On/Off
* ノードタップ詳細

### 14.2 削るもの

* Top 100
* 細かいラベル密度設定
* 複雑な表示モード
* 長い説明文

### 14.3 詳細表示

詳細は **bottom sheet** で出す。

### 14.4 追加原則

* hover 前提 UI 禁止
* タップだけで主操作が完了すること
* 低負荷モードへの切替を許容する

Heatmap のモバイル簡略化は元仕様と共通仕様に従う。 

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

v1 の Heatmap では以下をやらない。

* クロスプラットフォーム比較
* game / category 別クラスタを主役にすること
* ログイン保存
* follow ベース優先表示
* 配信者プロフィール分析
* コメント本文解析
* VOD / Clip 深部連携
* Battle Lines 的な精密時系列比較
* Day Flow 的な1日俯瞰

Heatmap はあくまで **瞬間観測** に限定する。
この「瞬間観測に限定する」という制約は元仕様を維持する。

---

## 18. v1 完成条件

Heatmap の完成条件はこれで固定する。

### 18.1 必須

* 現在 live 中の Top N を表示できる
* viewers に応じてノードサイズが変わる
* momentum が発光で見える
* activity signal が使える時は level 反映される
* activity signal が使えない時は partial / unavailable が分かる
* 1分更新が滑らかに反映される
* ノード選択で詳細が見られる
* stale / partial / empty / error / demo が分かる
* モバイルで最低限の操作ができる
* Top 100 でも崩れず、低負荷モードで生き残れる

### 18.2 不可

* 更新のたびに配置が崩れる
* 小規模配信が activity だけで主役化しすぎる
* viewers 主役が失われる
* activity unavailable を隠して通常値のように見せる
* モバイルで操作不能
* 何を見ているか説明なしで分からない
* 背景タブ放置で描画が暴走する

元仕様の完成条件である「Top N 表示」「サイズ変化」「momentum 発光」「詳細表示」「状態区別」を維持しつつ、Twitch-only MVP 向けに `activity unavailable` の扱いを追加する。 

---

## 19. UI 文言の基準

Heatmap 画面で使う v1 英語文言は以下の思想で固定する。

* 難しい専門語を増やさない
* `Now` が伝わる短文にする
* official を装わない
* activity が unavailable の時は隠さず言う

例:

* `Live heat field of Twitch streams right now`
* `Updated every minute`
* `Activity signal is limited in current source`
* `Showing top live streams by viewers`

文言の最終 wording 自体は copy pack で別定義してよいが、方向性はこの仕様に従う。

---

## 20. この機能の一言定義

**Heatmap is the “Now” view of Twitch Livefield: a live bubble field that shows which streams are biggest, most active, and rising right now.**
