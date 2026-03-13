# Twitch Livefield / Day Flow 仕様確定 v1.0 改訂版

## 1. この機能の役割

Day Flow は、**Twitch の1日の支配率地図**を見る機能とする。

この画面で分かることは、v1 では以下の4点に固定する。

* **When the total audience was large**
  = どの時間帯に全体総量が大きかったか
* **Who dominated which hours**
  = どの配信者がどの時間帯を取っていたか
* **How volume and share differ**
  = 絶対人数の大きさと、構成比の支配がどう違うか
* **Where important moments happened**
  = その日のピーク、熱点、立ち上がりがどこだったか

Day Flow は折れ線比較ではない。
**1日全体を“地形”として読む画面**とする。
サイト全体の役割分担上、Day Flow は **Today** を担い、Heatmap の「Now」と Battle Lines の「Compare」を食ってはならない。 

---

## 2. 表示対象の定義

Day Flow の対象は、**その日観測された live 配信セッション群**とする。

### 2.1 日単位の対象

* `Today`
* `Yesterday`
* 任意の日付 1日単位

### 2.2 観測対象

* その日の観測範囲に入った Twitch live stream
* 1日の途中で始まった配信も含む
* 1日の途中で終了した配信も含む

### 2.3 非対象

* 非ライブ期間そのもの
* その日一度も観測されなかった配信
* クロスプラットフォームの混在比較

Day Flow は「その日、Livefield が観測した Twitch 空間」の俯瞰である。

---

## 3. 時間軸と更新周期

### 3.1 時間軸

* 横軸: **00:00〜24:00**
* デフォルト表示: **Today**
* 切替:

  * Today
  * Yesterday
  * 任意の日付 1日単位

### 3.2 表示粒度

* デフォルトは **5分バケット**
* 切替:

  * 5m
  * 10m

### 3.3 更新

* Today 表示時は 1分収集を反映して更新
* ただし描画は 5m / 10m バケット表示に整形する
* 過去日は固定表示
* 現在時刻以降の未来区間は描かない

### 3.4 理由

* Day Flow は「今」ではなく「その日」を読む画面
* 1分帯をそのまま積むと密度が高すぎる
* 5分中心が読みやすさと鮮度のバランスが良い

この「1分収集を5分中心で見せる」という骨格は、共通仕様と元仕様を維持する。 

---

## 4. 表示対象数と選定基準

Day Flow は、全配信をそのまま描かない。
表示対象は **Top N + Others** で固定する。

### 4.1 初期表示

* Top 10
* Top 20
* Top 50

デフォルトは **Top 20 + Others** とする。

### 4.2 選定基準

表示対象の上位判定は、**その日の viewer-minutes 総量順** とする。

`viewer_minutes = 各バケットの avg_viewers × バケット時間`

これにより、

* 一瞬だけ大きかった配信
* 長時間強かった配信

の両方を適切に評価できる。
この選定基準と Others 必須方針は元仕様を引き継ぐ。

### 4.3 Others

表示対象外は **Others** として1本にまとめる。

Day Flow は支配率画面なので、Others を入れないと

* 総量が欠ける
* Share が壊れる
* 地形として読めなくなる

ため、Others は **必須** とする。

---

## 5. 表示モード

Day Flow は、同じ地形を **Volume** と **Share** の2つで読む。

### 5.1 Volume モード

**厚み = その時間帯の視聴者数の絶対量**

分かること:

* その時間に実人数として大きかった配信
* 全体総量の増減
* 絶対規模での支配

### 5.2 Share モード

**厚み = その時間帯の構成比**

分かること:

* その時間に空間をどれだけ支配していたか
* 全体が小さい時間帯でも相対支配が強かった配信
* 総量ではなく占有率の変化

### 5.3 初期設定

* デフォルトは **Volume**
* Share は比較用補助モード

### 5.4 原則

Day Flow の厚みは最後まで **視聴者数だけ** で決める。
activity やその他補助信号で帯の高さを変えてはならない。
この「Volume / Share 切替」と「高さは viewers だけで決める」方針は元仕様を維持する。 

---

## 6. バンドの見た目ルール

### 6.1 バンドの厚み

* Volume モードでは絶対人数ベース
* Share モードでは時点構成比ベース

### 6.2 バンドの色

各配信者に **固有色** を1つ割り当てる。

ただし配色には制限をかける。

* 上位は識別しやすい
* 暗背景で破綻しない
* 蛍光色だらけにしない
* Others は中立グレー寄り

色は配信者識別のために使い、
順位や盛り上がりの主表現にしすぎない。

### 6.3 バンド境界

隣接帯の境界は少し柔らかく見せるが、溶かしすぎない。

