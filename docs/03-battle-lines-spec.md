# Twitch Livefield

# Battle Lines 改訂仕様書 v2.1

## 位置づけ：Compare ではなく Rivalry Radar

## 1. 文書の位置づけ

本書は、Battle Lines の改訂仕様を定める。
本書は Battle Lines 単体の仕様書であり、優先順位は以下とする。

1. Livefield 共通仕様
2. サイト全体構成書
3. 本書
4. 実装タスク

本書に書かれていない共通ルールは、上位文書に従う。

---

## 2. この機能の役割

Battle Lines は、**複数の配信者の視聴者数推移を、時間軸上で精密に比較する機能**とする。

この画面で分かることは、次の4つを基本に固定する。

* 誰がいつ強かったか
* 誰と誰がいつ逆転したか
* 誰がどの時間帯で急伸したか
* 視聴者数の推移と、コメント熱量の高まりがどう重なっていたか

ただし改訂版では、ここに **「いま起きている battle を自動発見して見せる」** を追加する。

つまり Battle Lines は、
**複数配信者の視聴者推移を比較するページ**であると同時に、
**いま注目すべき対戦を見つけ、逆転・急伸・熱点を battle 単位で読むページ**とする。

Heatmap は瞬間観測、Day Flow は1日の支配率俯瞰、
Battle Lines はその中でも **個別比較を最も正確に読む分析画面** とする。

---

## 3. Battle Lines の一言定義

**Battle Lines は、視聴者数の時系列を使って「誰と誰が競っているか」「どこで逆転したか」「次に何が起きそうか」を読む Rivalry Radar である。**

---

## 4. この改訂で変わること

元の Battle Lines は、比較のための折れ線ページとして成立していた。
改訂版では、その役割を捨てないまま、入口を変える。

### 旧主語

* 比較すること
* 配信者を選ぶこと
* 逆転を調べること

### 新主語

* いま熱い battle を見つけること
* 逆転を読むこと
* 急伸を読むこと
* その後で手動比較に進むこと

つまり、
**最初はおすすめ battle から入るが、最終的にはユーザーが自由に掘れるページ**にする。

---

## 5. このページの主目的と非主目的

### 主目的

* 今、競っている配信者ペアを見つける
* 今日、どこで逆転が起きたかを見る
* どのラインが急伸して乱戦を起こしたかを見る
* 視聴者数の競争に対して、コメント熱量がどう重なったかを見る
* おすすめ battle を入口にしつつ、ユーザーが手動で battle を切り替えられるようにする

### 非主目的

* 任意の複数配信者を深く保存・管理する汎用比較ツール
* 長期比較の主画面
* シェア比較
* コメント本文解析
* 表主体の分析ページ
* 無制限の複雑比較

---

## 6. 1ラインの定義

Battle Lines 上の1本の線は、**その日の1配信者**を表す。

### ルール

* 同じ配信者の同日複数セッションは、1本の線として扱う
* 配信していない時間帯は値 0 とする
* 同一日の別セッションも同一人物として連続管理する

単位は **配信者単位** に固定する。

---

## 7. 時間軸と更新周期

### 時間軸

* 横軸: 00:00〜24:00
* デフォルト表示: Today
* 切替:

  * Today
  * Yesterday
  * 任意の日付 1日単位

### 表示粒度

* デフォルトは 5分バケット
* 切替:

  * 1m
  * 5m
  * 10m

### 更新

* 当日表示時は 1分ごと更新
* フロントは現在見ている粒度に合わせて再描画
* 過去日は固定表示

### 原則

* raw をそのまま毎回全面再計算しない
* Today は latest payload を軽量更新する
* 過去日は固定データとして扱う

---

## 8. 縦軸と表示モード

Battle Lines は折れ線グラフが主役なので、縦軸の意味を明確に分ける。

### 8-1. Viewers モード

**縦軸 = 視聴者数の実数**

* 最も基本の比較モード
* 誰が何人で推移したかが分かる
* 逆転やピークが最も直感的に読める

### 8-2. Indexed モード

**縦軸 = 各配信者のその日最大値を100とした指数**

* 大手と中規模を同じ土俵で比較するモード
* 絶対人数ではなく、伸び方・落ち方を見る
* 誰がどの時間に急に伸びたかが読みやすい
* 中規模戦の発見に使う

