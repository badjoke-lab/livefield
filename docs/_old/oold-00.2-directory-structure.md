完成形はこれです。
**1リポ・2サイト・shared共通・collector分離**で固定します。理由は、今の仕様が **Twitch-only MVP を先に完成**させつつ、将来の Kick 追加は同じ考え方を踏襲するとしており、しかも全体構成が **Shell / Renderer / API / Collector-Storage の分離**を前提にしているからです。  

```text
livefield/
├─ README.md
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ .gitignore
├─ .editorconfig
├─ .github/
│  └─ workflows/
│     ├─ ci.yml
│     ├─ deploy-pages-twitch.yml
│     ├─ deploy-pages-kick.yml
│     ├─ deploy-worker-twitch.yml
│     └─ deploy-worker-kick.yml
│
├─ apps/
│  ├─ web-twitch/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ vite.config.ts
│  │  ├─ wrangler.toml
│  │  ├─ index.html
│  │  ├─ public/
│  │  │  ├─ favicon.ico
│  │  │  ├─ robots.txt
│  │  │  └─ og/
│  │  ├─ functions/
│  │  │  └─ api/
│  │  │     ├─ heatmap.ts
│  │  │     ├─ day-flow.ts
│  │  │     ├─ battle-lines.ts
│  │  │     └─ status.ts
│  │  ├─ src/
│  │  │  ├─ shell/
│  │  │  ├─ pages/
│  │  │  │  ├─ home/
│  │  │  │  ├─ heatmap/
│  │  │  │  ├─ day-flow/
│  │  │  │  ├─ battle-lines/
│  │  │  │  ├─ method/
│  │  │  │  ├─ about/
│  │  │  │  └─ status/
│  │  │  ├─ renderers/
│  │  │  │  ├─ heatmap/
│  │  │  │  ├─ day-flow/
│  │  │  │  └─ battle-lines/
│  │  │  ├─ components/
│  │  │  ├─ state/
│  │  │  ├─ services/
│  │  │  └─ styles/
│  │  └─ tests/
│  │     ├─ smoke/
│  │     └─ unit/
│  │
│  └─ web-kick/
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ vite.config.ts
│     ├─ wrangler.toml
│     ├─ index.html
│     ├─ public/
│     │  ├─ favicon.ico
│     │  ├─ robots.txt
│     │  └─ og/
│     ├─ functions/
│     │  └─ api/
│     │     ├─ heatmap.ts
│     │     ├─ day-flow.ts
│     │     ├─ battle-lines.ts
│     │     └─ status.ts
│     ├─ src/
│     │  ├─ shell/
│     │  ├─ pages/
│     │  │  ├─ home/
│     │  │  ├─ heatmap/
│     │  │  ├─ day-flow/
│     │  │  ├─ battle-lines/
│     │  │  ├─ method/
│     │  │  ├─ about/
│     │  │  └─ status/
│     │  ├─ renderers/
│     │  │  ├─ heatmap/
│     │  │  ├─ day-flow/
│     │  │  └─ battle-lines/
│     │  ├─ components/
│     │  ├─ state/
│     │  ├─ services/
│     │  └─ styles/
│     └─ tests/
│        ├─ smoke/
│        └─ unit/
│
├─ workers/
│  ├─ collector-twitch/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  ├─ wrangler.toml
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ config/
│  │     ├─ providers/
│  │     │  └─ twitch/
│  │     ├─ jobs/
│  │     ├─ pipelines/
│  │     ├─ repositories/
│  │     ├─ cache/
│  │     └─ lib/
│  │
│  └─ collector-kick/
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ wrangler.toml
│     └─ src/
│        ├─ index.ts
│        ├─ config/
│        ├─ providers/
│        │  └─ kick/
│        ├─ jobs/
│        ├─ pipelines/
│        ├─ repositories/
│        ├─ cache/
│        └─ lib/
│
├─ packages/
│  ├─ shared/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ src/
│  │     ├─ constants/
│  │     ├─ schemas/
│  │     ├─ time/
│  │     ├─ math/
│  │     ├─ utils/
│  │     ├─ types/
│  │     │  ├─ common/
│  │     │  ├─ heatmap.ts
│  │     │  ├─ day-flow.ts
│  │     │  ├─ battle-lines.ts
│  │     │  └─ status.ts
│  │     ├─ scoring/
│  │     │  ├─ momentum/
│  │     │  ├─ activity/
│  │     │  └─ battle/
│  │     ├─ normalize/
│  │     ├─ payloads/
│  │     └─ platform/
│  │        ├─ twitch.ts
│  │        └─ kick.ts
│  │
│  └─ config/
│     ├─ env/
│     ├─ limits/
│     └─ copy/
│
├─ db/
│  ├─ shared/
│  │  ├─ migrations/
│  │  └─ views/
│  ├─ twitch/
│  │  ├─ migrations/
│  │  └─ seeds/
│  └─ kick/
│     ├─ migrations/
│     └─ seeds/
│
├─ fixtures/
│  ├─ demo/
│  │  ├─ twitch/
│  │  └─ kick/
│  └─ screenshots/
│
├─ tests/
│  ├─ shared/
│  ├─ integration/
│  │  ├─ twitch/
│  │  └─ kick/
│  └─ smoke/
│     ├─ twitch/
│     └─ kick/
│
├─ scripts/
│  ├─ dev-web-twitch.mjs
│  ├─ dev-web-kick.mjs
│  ├─ dev-worker-twitch.mjs
│  ├─ dev-worker-kick.mjs
│  ├─ build-demo-data.mjs
│  ├─ check-payloads.mjs
│  ├─ import-demo-sql.mjs
│  ├─ release-check.mjs
│  ├─ sync-specs.mjs
│  └─ clean-artifacts.mjs
│
├─ docs/
│  ├─ common/
│  │  ├─ architecture.md
│  │  ├─ ui-rules.md
│  │  ├─ low-load-mode.md
│  │  └─ api-contracts.md
│  ├─ twitch/
│  │  ├─ 00-common-spec.md
│  │  ├─ 00.1-whole-spec.md
│  │  ├─ 01-heatmap-spec.md
│  │  ├─ 02-dayflow-spec.md
│  │  └─ 03-battle-lines-spec.md
│  ├─ kick/
│  │  ├─ 00-common-spec.md
│  │  ├─ 00.1-whole-spec.md
│  │  ├─ 01-heatmap-spec.md
│  │  ├─ 02-dayflow-spec.md
│  │  └─ 03-battle-lines-spec.md
│  └─ old/
│
└─ specs/
   ├─ twitch/
   └─ kick/
```