* 見た目は滑らか
* 境界は読める
* 単なる業務用 stacked area に見えすぎない

### 6.4 原則

Day Flow の主役は **帯の地形** である。
表面演出は、それを読みにくくしてはならない。

---

## 7. 並び順

バンド順は時間ごとに並び替えない。
**1日を通して固定**する。

### 7.1 初期ルール

並び順は **その日の viewer-minutes 総量順** に固定する。

* 最も強かった配信者が最下層
* 次がその上
* 以後そのまま固定

### 7.2 理由

* 時間ごと並び替えは形が壊れる
* 地形として読めなくなる
* 1日の支配率画面としての価値が落ちる

### 7.3 v1 でやらないこと

* 時間ごとの自動再ソート
* 複数の並び替えモード乱立

この固定順方針は元仕様をそのまま使う。

---

## 8. Activity signal の扱い

TwitCasting 版ではコメント盛り上がりを補助に使っていたが、Twitch-only MVP では **activity signal** に置き換える。

### 8.1 基本方針

Day Flow では activity は **帯の高さに使わない**。
activity は **帯の表面演出とマーカー補助** に限定する。

### 8.2 v1 での役割

activity は以下の3つだけに使う。

* **弱い高まり**
  = 帯の外周が少し明るくなる
* **強い高まり**
  = 帯の縁に明確なグロー
* **極端な高まり**
  = その区間に Heat マーカーを打つ

### 8.3 何をしないか

* activity で帯を上下させない
* 常時ノイズで帯表面をうるさくしない
* 波打ちを主役にしない

Day Flow の主役はあくまで **視聴者数による支配率** であり、activity は **熱点の補助情報** に固定する。これは元仕様の「コメント熱点は補助」という考え方を Twitch 向けに読み替えたもの。 

### 8.4 unavailable 時の扱い

activity signal が取れない場合は、

* グロー表現を出さない
* Heat マーカーを出さない
* summary の activity 関連項目を unavailable 扱いにする
* partial note で明示する

隠して通常表示に見せてはならない。

---

## 9. イベントマーカー

Day Flow には、その日重要だった点だけマーカーを置く。

### 9.1 マーカー種別

* **Start**: その日の初回配信開始
* **End**: その日の最終配信終了
* **Peak**: その配信者の当日最大視聴者数
* **Heat**: activity が極端に高かった時点
* **Rise**: 伸び率が大きかった時点

### 9.2 表示ルール

* 常時全部は出さない
* 基本は選択配信者のみ詳細表示
* 全体表示では Peak と Heat だけを軽く見せる
* モバイルではさらに絞る

このマーカー設計は元仕様の構造を維持し、`Heat` だけ activity ベースに読み替える。 

---

## 10. UI構成

Day Flow ページの構成は以下で固定する。

### 10.1 上部

* Page title
* Short description
* Date
* Coverage
* Bucket size
* Status

### 10.2 Controls

* Today / Yesterday / Date picker
* Top 10 / 20 / 50
* Volume / Share
* 5m / 10m
* Auto update On/Off
* Refresh

### 10.3 Summary

* Peak leader
* Longest dominance
* Highest activity or `Activity unavailable`
* Biggest rise

### 10.4 Main

* Day Flow chart

### 10.5 Secondary

* Time Focus
* Legend
* Detail panel

この UI 構成は元仕様を維持する。

---

## 11. Time Focus

Day Flow には、**任意時刻の切り出し機能**を持たせる。

### 11.1 役割

色帯だけでは、ある1時点の順位が読みづらい。
そのため、グラフ上下のどちらかに **現在選択時刻のカーソル / スライダー** を持たせる。

### 11.2 表示内容

任意時刻を選ぶと、その時点で

* 1位〜5位の配信者
* 各 viewers
* 各 share
* highest activity if available
* strongest momentum

を出す。

### 11.3 位置づけ

Time Focus は、**その時刻のミニ Heatmap 的補助**であり、
Day Flow の地形理解を補うためのものとする。

この機能は元仕様の中核なので、そのまま維持する。

---

## 12. 詳細パネル

PC では右側、モバイルでは bottom sheet に出す。

### 12.1 表示内容

選択した配信者について

* streamer name
* selected or current title
* today peak viewers
* avg viewers
* viewer-minutes total
* peak share
* highest activity if available
* biggest rise time
* first seen / last seen

### 12.2 ミニグラフ

* 当人だけの viewers line
* 当人だけの activity strip if available

### 12.3 アクション

* Highlight only this band
* Dim others
* Open stream
* Jump to Battle Lines

元仕様の詳細パネル構造を維持しつつ、`max comments/min` や `max agitation level` を activity 中心表現に差し替える。

---

## 13. ラベル表示

Day Flow は情報密度が高いので、ラベルは絞る。