### 初期設定

* デフォルトは Viewers
* Indexed は補助ではなく、**勢い比較モード**として明確に残す

### V1でやらないもの

* Share モードは Battle Lines では持たない
* それは Day Flow の役割とする

---

## 9. 表示対象

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

Battle Lines は表示対象の出し方を4種類持つ。

#### A. Top mode

その日の Top N を表示する

#### B. Focus mode

選択した1配信者だけを強調表示する

#### C. Focus + Rivals mode

選択した1配信者に対して、関連する上位ライバル数名を表示する

#### D. Recommended mode

システムが自動選定したおすすめ battle を主役表示する

### 方針

* 初回表示は D を使う
* ユーザー操作後は B または C を優先してよい
* A は全体観察用として残す

---

## 10. おすすめ battle の導入方針

改訂版 Battle Lines では、**初回表示時におすすめ battle を自動表示**する。

ただし、運営固定の手動おすすめではない。
**その時点の live データから自動計算された battle 候補**を使う。

### 目的

* 初見ユーザーが最初に何を見ればいいか迷わないようにする
* Battle Lines を「比較ツール」より「対戦を読む画面」として見せる
* それでいて、ユーザーの自由な探索を殺さない

---

## 11. おすすめ battle の構成

おすすめ battle は1件だけではなく、**複数候補**を持つ。

### 構成

* **Primary battle**: 今の主役 battle
* **Secondary battles**: 次点 battle 候補 2〜3件
* **Latest reversal**: 直近逆転を強調する補助候補
* **Fastest challenger**: 今日もっとも急伸した挑戦者

### 画面上の見せ方

* 最上段に Primary battle を大きく表示
* その下または横に Secondary battles を 2〜3件表示
* Latest reversal と Fastest challenger はサマリーまたは feed に統合してよい

### 上限

* 初回表示で見せるおすすめ候補は **最大 4件相当** まで
* それ以上は「More battles」などで折りたたむ
* 初期状態で大量の battle 候補を並べない

---

## 12. おすすめ battle の自動選定ロジック

おすすめ battle は、可視対象の battle 候補に **battle score** を付けて決める。

### 候補集合

* デフォルトは現在の visible 対象内だけで計算する
* Top 5 なら最大 10ペア、Top 10 でも最大 45ペア
* モバイルでは Top 5 までに制限して軽量化する

### 基本スコア要素

* **closeness score**
  視聴者差が小さいほど高い
* **reversal recency score**
  直近逆転が新しいほど高い
* **momentum conflict score**
  片方または両方が伸びているほど高い
* **heat overlap score**
  同時間帯に heat が重なっているほど高い
* **rank relevance score**
  visible top 内で順位的重要度が高いほど高い

### Primary battle

その時点の highest score ペアを primary battle とする。

### Secondary battles

score 上位から primary を除いた 2〜3件を secondary とする。

### 原則

* score は運営手動ではなく自動計算
* raw 全量ではなく Battle Lines 用整形データの範囲で計算
* 見どころがない battle を無理に作らない

---

## 13. おすすめ battle の更新ルール

おすすめ候補は live データに応じて変わる。
ただし、**主役 battle が毎分コロコロ変わるのは避ける**。

### サーバー側

* battle score の再計算は Today では 1分ごとで可
* Yesterday / 過去日は固定計算でよい

### UI側

* primary battle の差し替えは安定条件を入れる
* 新候補が一定以上高スコアで、かつ 2〜3回連続した場合だけ差し替える
* 直近逆転が起きた場合だけ即差し替えを許可してよい
* secondary battles は primary より頻繁に更新してよい

### ユーザー操作中の原則

* ユーザーが手動で battle を見ている間は、画面主役を勝手に奪わない
* 裏ではおすすめ候補更新を続けてよい
* 「Back to recommended」で primary 表示に戻す

---

## 14. カスタム選択の方針

Battle Lines は、**おすすめを見るだけのページにはしない**。
おすすめは入口であり、その後はユーザーが自由に battle を掘れるようにする。

### 必須

* Focus selector
* Focus strip
* Add rival
* Top 3 / 5 / 10 切替
* Viewers / Indexed 切替
* 1m / 5m / 10m 切替
* Date 切替

