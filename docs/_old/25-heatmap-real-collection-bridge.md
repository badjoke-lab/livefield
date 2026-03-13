# Heatmap 実収集接続前整理

## 目的
Heatmap のフロント実装は、いったん以下の状態まで到達している。

- ダミーpayload読込
- Canvas描画
- 複数ノード描画
- agitation / momentum の見た目反映
- DOM選択 + canvas選択
- Low Load / Animation ON-OFF
- loading / ready / error / demo の状態表現

この段階で、TwitCasting 実収集をつなぐ前に
「何を最低限集めれば Heatmap が成立するか」を固定する。

---

## フロントが要求する payload 契約
フロントは `packages/shared/src/types/heatmap.ts` の `HeatmapPayload` を読む。

最低限必要な構造は以下。

### payload
- ok
- source
- tool
- updatedAt
- summary
- nodes[]

### summary
- activeStreams
- totalViewers
- highestAgitationName
- strongestMomentumName

### node
- streamerId
- name
- title
- url
- viewers
- commentCount
- deltaComments
- commentsPerMin
- agitationRaw
- agitationLevel
- momentum
- rankViewers
- rankAgitation
- rankMomentum
- startedAt
- updatedAt

---

## 実収集の最小要件
Heatmap を「まず接続する」ための最小要件は以下。

### 必須
- streamerId
- name
- title
- url
- viewers
- startedAt
- updatedAt

### できれば初回から必要
- deltaComments
- commentsPerMin

### 初回は暫定でも許容
- commentCount
- agitationRaw
- agitationLevel
- momentum
- rankViewers
- rankAgitation
- rankMomentum

理由:
- viewers と identity があれば、最低限「大きさ」の Heatmap は成立する
- comments 系が入ると agitation が成立する
- 前回差分が取れると momentum が成立する

---

## 接続フェーズの優先順位
### Phase 1
TwitCasting から以下を安定取得する
- 配信識別
- 配信タイトル
- URL
- 現在視聴者数
- 観測時刻

この段階では comments 系が欠けてもよい。
欠ける場合は以下で暫定運用する。

- deltaComments = 0
- commentsPerMin = 0
- agitationRaw = 0
- agitationLevel = 0

### Phase 2
コメント差分を取得し、agitation を有効化する。

### Phase 3
前回観測との差分を保持し、momentum を有効化する。

---

## agitation の暫定算出
コメント差分が取れるなら、初期版は以下でよい。

- commentsPerMin = deltaComments
- agitationRaw = deltaComments / max(viewers, 1)

### agitationLevel 初期閾値
- 0: < 0.015
- 1: < 0.020
- 2: < 0.028
- 3: < 0.038
- 4: < 0.050
- 5: >= 0.050

この閾値は実データを見て後で調整する前提。

---

## momentum の暫定算出
前回観測がある場合、初期版は以下でよい。

- momentum = (currentViewers - previousViewers) / max(previousViewers, 1)

### 表示上の初期解釈
- >= 0.15: 強い上昇
- >= 0.08: 上昇寄り
- >= 0.03: 微増
- >= 0.00: 横ばい
- < 0.00: 減速寄り

---

## mode 判定
フロントでは以下の状態を使う。

- demo: source = demo
- stale: source != demo かつ updatedAt が5分超
- live: source != demo かつ stale でない
- error: fetch失敗
- loading: 初期待機中

---

## 実収集接続時の注意
### 1. いきなり comments まで完璧を目指さない
最初は viewers 中心でつなぎ、Heatmap 全体を壊さない方が優先。

### 2. source を demo のままにしない
実収集に入ったら source は `api` に切り替える。

### 3. updatedAt を必ず入れる
stale 判定に必要。

### 4. 空配列時の扱いを決める
nodes = [] の場合は、ready/empty 表示を後で追加する余地あり。

---

## 次タスク
### Task 9B
collector 側に「HeatmapPayload を組み立てる純関数」を作る。

### Task 9C
TwitCasting 側の取得結果を、その純関数へ流し込む最小接続を作る。

### Task 9D
demo source から api source へ切り替える。
