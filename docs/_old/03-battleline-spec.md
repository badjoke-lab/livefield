# TwitCasting Livefield / Battle Lines 仕様確定

## 1. この機能の役割

Battle Lines は、**複数の配信者の視聴者数推移を、時間軸上で精密に比較する機能**とする。

この画面で分かることは4つに固定する。

* **誰がいつ強かったか**
* **誰と誰がいつ逆転したか**
* **誰がどの時間帯で急伸したか**
* **視聴者数の推移と、コメント熱量の高まりがどう重なっていたか**

Heatmap は瞬間観測、Day Flow は1日の支配率俯瞰、
Battle Lines はその中でも **個別比較を最も正確に読む分析画面** とする。

---

## 2. 1ラインの定義

Battle Lines 上の1本の線は、**その日の1配信者**を表す。

### ルール

* 同じ配信者の同日複数セッションは、1本の線として扱う
* 配信していない時間帯は値 0 とする
* 同一日の別セッションも同一人物として連続管理する

つまり Day Flow と同じく、単位は **配信者単位** に固定する。

---

## 3. 時間軸と更新周期

### 時間軸

* 横軸: 00:00〜24:00
* デフォルト表示: **Today**
* 切替:

  * Today
  * Yesterday
  * 任意の日付 1日単位

### 表示粒度

* デフォルトは **5分バケット**
* 切替:

  * 1m
  * 5m
  * 10m

### 更新

* 当日表示時は 1分ごと更新
* フロントは現在見ている粒度に合わせて再描画
* 過去日は固定表示

### 理由

Battle Lines は Day Flow より細かい比較が主役なので、
V1 でも **1m 表示切替** を許可する。

---

## 4. 縦軸と表示モード

Battle Lines は折れ線グラフが主役なので、
縦軸の意味を明確に分ける。

### 4-1. Viewers モード

**縦軸 = 視聴者数の実数**

* 最も基本の比較モード
* 誰が何人で推移したかが分かる
* 逆転やピークが最も直感的に読める

### 4-2. Indexed モード

**縦軸 = 各配信者のその日最大値を100とした指数**

* 大手と中規模を同じ土俵で比較するモード
* 絶対人数ではなく、伸び方・落ち方を見る
* 「誰がどの時間に急に伸びたか」が読みやすい

### 初期設定

* デフォルトは **Viewers**
* Indexed は補助比較モードとして切替可

### V1でやらないもの

* Share モードは Battle Lines では持たない
  それは Day Flow の役割とする

---

## 5. 表示対象

Battle Lines は線が増えると即読みにくくなる。
だから表示対象は厳しく絞る。

### 初期表示

* Top 3
* Top 5
* Top 10

デフォルトは **Top 5**。

### 選定基準

初期表示対象は、**その日の viewer-minutes 総量順** とする。

### 比較モード

Battle Lines は表示対象の出し方を3種類持つ。

#### A. Top mode

その日の Top N を表示

#### B. Focus mode

選択した1配信者だけを強調表示

#### C. Focus + Rivals mode

選択した1配信者に対して、関連する上位ライバル数名を表示

V1では A と B を必須、C は簡易版で可。

---

## 6. 線の見た目ルール

### 6-1. ライン本体

各配信者を **滑らかな折れ線** で描く。

* 基本は spline / smoothed line
* ただし過剰に丸めない
* 実データの山谷が消えない程度に補間

### 6-2. 線の太さ

太さはほぼ固定でよい。
ただし選択中だけ少し太くする。

* 通常線: 標準太さ
* 選択線: +1段太い
* 非選択線: やや細く / 透明度低下

### 6-3. 線の色

各配信者に固有色を割り当てる。

* Day Flow と同じ色体系をできるだけ維持
* Top 5 は識別しやすい色
* 非選択線は少し抑えめ
* 背景は dark 基調

### 6-4. 塗りつぶし

V1では、線の下のエリア塗りつぶしは **ごく薄く** 許可する。
ただし主役は線であり、面ではない。

---

## 7. コメント盛り上がりの扱い

Battle Lines でも、コメントは **線の高さに使わない**。
高さは最後まで視聴者数のみ。

### 7-1. 元指標

各時点で以下を持つ。

`cpm = Δcomments / Δminutes`
`agitation_raw = cpm / (viewers + 20)`

### 7-2. 表現

コメント盛り上がりは、線そのものではなく **線の周囲の演出** に使う。

* 低い: 演出なし
* 中程度: うっすら外周グロー
* 高い: 明確なグロー
* 極端に高い: 熱点パルス

### 7-3. 原則

* 線形状を崩さない
* 波打ちを主役にしない
* コメント演出で可読性を壊さない

Battle Lines の主役はあくまで **視聴者数推移の読みやすさ** とする。

---

## 8. 勢いの扱い

Battle Lines では「伸び」を明確に見せる。

### 指標

`momentum_raw = (viewers_now - viewers_prev) / max(viewers_prev, 20)`

### 表現

* 上昇が強い区間: 線の進行方向に短いハイライト
* 急伸点: 小さな Rise マーカー
* 下落点: 必須ではないが、将来的に弱い下降マーカーは可

### 役割

* ただの上下ではなく、勢いがついた瞬間を読む補助
* Day Flow より詳細に、Heatmap より時系列的に出す

---

## 9. イベントマーカー

Battle Lines には、折れ線比較に必要なマーカーだけを置く。

### 必須

* **Peak**: 当日最大視聴者数
* **Rise**: 急伸が大きかった点
* **Heat**: agitation が極端に高かった点
* **Start**: 初回配信開始
* **End**: 最終配信終了