### カスタム探索の原則

* おすすめから入っても、すぐに別配信者へ寄れる
* 任意の1配信者を主役にできる
* その人の rival を追加できる
* 上位戦だけでなく中規模戦も見つけられる

---

## 15. カスタム選択の具体モード

### 15-1. Focus selector

上部コントロールから任意配信者を選ぶ。

### 15-2. Focus strip

表示対象配信者のチップから選ぶ。

### 15-3. Add rival

詳細パネルから rival を追加して pair を作る。

### 15-4. Focus + Rivals

1配信者を選ぶと、その時点で最も戦っている相手や関連上位 rival を同時表示する。

### 15-5. Back to recommended

手動選択後に、おすすめ主役 battle に戻る導線を置く。

---

## 16. 初回表示フロー

Battle Lines を初めて開いた時の流れは以下で固定する。

1. latest payload を取得
2. primary battle と secondary battles を受け取る
3. primary battle を主役表示
4. secondary battles を候補欄に表示
5. chart は primary battle pair を最強調
6. 他の visible lines は薄く残す
7. Focus strip と detail panel は primary battle に対応した状態で開く

### 目的

* 初見で「何を見ればいいか」が分かる
* それでも他候補にすぐ飛べる

---

## 17. 線の見た目ルール

### 17-1. ライン本体

各配信者を滑らかな折れ線で描く。

* 基本は spline / smoothed line
* ただし過剰に丸めない
* 実データの山谷が消えない程度に補間

### 17-2. 線の太さ

太さはほぼ固定でよい。
ただし選択中だけ少し太くする。

* 通常線: 標準太さ
* 選択線: +1段太い
* 非選択線: やや細く / 透明度低下
* primary battle pair: 常時最強調
* secondary ではない非主役線: さらに抑制してよい

### 17-3. 線の色

各配信者に固有色を割り当てる。

* Day Flow とできるだけ同じ色体系
* Top 5 は識別しやすい色
* 非選択線は少し抑えめ
* 背景は dark 基調

### 17-4. 塗りつぶし

V1では、線の下のエリア塗りつぶしはごく薄く許可する。
ただし主役は線であり、面ではない。

---

## 18. コメント盛り上がりの扱い

Battle Lines でも、コメントは**線の高さに使わない**。
高さは最後まで視聴者数のみ。

### 元指標

`cpm = Δcomments / Δminutes`
`agitation_raw = cpm / (viewers + 20)`

### 表現

コメント盛り上がりは、線そのものではなく **線の周囲の演出** に使う。

* 低い: 演出なし
* 中程度: うっすら外周グロー
* 高い: 明確なグロー
* 極端に高い: 熱点パルス

### 原則

* 線形状を崩さない
* 波打ちを主役にしない
* コメント演出で可読性を壊さない

### 改訂版での役割

* heat は単独主役ではない
* **battle 文脈の補助証拠**として使う
* pair heat overlap がある時だけ「Most heated battle」候補として強く扱う
* 片方だけ高い heat は solo buzz として扱ってよい

---

## 19. 勢いの扱い

Battle Lines では「伸び」を明確に見せる。

### 指標

`momentum_raw = (viewers_now - viewers_prev) / max(viewers_prev, 20)`

### 表現

* 上昇が強い区間: 線の進行方向に短いハイライト
* 急伸点: 小さな Rise マーカー
* 下落点: 将来的に弱い下降マーカーは可

### 役割

* ただの上下ではなく、勢いがついた瞬間を読む補助
* Day Flow より詳細に、Heatmap より時系列的に出す

### 改訂版での追加役割

* Fastest challenger の判定材料に使う
* primary battle に乱入してきそうな challenger を読む補助に使う

---

## 20. イベントマーカー

Battle Lines には、折れ線比較に必要なマーカーだけを置く。

### 必須

* Peak: 当日最大視聴者数
* Rise: 急伸が大きかった点
* Heat: agitation が極端に高かった点
* Start: 初回配信開始
* End: 最終配信終了

### 表示ルール

* 全線に常時全部は出さない
* 選択中配信者にはフル表示
* 非選択配信者には Peak のみ軽表示
* primary battle pair には Rise / Heat をやや多めに許可
* secondary 以外の線では抑制する

---

## 21. 交差と逆転の扱い