### 13.1 常時表示

* 左側または開始位置付近に Top 5〜10 の配信者名
* Others もラベル表示
* 小さすぎる帯の内部ラベルは出さない

### 13.2 hover / tap 時

* 選択帯を強調
* フル情報をパネルに表示
* 非選択帯を少し dim

### 13.3 原則

* 全帯に全文字表示しない
* 小帯に無理な内包ラベルを出さない
* モバイルでは常時ラベル数をさらに減らす

---

## 14. モバイル挙動

モバイルでは Day Flow を簡略化する。

### 14.1 残すもの

* Today / Yesterday
* Top 10 / 20
* Volume / Share
* Time Focus
* 帯タップ詳細

### 14.2 削るもの

* Top 50
* 細かい並び替え
* 余分な説明文
* 過剰なマーカー表示

### 14.3 操作

* 横スワイプで時間をなぞれる
* タップで帯を選択
* 詳細は bottom sheet

このモバイル簡略化は元仕様どおり。

---

## 15. データ保存

後で再計算・比較できるよう、Day Flow 用の raw と rollup を保存する。
ただし無料運営前提のため、保存は **D1 主体** に寄せる。

### 15.1 raw 由来

最低限保持するもの:

* 1分ごとの viewers
* momentum_raw
* activity_raw if available
* stream/session meta
* source status

### 15.2 5分ロールアップ

各配信者・各5分バケットごとに以下を持つ。

* avg_viewers
* max_viewers
* share
* activity_raw if available
* activity_level if available
* momentum_peak
* is_start
* is_end
* is_peak

### 15.3 保存役割

* **D1**: 1分 raw + 5分 rollup
* **KV**: 必須ではない。使う場合も最新軽量 payload のみ
* 無料枠を壊す page-specific 過剰保存は禁止

元仕様の「raw + 5分 rollup を残す」構造は維持しつつ、KV 前提は弱める。

---

## 16. 状態設計

Day Flow は以下の状態を持つ。

### 16.1 loading

* 骨組み表示
* `Loading day flow...`

### 16.2 live today

* 今日の途中データを表示
* 現在時刻以降は空白
* 1分収集を元に更新

### 16.3 partial

* データ欠損あり
* activity unavailable
* coverage 制限あり
* 集計途中

のいずれか

* 黄色 note 表示
* 欠損区間はギャップまたは薄表示

### 16.4 complete

* 過去日で全日分あり
* 通常表示

### 16.5 empty

* 該当日の有効データなし
* date reset を促す

### 16.6 error

* 赤 note
* retry
* demo mode 切替可能

### 16.7 demo

* デモデータ表示
* 本番と明確に区別

この状態設計は元仕様をほぼ維持する。 

---

## 17. Day Flow がやらないこと

v1 の Day Flow では以下をやらない。

* 折れ線比較を主画面にしない
* クロスサイト比較
* ジャンル別積み上げ
* チャット本文解析
* ログイン保存
* AI要約
* 自動クラスタ分解
* Battle Lines 的な線の主役化
* Heatmap 的な瞬間ノード分布

Day Flow はあくまで **1サイト内の1日支配率の可視化** に限定する。
この制約は元仕様をそのまま引き継ぐ。

---

## 18. v1 完成条件

Day Flow の完成条件はこれで固定する。

### 18.1 必須

* 今日または任意日の主要配信者を色帯で表示できる
* Volume と Share を切り替えられる
* バンド厚みが視聴者数を反映する
* activity signal がある時は熱点/縁グローで見える
* activity signal がない時は unavailable / partial が分かる
* Others を含めて全体総量が崩れない
* Time Focus で任意時刻の順位が読める
* 詳細パネルで当日成績が見られる
* partial / empty / error / demo が分かる
* モバイルで時間選択と帯選択ができる

### 18.2 不可

* 時間ごと並び替えで帯が崩壊する
* 表面演出がうるさすぎて支配率が読めない
* Others なしで全体が欠ける
* activity unavailable を隠す
* モバイルで時間選択ができない

元仕様の完成条件を維持しつつ、Twitch-only MVP 向けに `activity unavailable` を明示条件として追加する。

---

## 19. UI 文言の基準

Day Flow 画面の英語文言は以下の思想で固定する。

* `Today` が一目で伝わる
* 地形として読む画面だと分かる
* 難語を増やさない
* activity unavailable は隠さない

例:

* `Daily audience landscape of Twitch streams`
* `See who owned each hour`
* `Switch between total volume and share`
* `Activity signal is limited in current source`

---

## 20. この機能の一言定義

**Day Flow is the “Today” view of Twitch Livefield: a daily landscape that shows who owned which hours, how big the total audience was, and where the important moments happened.**