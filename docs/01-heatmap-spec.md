# Twitch Livefield / Heatmap 仕様確定 v2.1 Treemap 版

## 1. この機能の役割

Heatmap は、**今この瞬間の Twitch ライブ空間の勢力図**を見る機能とする。

この画面で分かることは、v2.1 でも以下の3点に固定する。

* **Who is big now**
  = 現在視聴者数が大きい配信
* **Who feels active now**
  = 短時間の活動信号が相対的に強い配信
* **Who is rising now**
  = 直近数分で視聴者数が伸びている配信

Heatmap は比較表ではない。
**ライブ空間の瞬間的な熱分布を、直感で掴む画面**とする。
サイト全体の役割分担上、Heatmap は **Now** を担い、Day Flow の「Today」、Battle Lines の「Compare」を食ってはならない。

v1 では bubble field を採用していたが、v2.1 では **treemap renderer** を正式採用する。
ただし役割自体は変えない。
Heatmap は引き続き、**「いま大きい」「いま伸びている」「いまざわついている」** を一目で読む画面である。

v2.1 では、画面全体を高密度に埋める **dense treemap packing** を MVP 段階から必須要件とする。
単なる「タイルっぽい矩形一覧」ではなく、**全体像を一瞬で読むための本物の treemap heat field** として成立させる。

この仕様書における用語は以下で固定する。

* **Heatmap** = ページ全体の機能名
* **Treemap** = 採用する可視化方式名
* **Tile** = treemap を構成する個々の矩形要素

したがって、v2.1 では **Heatmap page uses a treemap renderer, and each live stream is rendered as a tile** という定義で統一する。

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

タイルは配信の詳細カードではなく、**Now view における視覚単位**である。
そのため、常時表示する情報量はタイル面積に応じて制限してよいが、タイル自体の意味は常に **1 live session = 1 tile** で固定する。

---

## 3. 取得・更新周期

v2.1 でも **1分ごと更新** で固定する。

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

### 3.3 更新時の見せ方

* 最新 snapshot 到着時に treemap を更新する
* 毎秒全面再描画は不要
* 1分ごとの更新タイミングに合わせて、位置・色・activity 演出が更新される
* 更新が来ない間に、意味のない常時レイアウト再計算を行ってはならない

### 3.4 Auto refresh の原則

* Auto refresh OFF の場合も、最後の正常 snapshot は維持する
* stale 化したときは、見た目の状態と note で明示する
* Refresh ボタンは、Auto refresh の有無に関係なく明示的に即時取得を試行できること

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

### 4.4 表示対象と treemap の関係

* Top N で切った集合を、その時点の treemap 対象集合とする
* treemap はこの集合を**密に敷き詰めて表示する**こと
* 大きい配信を見やすくするために、対象集合の外の配信を疑似的に混ぜることは禁止する
* viewers の分布に忠実であることを優先する

---

## 5. Heatmap の見た目ルール

Heatmap の中心は **treemap レイアウト** に固定する。
1タイルの見た目は以下で決める。

### 5.1 タイルの面積

**面積 = 現在視聴者数**

ただし線形ではなく、極端な巨大化を抑える補正を使ってよい。
目的は以下である。

* 大手だけが画面を食いすぎない
* 中規模が比較可能である
* 小規模も完全には消えない

実装では treemap の weight として viewers を使い、必要なら平方根や対数圧縮を挟んでよい。
ただし、**本質的に viewers に比例した面積差** が読めることを壊してはならない。

### 5.2 タイルの基本色

**基本色 = momentum の方向** とする。

* 上昇: 緑系
* 下降: 赤系
* 横ばい: 青灰系

これは bubble 版の「1系統の濃淡」から変更する。
v2.1 treemap 版では、**今伸びているか / 落ちているか / ほぼ横ばいか** を一目で読めることを優先する。

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

### 5.5 Dense treemap packing

v2.1 では、**画面全体を高密度に埋めること自体を MVP 必須要件**とする。
以下を満たすこと。

* 余白を最小限に抑える
* 極端な横長・縦長の帯を減らす
* 大きい配信は素直に大きい矩形になる
* 小さい配信は自然に端へ圧縮される
* 画面全体を俯瞰したとき、全体像が一目で読める

単なる手組み row packing や strip 状の並べ方は不適切とする。
**本物の treemap packing** を用いること。

### 5.6 採用アルゴリズム

採用アルゴリズムは以下の優先順とする。

1. **Squarified treemap**
2. **Binary treemap**（結果が十分に読みやすい場合のみ許容）

以下は不採用とする。

* 単純な横並びストリップ詰め
* 「タイル風に見えるだけ」の手動配置
* 無駄な余白を大量に生むレイアウト

---

## 6. Activity signal の定義