Battle Lines の重要な役割の1つは、**逆転の瞬間**を読むこと。

### 逆転定義

ある2配信者の viewers が前後バケットで順位入れ替わりした場合、
その区間を「逆転」とみなす。

### 表現

* hover/tap 時のみ逆転点を強調
* 選択配信者または選択 pair に対する逆転相手だけ表示
* 常時すべての逆転点は出さない

### 役割

* 誰がどの時間で誰を抜いたかを見る
* Battle Lines 独自の分析価値にする

### 改訂版の追加

* **Reversal strip** をチャート直下に置いてよい
* strip には、現在選択 battle に関する逆転だけを並べる
* 本体チャートに逆転点を撒きすぎない

---

## 22. Reversal strip

Battle Lines v2.1 では、逆転を読みやすくするために **Reversal strip** を持ってよい。

### 表示内容

* reversal timestamp
* passer / passed
* gap before
* gap after
* heat overlap 有無

### 原則

* 本体チャートは線を読む場
* strip は逆転イベントを読む場
* モバイルでは横スクロール可
* Low Load Mode では件数を削減可

---

## 23. UI構成

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
* Back to recommended
* Recommended / Custom の現在状態表示

### サマリー

* Live battle now
* Latest reversal
* Fastest challenger
* Most heated battle

### おすすめ候補欄

* Other battles
* 2〜3件の secondary battle
* 必要なら More battles で折りたたみ

### 本体

* Battle Lines chart
* Reversal strip

### 補助

* Focus strip
* 凡例
* 詳細パネル
* Battle feed

---

## 24. 上部説明文

上部説明のトーンは、元の「比較分析ページ」より一歩具体化する。

### 推奨文言

* See who is fighting for attention right now
* Read reversals, surges, and heat around the same battle

### 日本語なら

* いま競っている配信者と、その逆転・急伸を読む
* 今日の battle を線で追う

---

## 25. サマリーカード

改訂版では、サマリーを battle 文脈に寄せる。

### 25-1. Live battle now

今の時点で最も接近している主役 battle

表示内容:

* pair 名
* current gap
* gap trend
* last reversal time
* next reversal chance

### 25-2. Latest reversal

直近で発生した逆転

表示内容:

* who passed whom
* estimated time
* gap before / after
* momentum intensity

### 25-3. Fastest challenger

今日もっとも速く上位戦へ食い込んだ配信者

表示内容:

* streamer
* rise window
* rise magnitude
* current battle target

### 25-4. Most heated battle

視聴者差が近く、かつ heat が重なった battle

表示内容:

* pair
* overlap window
* heat intensity

---

## 26. おすすめ候補欄

サマリーの直下または近接位置に、**おすすめ battle 候補欄**を置く。

### 表示件数

* secondary battle を 2〜3件
* 最大でも 3件を基本
* 4件目以降は More battles

### 各候補の表示項目

* pair 名
* 短いタグ 1つ

  * closing
  * recent reversal
  * rising challenger
  * heated
* current gap または last reversal time のどちらか1つ

### タップ時の挙動

* その候補 battle を主役表示に切り替える
* chart 強調対象が切り替わる
* detail panel も同期する
* この時点でユーザーは custom state に入る

---

## 27. Battle feed

改訂版では、短い curated feed を持ってよい。

### 内容

* A is closing in on B
* C passed D at 21:35
* E entered the top battle window
* F vs G drew strong heat overlap

### 件数

* 3〜5件まで
* raw ログではなく、battle score とイベントから選ぶ

### 役割

* 静的な比較ページに見せない
* いま動いている戦況を短文で伝える

---

## 28. Focus strip

Battle Lines には、表示対象を切り替えるための **Focus strip** を持たせる。

### 役割

線だけだと、誰を主役に見ているか迷いやすい。
なのでチャート上部または下部に、表示対象配信者の小さなチップ列を置く。

### 挙動

* チップタップで配信者選択
* 選択者は強調
* 他は少し抑制
* モバイルでは横スクロール可

### 表示項目

* 名前
* 現在順位 or 今日順位
* 現在 viewers or peak viewers
* 簡易 battle status

  * leading
  * chasing
  * just passed
  * rising
  * quiet

### 改訂版の追加原則