### 表示ルール

* 全線に常時全部は出さない
* 選択中配信者にはフル表示
* 非選択配信者には Peak のみ軽表示

---

## 10. 交差と逆転の扱い

Battle Lines の重要な役割の1つは、**逆転の瞬間** を読むこと。

### 逆転定義

ある2配信者の viewers が前後バケットで順位入れ替わりした場合、
その区間を「逆転」とみなす。

### 表現

* hover/tap 時のみ逆転点を強調
* 選択配信者に対する逆転相手だけ表示
* 常時すべての逆転点は出さない

### 役割

* 「誰がどの時間で誰を抜いたか」を見る
* Battle Lines 独自の分析価値にする

---

## 11. UI構成

Battle Lines ページの構成は以下で固定する。

### 上部

* ページ名
* 短い説明
* Date
* Coverage
* Granularity
* Status

### コントロール

* Today / Yesterday / Date picker
* Top 3 / 5 / 10
* Viewers / Indexed
* 1m / 5m / 10m
* Focus selector
* Auto update On/Off
* Refresh

### サマリー

* Peak battle
* Biggest rise
* Most heated line
* Most reversals

### 本体

* Battle Lines chart

### 補助

* Focus strip
* 凡例
* 詳細パネル

---

## 12. Focus strip

Battle Lines には、表示対象を切り替えるための **Focus strip** を持たせる。

### 役割

線だけだと、誰を主役に見ているか迷いやすい。
なのでチャート上部または下部に、表示対象配信者の小さなチップ列を置く。

### 挙動

* チップタップで配信者選択
* 選択者は強調
* 他は少し抑制
* モバイルでは横スクロール可

### V1で残すべきもの

* 名前
* 現在順位 or 今日順位
* 現在 viewers or peak viewers

---

## 13. 詳細パネル

PCでは右側、モバイルでは bottom sheet に出す。

### 表示内容

選択した配信者について

* streamer name
* current or selected title
* peak viewers
* avg viewers
* biggest rise
* longest strong period
* max comments/min
* max agitation level
* reversal count
* first seen / last seen

### ミニ補助

* 選択者単独の viewers mini chart
* agitation strip
* rival comparison short list

### アクション

* Highlight only
* Add rival
* Open stream
* Jump to Day Flow

---

## 14. ラベル表示

Battle Lines は線が主役なので、ラベルは制御する。

### 常時表示

* 右端付近に Top 3〜5 の線名ラベル
* 選択線は固定ラベル
* 非選択線は必要最小限

### hover / tap 時

* 時刻
* viewers
* indexed value
* agitation level
* momentum
* current rank among visible lines

### 現在時刻

当日表示では現在時刻の縦線を出す。

---

## 15. モバイル挙動

モバイルでは比較対象をさらに絞る。

### 残すもの

* Top 3 / 5
* Viewers / Indexed
* 1m / 5m
* Focus strip
* 線タップ詳細

### 削るもの

* Top 10
* 過剰な逆転点表示
* 細かい補助グラフの常時表示

### 操作

* 横なぞりで時刻カーソル移動
* 線タップで選択
* 詳細は bottom sheet
* rivals 追加は簡易化

---

## 16. データ保存

Battle Lines 用にも raw と rollup を残す。

### raw 由来

* 1分ごとの viewers
* comment_count
* delta_comments
* cpm
* agitation_raw
* momentum_raw

### 表示用整形

各配信者・各バケットごとに

* viewers
* indexed_value
* avg_cpm
* agitation_level
* momentum_raw
* is_peak
* is_rise
* is_heat
* is_start
* is_end

### 保存役割

* **D1**: raw と日別ロールアップ
* **KV**: 今日の表示用キャッシュ

---

## 17. 状態設計

Battle Lines は以下の状態を持つ。

### loading

* 骨組み表示
* `Loading battle lines...`

### live today

* 今日の途中データ
* 現在時刻以降は空白

### partial

* 欠損区間あり
* 黄色 note
* 欠損区間は線を切るか薄表示

### complete

* 過去日で全日分あり
* 通常表示

### empty

* 表示条件に該当データなし
* reset を促す

### error

* 赤 note
* retry
* demo mode 切替可能

### demo

* デモデータ表示
* 本番と明確に区別

---

## 18. Battle Lines がやらないこと

V1 の Battle Lines では以下をやらない。

* クロスサイト比較
* コメント本文解析
* AIによる対戦要約
* 勝敗判定の自動文章化
* 視聴者属性分析
* フォロー配信者優先表示
* ログイン保存

Battle Lines はあくまで **1サイト内の複数配信者の時系列比較** に限定する。

---

## 19. v1 完成条件

Battle Lines の完成条件はこれで固定する。

### 必須

* 複数配信者の viewers 推移を線で比較できる
* Viewers と Indexed を切り替えられる
* コメント盛り上がりが線の外周演出で見える
* 急伸点とピーク点が読める
* Focus で1配信者を強調できる
* 逆転点を補助的に確認できる
* partial / empty / error / demo が分かる

### 不可

* 線が多すぎて読めない
* コメント演出で線形が潰れる
* モバイルでどの線を見ているか分からない
* Day Flow と役割が被って曖昧になる

---

## 20. この機能の一言定義

最後に一文で固定する。

**Battle Lines は、TwitCasting 内の主要配信者どうしの視聴者数推移を時間軸上で並べ、逆転・急伸・熱点を精密に読むための比較機能。**