TwitCasting 版では「コメント速度」を使っていたが、Twitch-only MVP では **sampled short-lived chat session による activity signal** を採用する。

### 6.1 基本方針

Heatmap で扱う activity は、**短時間での活発さを表す補助指標** とする。
ただし v2.1 でも、**views でも momentum でもない第3の補助信号**として使うにとどめる。

### 6.2 v2.1 の設計原則

* activity は **MVP から必須の補助信号** とする
* viewers と momentum が Heatmap の主役
* activity は取得できる範囲で補助的に使う
* 取得不能なら隠さず縮退表示する
* sampled であることを隠さない
* activityAvailable のときだけ、視覚的な「ざわつき表現」を許可する

### 6.3 v2.1 の activity_raw

v2.1 では、短時間の Twitch chat sampling に基づく以下を使う。

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
* activity 表現は viewers 面積や momentum 色を上書きしてはならない

### 6.6 treemap における activity の役割

v2.1 treemap 版では、コメント由来の「ざわつき」は以下の役割で扱う。

* 面積では表現しない
* base color では表現しない
* 微発光・微パルス・弱い振動・小さなバッジ等の**二次演出**で表現する

これにより、

* いま大きい配信
* いま伸びている配信
* いまざわついている配信

を同一画面で読み分けられるようにする。

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

固定閾値でも相対分布でもよいが、v2.1 では **sampled chat が sparse でも Lv0 ばかりにならない** ことを優先する。

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

段階の切り方自体は v2.1 仮採用とする。
raw を残し、観測後に再調整可能とする。
この「6段階」という骨格は v1 を維持する。

### 7.4 視覚表現への結び付け

各段階は少なくとも以下に対応してよい。

* Lv0: 静止、activity 演出なし
* Lv1〜2: ごく弱い発光または小さな pulse
* Lv3〜4: 認識可能な pulse または控えめな glow
* Lv5: 明確な glow と弱い振動

ただし、どの段階でも **激しい点滅** や **主色を activity 色に置き換える演出** は禁止する。

---

## 8. レイアウト配置

配置は bubble のような自由移動ではなく、**安定した面積占有レイアウト**にする。

### 8.1 配置原則

* viewers 上位ほど大きな面積を占める
* 毎更新で全体の読み順が大崩れしない
* 同一セッションは可能な限り近い場所に残る
* 更新のたびに全面シャッフルしない

### 8.2 v2.1 配置方式

v2.1 は **treemap** を正式採用する。
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

### 8.5 位置安定性

* 毎回全領域を再シャッフルする見え方は禁止する
* viewers の変化で面積が変わっても、ユーザーが追跡できる程度の位置安定性を持たせる
* ただし、レイアウト品質を著しく落としてまで位置固定を優先しない
* 「密度」「比較のしやすさ」「追跡しやすさ」のバランスを取る

### 8.6 Dense field の優先

v2.1 では、視線が一瞬で全体像を掴めることを優先する。
したがって、

* 過剰な tile 間ギャップ
* 意味のない外周余白
* 中央付近の空洞
* 帯状レイアウトの乱発

は不採用とする。

---

## 9. アニメーション規則

Heatmap は動きが重要だが、うるさくしない。

### 9.1 許可する動き

* activity level に応じた微パルス
* activity level に応じた微発光
* 高 activity 時だけの弱い振動
* 更新時の位置補間
* hover / tap 時の軽い拡大
* zoom 時の滑らかな拡大縮小補間

### 9.2 禁止する動き

* 常時激しい点滅
* 常時激しい振動
* 毎回の全面再レイアウト
* 粒子の大量散布
* 背景の常時流体演出
* ノード数増加時に破綻するアニメーション乱発
* unavailable を active に見せるアニメーション

### 9.3 Toggle

ユーザーは以下を切り替え可能とする。

* Animation On
* Animation Off
* Low Load Mode

### 9.4 Off 時

* パルス停止
* 発光弱化
* 位置補間だけ残す
* zoom そのものは利用可能でよいが、装飾アニメは抑制する

### 9.5 原則

* activityAvailable = true のときだけ activity アニメを許可する
* unavailable タイルは原則静止
* sampled but unavailable は 0 activity のように動かしてはならない
* activity 演出は viewers 面積や momentum 色を食ってはならない

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
* Zoom in / Zoom out / Reset zoom

### 10.3 Main

* Heatmap treemap field

### 10.4 Secondary

* Legend
* Summary metrics
* Detail panel

### 10.5 補足

比較用の bubble / tile 並列表示は v2.1 本番では採用しない。
本番 Heatmap は treemap 単独表示とする。
比較用 UI は lab / hidden route に退避してよい。

### 10.6 Zoom の位置づけ

zoom は「後であれば便利」ではなく、**早期導入対象**とする。
理由は以下。