* primary battle pair の2人は strip 上でも目立たせる
* チップ選択後は focus state に遷移する
* その配信者の current rival を一緒に強調してよい

---

## 29. カスタム選択時の挙動

ユーザーが手動で配信者や battle を選んだ場合、Battle Lines は **custom state** に入る。

### custom state のルール

* primary battle の自動表示よりユーザー選択を優先
* おすすめ候補欄は残してよい
* ただし主役表示はユーザー選択 battle のまま維持
* 自動更新が来ても勝手に主役 battle を奪わない
* 「Back to recommended」で自動 battle に戻る

### custom state の入口

* secondary battle をタップ
* Focus strip をタップ
* Focus selector から配信者を選ぶ
* Add rival を使う

---

## 30. Focus selector

上部コントロールには **Focus selector** を持たせる。

### 用途

* 任意の配信者を直接選ぶ
* おすすめ候補に出ていない配信者でも主役にできる
* Top mode から focus へ即移動できる

### 挙動

* 選択時、その配信者の線を強調
* 必要に応じて current rival を自動追加
* rival がなければ単独 focus でもよい
* detail panel をその配信者に同期する

---

## 31. Add rival

詳細パネルから **Add rival** を実行できる。

### 用途

* ユーザーが見たい pair を明示的に組む
* システムおすすめ以外の戦いを読む

### 挙動

* 選択配信者に rival を追加
* chart はその pair を主役表示
* custom state に遷移
* 元のおすすめ候補欄は消さずに縮小してもよい

### 制限

* 一度に大量 rival を追加しない
* v1 では 1人に対して追加 rival は少数に抑える

---

## 32. 詳細パネル

PCでは右側、モバイルでは bottom sheet に出す。

### 上段: 選択配信者の詳細

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

### 下段: 現在の battle 詳細

* rival name
* current gap
* smallest gap today
* last reversal time
* pair reversal count
* strongest pressure window
* heat overlap window

### ミニ補助

* 選択者単独の viewers mini chart
* agitation strip
* rival comparison short list

### アクション

* Highlight only
* Add rival
* Open stream
* Jump to Day Flow
* Back to recommended

---

## 33. Highlight only

詳細パネル内の **Highlight only** は残す。

### 挙動

* 選択配信者とその rival 以外を強く dim する
* battle の読みを優先する
* 解除可能にする

### 役割

* 線が多い時に主役 battle を読みやすくする
* Top 5 の中でも pair を見失わないようにする

---

## 34. ラベル表示

Battle Lines は線が主役なので、ラベルは制御する。

### 常時表示

* 右端付近に Top 3〜5 の線名ラベル
* 選択線は固定ラベル
* primary battle pair は必ず残す
* 非選択線は必要最小限

### hover / tap 時

* 時刻
* viewers
* indexed value
* agitation level
* momentum
* current rank among visible lines
* pair gap
* battle status

### 現在時刻

当日表示では現在時刻の縦線を出す。

---

## 35. チャートの強調ルール

### 初回表示

* primary battle pair を最強調
* secondary に関係しない線はやや抑制
* visible 全消しはしない

### custom state

* ユーザー選択配信者とその rival を最強調
* 他線は dim

### Top mode

* 全体比較寄りに戻す
* ただし Top 3〜5 の識別は維持

---

## 36. モバイル挙動

モバイルでは比較対象をさらに絞る。

### 残すもの

* Top 3 / 5
* Viewers / Indexed
* 1m / 5m / 10m
* Recommended primary battle
* secondary battle 候補 2件程度
* Focus strip
* chart タップ詳細
* Reversal strip
* bottom sheet 詳細
* Back to recommended

### 削るもの

* Top 10
* 過密ラベル
* 過度な summary 件数
* hover 前提 UI
* 大量候補一覧

### 原則

* タップだけで主機能が使えること
* 横スクロールを主導線にしない
* 候補 battle は少数に絞る
* custom state と recommended state の切替が分かりやすいこと

---

## 37. 状態設計

Battle Lines は以下の状態を持つ。

### loading

* 骨組み表示
* Loading battle lines...

### live today

* 今日の途中データを表示
* 現在時刻以降は空白
* primary / secondary battle が live 更新されうる

### partial

* データ欠損あり
* 黄色 note 表示
* 欠損区間はギャップまたは薄表示