この完成形での考え方は単純です。

`apps/web-twitch` と `apps/web-kick` は、どちらも **`/ /heatmap /day-flow /battle-lines /method /about /status` の7ページだけ**を持つ公開単位です。現仕様では正式公開範囲はこの7ページで、クロスサイト対応は後回しなので、**1つの site の中で Twitch と Kick を混在させない**のが正しいです。

`workers/collector-twitch` と `workers/collector-kick` は完全に分けます。
理由は、全体構成が **Collector / Storage 層を描画や Shell と分離**する前提で、しかも **collector の失敗を隠蔽しないこと**が必須だからです。1本の worker に `if (platform===...)` を増やすと、障害時の切り分けが悪くなります。 

`packages/shared` はかなり厚くしてよいです。
Heatmap の `momentum`、provider-independent な `activity`、Day Flow の `viewer-minutes`、Battle Lines の `pairScore` 系は **shared 定数・shared scoring・shared payload** に寄せるべきです。仕様でも activity は provider 実装差を許しつつ、UI と内部指標は共通化する前提です。  

`db` は **repo共通スキーマとプラットフォーム別保存**を併用します。
1つの D1 に全部混ぜてもよいですが、運用上は **Twitch用D1** と **Kick用D1** を分ける前提で、migration は分けておく方が安全です。共通仕様でも無料運営前提・取得不足時は `partial` 明示が必要なので、片方の collector 問題で両方を汚さない構造が向いています。 

`tests` は **shared / twitch / kick** の3層に分けます。
特に Battle Lines は recommended/custom 状態や latest payload の扱いが重いので、shared unit と platform integration を分けた方が壊れにくいです。

この完成形で、今すぐやるべきリネームはこれです。

```text
apps/web                -> apps/web-twitch
workers/collector       -> workers/collector-twitch
docs/*.md               -> docs/twitch/*.md
specs/*.md              -> specs/twitch/*.md
db/migrations           -> db/twitch/migrations
db/seeds                -> db/twitch/seeds
fixtures/demo/*.json    -> fixtures/demo/twitch/*.json
```

その上で **空の `web-kick` / `collector-kick` / `docs/kick` / `specs/kick`** を追加する、という順です。
この順なら、いまの **Twitch-only MVP の一貫性** を壊さずに、将来の Kick 拡張原則にも乗れます。 

次は **この完成形に合わせた「最初のPRでやる rename と移動だけ」のタスク文**を出します。