* viewers 比例で素直に面積を割り当てるため
* 小さい配信を無理に見やすくする補正を抑えるため
* 小タイルが多いときでも、ズームすれば情報閲覧を継続できるため

したがって、v2.1 では zoom を正式要件に含める。

### 10.7 Grouping の位置づけ

grouping は将来必要な機能だが、v2.1 本番の初期状態では **no_group** を基本とする。
ただし、内部設計は grouping 導入前提で壊さないこと。

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
* タイル本体クリックは選択、リンクアイコンは外部遷移と役割を分ける

### 11.5 詳細の補完原則

全情報をタイル常時表示に押し込まず、

* タイルでは最小限
* hover / select / detail panel で詳細補完

という構成を維持する。
これにより、dense treemap の視認性を壊さない。

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

### 12.4 sampled coverage の扱い

summary 自体は簡潔に保つ。
sampled coverage や unavailable 状態の詳しい説明は、summary ではなく coverage note / legend 側で扱う。

---

## 13. ラベル表示

全タイルに常時フルラベルは出さない。

### 13.1 常時表示

* 大タイル: name + viewers
* 中タイル: name only、必要なら viewers
* 小タイル: hidden または省略表示

### 13.2 hover / tap 時

* full info
* selected tile emphasis
* other tiles dim

### 13.3 理由

Heatmap は密度が高いので、常時全文字表示は禁止する。
この方針は v1 を維持する。

### 13.4 treemap 向け補足

* ラベル密度は、タイル面積に応じて自動調整してよい
* 省略ラベルや短縮ラベルを許可する
* 小タイルが大量にある領域では、ズーム時にのみ詳細ラベルを増やしてよい
* ラベルのために面積や配置品質を壊してはならない

---

## 14. モバイル挙動

モバイルでは見せ方を簡略化する。

### 14.1 残すもの

* Top 20 / 50
* Activity window 1m / 3m
* Refresh
* Animation On/Off
* タイルタップ詳細
* Open stream
* Zoom

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
* 小タイルはズーム前提の閲覧を許容する

### 14.5 mobile treemap の原則

モバイルでは「全部のラベルを無理に読ませる」のではなく、

* 全体俯瞰
* タップ選択
* ズームして詳細閲覧

の流れを許容する。

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

### 15.4 treemap 固有の補足

レイアウト自体は保存必須ではない。
保存すべきは、**treemap を再計算できるための raw 指標**である。

* viewers 系
* momentum 系
* activity 系
* availability 系

があれば十分で、矩形座標を履歴保存の主対象にする必要はない。

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

### 16.8 activity state の明示

partial のときは特に、以下が分かるようにする。

* activity available
* sampled but no activity
* sampled but unavailable
* not sampled in this window

ただし、状態説明が主表示を圧迫しないよう、legend と note の責務を分ける。

---

## 17. Heatmap がやらないこと

v2.1 の Heatmap では以下をやらない。

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

### 17.1 将来追加候補だが v2.1 本番に含めないもの

* grouping UI 本実装
* fullscreen 専用モード
* save view
* shareable URL state
* 高度な filter matrix
* AI summary

これらは将来追加候補であり、v2.1 本番完成条件には含めない。

---

## 18. v2.1 完成条件

Heatmap の完成条件はこれで固定する。

### 18.1 必須

* 現在 live 中の Top N を表示できる
* viewers に応じてタイル面積が変わる
* 画面全体を高密度に埋める treemap packing になっている
* momentum が色で見える
* 上昇 / 下降 / 横ばい が一目で判別できる
* activity signal が使える時は level 反映される
* activity signal が使えない時は partial / unavailable が分かる
* sampled / unavailable / zero を区別できる
* 1分更新が滑らかに反映される
* タイル選択で詳細が見られる
* 各配信へ飛べる明示リンクがある
* stale / partial / empty / error / demo が分かる
* モバイルで最低限の操作ができる
* Top 100 でも崩れず、低負荷モードで生き残れる
* zoom により小タイルも閲覧可能である
* コメント由来のざわつき表現が、activityAvailable の範囲で MVP から見える

### 18.2 不可

* 更新のたびに配置が崩れる
* 画面に無意味な余白が多い
* strip 状の矩形が多発して面積比較しづらい
* 小規模配信が activity だけで主役化しすぎる
* viewers 主役が失われる
* activity unavailable を隠して通常値のように見せる
* sampled zero と unavailable を同一視する
* モバイルで操作不能
* 何を見ているか説明なしで分からない
* 背景タブ放置で描画が暴走する
* ズームなしだと小タイルが永続的に読めないのに、面積補正だけで誤魔化している

---

## 19. UI 文言の基準

Heatmap 画面で使う v2.1 英語文言は以下の思想で固定する。