### complete

* 過去日で全日分あり
* 通常表示

### empty

* 該当日の有効データなし
* date reset を促す

### error

* 赤 note
* retry
* demo mode 切替可能

### demo

* デモデータ表示
* 本番と明確に区別

---

## 38. recommended state と custom state

改訂版では、live/partial などの共通状態とは別に、
**表示主導権の状態**として次を持つ。

### recommended state

* primary battle が主役
* secondary battles が候補として見える
* システム自動選定中

### custom state

* ユーザーが選んだ配信者 or battle が主役
* primary battle は候補欄に退く
* 画面主役は自動で奪わない

この状態は UI 上で分かるようにする。

---

## 39. Auto update と Refresh

### Auto update On

* Today では 1分ごと更新
* battle score も更新
* recommended candidates も更新
* ただし custom state 中は主役差し替えをしない

### Auto update Off

* 表示中の状態を固定
* 手動 Refresh まで変えない

### Refresh

* 手動再取得
* recommended / custom の現在状態は保持してよい

---

## 40. API と payload

Battle Lines の API は raw 全量を返さず、
**ページ単位で必要最小限の整形済みデータ**だけ返す方針を守る。

### 必須返却

* 可視対象配信者の系列
* viewers / indexed 用値
* summary
* focus 用補助

### 改訂版で追加する返却

* primaryBattle
* secondaryBattles
* latestReversal
* fastestChallenger
* pairScoreMeta
* currentGapTrend
* heatOverlapFlags
* recommendedStateMeta

### 返さないもの

* 全配信者全 pair の全履歴
* 重い全文ログ
* コメント本文解析結果
* 別ページ用の全データ

---

## 41. データ更新とキャッシュ

Battle Lines は、Workers Cron による 1分収集、D1 保存、1m / 5m / 10m 整形、KV の latest payload という全体構成に従う。

### Today

* latest payload を KV に保持
* その中に recommended battles も含めてよい

### 過去日

* D1 由来の固定整形データを読む
* ページ表示ごとの重い再集計は禁止

---

## 42. Low Load Mode

Low Load Mode では以下を優先的に削る。

### 削る順

1. glow 弱化
2. heat pulse 停止
3. 非主役線ラベル削減
4. reversal strip 件数削減
5. secondary battle 候補数削減
6. 1m 停止
7. Top 5 → Top 3
8. battle feed 更新頻度低下

### それでも残すもの

* 主役 battle
* current gap
* latest reversal
* Back to recommended
* 最低限の custom 操作

### 原則

Low Load でも「今どの battle を見ているか」が分からなくなってはいけない。

---

## 43. Animation Off

Animation Off では、

* 震え停止
* 発光弱化
* 補間簡略化
* pulse 停止

を適用する。

ただし、

* 主役 battle
* markers
* reversal strip
* recommended / custom 切替
* detail panel

は残す。

---

## 44. Battle Lines がやらないこと

V1 / v2.1 の Battle Lines では以下をやらない。

* Share 比較
* コメント本文解析
* クロスサイト比較
* 長期アーカイブの主画面化
* ログイン保存
* AI要約
* 無制限の比較表
* 大量候補を初期表示すること
* おすすめ固定だけでユーザー操作を殺すこと

---

## 45. 画面としての完成条件

### 必須

* 初見で「いまの対戦を見るページ」に見える
* primary battle が最初から見える
* secondary battle 候補が 2〜3件見える
* 逆転が読める
* 急伸が読める
* heat が battle 文脈の補助になっている
* ユーザーが custom 選択へ移れる
* custom 中に主役 battle を勝手に奪わない
* モバイルで主操作が完結する
* Low Load でも battle の主語が消えない
* Top 5 以内で安定動作する

### 不合格

* ただの比較ページにしか見えない
* 初見で何を見ればいいか分からない
* おすすめが1件固定で、他を掘れない
* custom 選択後に主役を勝手に奪う
* 候補が多すぎて一覧地獄になる
* reverse/heat 演出で線が読めない
* モバイルで操作不能
* 安定動作を壊す

---

## 46. 一言でまとめると

**Battle Lines は残す。**
**ただし compare tool のままではなく、
おすすめ battle とカスタム探索が両立した Rivalry Radar として成立させる。**