* 難しい専門語を増やさない
* `Now` が伝わる短文にする
* official を装わない
* activity が unavailable の時は隠さず言う
* sampled であることを必要な範囲で明示する
* `treemap` を内部実装用語としては使ってよいが、ユーザー向け文言では必要以上に技術語化しない

例:

* `Live heat field of Twitch streams right now`
* `Updated every minute`
* `Activity uses sampled short-lived chat windows`
* `Showing top live streams by viewers`
* `Not sampled in this window`
* `Open stream`

文言の最終 wording 自体は copy pack で別定義してよいが、方向性はこの仕様に従う。

---

## 20. この機能の一言定義

**Heatmap is the “Now” view of Twitch Livefield: a production treemap that shows which live streams are biggest, rising, and actively reacting right now, with each stream rendered as a tile whose area follows viewers, color follows momentum, and activity is expressed only as a secondary signal.**

---

## 21. TradingView 系 treemap を参考にした今後の拡張方針

v2.1 の設計では、TradingView 系の treemap / heatmap が持つ「一目で全体を読む」特性を参考にする。
ただし、固有 UI の複製ではなく、**Livefield に必要な挙動を抽出して自前実装する**方針とする。

### 21.1 用語統一

* 本ページの正式な可視化方式名は **treemap**
* 各矩形要素は **tile**
* 「tile」は要素名として使用可だが、画面全体の方式名は treemap に統一する

### 21.2 Dense treemap packing

* Heatmap の本質は、画面全体を高密度に埋める treemap である
* MVP 段階でも、無駄な余白を減らし、極端な横長帯を避ける
* 面積比較が一目で伝わることを最優先とする
* 単純な行詰めではなく、squarified treemap 等の本物の treemap packing を採用する

### 21.3 Size と Color の明確な分離

* **面積 = viewers**
* **色 = momentum**
* area と color は別指標として扱う
* 他の補助指標が面積の意味を壊してはならない

### 21.4 Momentum 色ルール

* 上昇 = 緑
* 下降 = 赤
* 横ばい = 青灰
* 色の強さは momentum の強さに応じて変える
* 暗背景でも埋もれないコントラストを確保する

### 21.5 Activity は補助信号

* activity は主役ではなく補助
* size や base color を上書きしない
* 表現手段は小バッジ、発光、微パルス、微振動などに限定する
* 激しい点滅や大きな移動アニメーションは禁止する

### 21.6 Activity state の明確な区別

最低限、以下を見分けられること。

* observed and active
* sampled, no activity
* sampled, unavailable
* not sampled in this window

0 activity と unavailable を同一視しない。

### 21.7 Zoom を早期導入対象とする

* Heatmap は viewers 比例で素直に面積を割り当てる
* 小さい配信を無理に大きく見せない
* 代わりに zoom で詳細閲覧を可能にする
* zoom 時はラベル密度や詳細量を増やせるようにする
* 将来的には wheel / pinch / click-to-zoom / reset zoom / breadcrumb を検討する

### 21.8 Tooltip / Detail layering

* hover または select により詳細情報を表示する
* 常時すべての情報をタイル上に出さない
* 大タイルは名前 + viewers
* 中タイルは短縮ラベル
* 小タイルは最低限のラベルまたは省略
* 詳細は tooltip / selected details panel で補う

### 21.9 明示リンク導線

* 各タイルには外部リンク導線を持たせる
* タイル本体 = 選択
* 外部リンクアイコン = 配信へ遷移
* details panel にも `Open stream` を置く
* モバイルで誤タップしにくい設計にする

### 21.10 Fullscreen / focused reading

* Heatmap は全体俯瞰が重要なため、fullscreen または広い表示モードとの相性が良い
* 将来的に fullscreen button を検討対象とする
* Heatmap は「一覧ページ」ではなく「全体を一瞬で読む面」として扱う

### 21.11 Grouping 対応前提の設計

* 初期は `no_group` でよい
* ただし内部設計は将来の grouping に対応できるようにする
* 候補:
  * category / game
  * language
  * region
  * viewer tier
* grouping 導入後は group 単位で zoom / drill-down できる設計が望ましい

### 21.12 表示内容の切替

将来的に以下の切替を検討する。

* Top 10 / 20 / 50
* active-only / all
* viewers emphasis / momentum emphasis
* 1m / 5m / 10m activity
* grouping on/off

ただし、MVP では切替を増やしすぎず、主表示のわかりやすさを優先する。

### 21.13 Legend の強化

* 色の意味を簡潔に明示する
* 緑 / 赤 / 青灰の意味を固定する
* activity sampling state も legend で短く説明する
* 凡例は主表示を邪魔しないサイズに抑える

### 21.14 Production と Lab の分離

* 公開 `/heatmap` は production treemap のみ
* 比較用 renderer や旧 bubble 版は public 導線から外す
* 必要なら lab/internal route に退避する
