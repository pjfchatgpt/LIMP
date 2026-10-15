# LIMS — Laboratory Information Management System

A small but complete LIMS for a contract/agrochemical testing laboratory, running
entirely on Cloudflare: **Cloudflare Pages** for the application and **Cloudflare D1**
(serverless SQLite) for storage. There is no external database and no server to
operate.

It implements the laboratory's four-step workflow:

| Step | Screen | What happens |
|------|--------|--------------|
| 1. Goods inward | `/receiving` | Register a consignment from a supplier. The system mints an internal sample ID and stores the sample as `RECEIVED`. |
| 2. Testing & result entry | `/samples` → `/samples/{id}/results` | Pick up pending samples, record results per test parameter, and get an immediate PASS/FAIL assessment against the specification. |
| 3. Review & approval | `/samples/{id}/review` | QA / lab manager sees recorded results next to the specification and can Approve, Reject, or request a Retest. |
| 4. Certificate of analysis | `/samples/{id}/coa` | Printable certificate with sample details, verified results, specifications and the approval signature with its timestamp. Also exports to a spreadsheet file. |

## Stack

- **Framework**: [SvelteKit](https://svelte.dev/docs/kit) 3 with
  [`@sveltejs/adapter-cloudflare`](https://svelte.dev/docs/kit/adapter-cloudflare) 8.
  The adapter emits the Pages `_worker.js` bundle.
- **Runtime**: Cloudflare Pages Functions (Workers runtime).
- **Database**: Cloudflare D1, accessed through [Drizzle ORM](https://orm.drizzle.team/)
  (`drizzle-orm/d1`). D1's own migration runner applies the SQL in `migrations/`.
- **Bindings**: the `DB` binding is read from the `cloudflare:workers` module, which
  works identically in `vite dev` (through the adapter's platform proxy) and in
  production.
- **Validation / tests**: `svelte-check` for types and `vitest` for the
  specification engine.

## Repository layout

```
lims-app/
├── migrations/
│   ├── 0001_init.sql          # D1 schema: the source of truth for the database
│   └── 0002_seed.sql          # master data: parameters, materials, specifications
├── seeds/
│   └── demo_samples.sql       # optional demo samples (not applied automatically)
├── scripts/
│   └── smoke.mjs              # end-to-end HTTP test of all four flows
├── src/
│   ├── app.css                # application styles, including the print stylesheet
│   ├── app.html
│   ├── lib/
│   │   ├── spec.ts            # specification engine (PASS/FAIL rules) + unit tests
│   │   ├── types.ts           # shapes shared by the server layer and the UI
│   │   ├── format.ts          # display helpers (dates, numbers, labels)
│   │   ├── components/
│   │   │   └── CoaDocument.svelte
│   │   └── server/
│   │       ├── db/
│   │       │   ├── schema.ts  # Drizzle schema mirroring 0001_init.sql
│   │       │   └── index.ts   # D1 connection helper
│   │       └── lims.ts        # all reads/writes for the four flows
│   └── routes/
│       ├── +page.svelte                 # dashboard
│       ├── receiving/                   # 1. goods inward
│       ├── samples/                     # sample list
│       └── samples/[id]/
│           ├── +page.svelte             # sample detail + audit trail
│           ├── results/                 # 2. result entry (live PASS/FAIL)
│           ├── review/                  # 3. review & decision
│           └── coa/                     # 4. certificate (+ /print, /export)
├── package.json
├── tsconfig.json
├── vite.config.ts             # SvelteKit 3 keeps its config here
└── wrangler.toml              # Pages project + D1 binding
```

## Local development

**Prerequisites**: Node.js 20+ (developed on Node 24) and npm. Wrangler ships with the
project, so no global install is needed.

```bash
cd lims-app
npm install

# 1. Apply the schema and seed master data to a local D1 database
npm run db:migrate:local

# 2. (optional) load three demo samples that exercise the whole workflow
npm run db:demo:local

# 3. Start the dev server
npm run dev            # http://localhost:5173
```

`npm run dev` runs Vite with the Cloudflare adapter's platform proxy, so the app talks to
the **local** D1 database in `.wrangler/state` — the same database the migration commands
write to. Hot module reloading works normally.

To run the built Worker exactly as Cloudflare serves it:

```bash
npm run build
npm run dev:cf         # wrangler pages dev .svelte-kit/cloudflare
```

### Verifying a checkout

```bash
npm run check          # svelte-check: types across routes and components
npm test               # vitest: 32 unit tests for the specification engine
npm run build          # production build for the Cloudflare adapter

# then, with the app running on http://127.0.0.1:5173 (npm run dev):
npm run test:smoke
```

`scripts/smoke.mjs` exercises the real HTTP routes — it registers a sample, enters
results, approves it, fetches the COA, and checks the review guard rails. Run it against a
**local** dev server, since it writes to the database it points at. Point it elsewhere with
`node scripts/smoke.mjs https://your-preview-url`.

This checkout was verified with: `svelte-check` 0 errors and 0 warnings, 32/32 unit tests
passing, and 54/54 smoke checks passing against `wrangler pages dev` with a local D1.

### Resetting local data

```bash
rm -rf .wrangler/state          # or: Remove-Item -Recurse .wrangler/state (PowerShell)
npm run db:migrate:local
npm run db:demo:local
```

### Available scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server with the local D1 binding |
| `npm run dev:cf` | Serve the built output with `wrangler pages dev` |
| `npm run dev:watch` | Rebuild on change (pair with `dev:cf` in a second terminal) |
| `npm run build` | Production build into `.svelte-kit/cloudflare` |
| `npm run check` | Type check with `svelte-check` |
| `npm test` | Unit tests for `src/lib/spec.ts` |
| `npm run test:smoke` | End-to-end HTTP test of the four flows |
| `npm run db:migrate:local` / `:remote` | Apply D1 migrations locally / to the deployed database |
| `npm run db:migrations:list` | Show which migrations have been applied locally |
| `npm run db:demo:local` | Load the optional demo samples |
| `npm run db:tables:local` | List tables in the local database |
| `npm run deploy` | Build and deploy to Cloudflare Pages |

## Database schema

`migrations/0001_init.sql` is the authoritative definition; `src/lib/server/db/schema.ts`
mirrors it for typed queries. Keep both in step when you change either.

| Table | Purpose |
|-------|---------|
| `users` | Analysts, TM and lab managers, with their role (`CHEMIST`, `TM`, `LAB_MANAGER`, `SYSADMIN`). |
| `suppliers` | External suppliers. |
| `materials` | Material master: item code, name, category `RM` / `WIP` / `FG`, formulation, unit. |
| `test_parameters` | Test item master: code, name (EN/TH), unit, result type (numeric or text), default method and instrument. |
| `specifications` | The specification of one material: one row per parameter and per sub-row, with `spec_text`, numeric bounds and expected text. |
| `samples` | A received sample: internal sample ID, material, supplier, external lot, quantity, dates and status. |
| `test_results` | Recorded results, each carrying a **snapshot** of the specification it was judged against plus the evaluated verdict. |
| `approvals` | Every decision (approve / reject / retest) with the person, role, comment and UTC timestamp. |
| `audit_log` | Append-only trail of sample creation, result saves and decisions. |
| `counters` | Per-category running numbers used to mint internal sample IDs (`FG6900004`, …). |

Sample status moves `RECEIVED → IN_TESTING → PENDING_REVIEW → APPROVED | REJECTED | RETEST`.
Sub-rows are supported because real specifications carry them (sieve 1.1/1.2, emulsion
3.1 Cream / 3.2 Free oil): `spec_label` distinguishes them and they participate in the
unique keys.

### Specification engine

`src/lib/spec.ts` is pure and isomorphic — the browser uses it for the live PASS/FAIL
preview while the analyst types, and the server uses the **same** function as the
authority when the result is saved. One implementation means the preview and the stored
verdict cannot disagree.

It understands the shapes actually present in the master data:

| Shape | Example |
|-------|---------|
| range | `5.50 - 8.50`, `1.010-1.030`, `250 - 500 cPs` |
| maximum only | `ไม่เกิน 5`, `ไม่มากกว่า 2 %`, `<= 60 ml` |
| minimum only | `ไม่น้อยกว่า 98 %`, `>= 98` |
| expected text | `ละลายได้ดีในน้ำ`, `ของเหลว สีน้ำตาลแดง` |

Specifications may be stored as free text only; numeric bounds are derived from the text
when they are not given explicitly. Text comparison ignores case, repeated spaces and
trailing punctuation, and accepts a result that contains the expected value.

> Be aware: a single comma with no dot is read as a decimal separator (`1,013` → `1.013`),
> because laboratory values are decimals. Two or more commas, or a comma together with a
> dot, are treated as thousands separators.

## Deploying to Cloudflare Pages + D1

1. **Create the D1 database**

   ```bash
   npx wrangler d1 create lims
   ```

   Copy the `database_id` from the output into `wrangler.toml`, replacing the
   placeholder `00000000-0000-0000-0000-000000000000`.

2. **Apply the schema to the remote database**

   ```bash
   npm run db:migrate:remote
   ```

3. **Deploy**

   ```bash
   npm run deploy
   ```

   Or connect the repository to Cloudflare Pages and let it build:
   - Build command: `npm run build`
   - Build output directory: `.svelte-kit/cloudflare`
   - Bind the D1 database to the variable name `DB` (Settings → Functions → D1 database
     bindings) for both production and preview.

4. **Verify** that the migration ran and the app can read it:

   ```bash
   npx wrangler d1 execute lims --remote --command "SELECT COUNT(*) FROM specifications"
   ```

`wrangler.toml` already sets `pages_build_output_dir`, which is what makes the SvelteKit
adapter build for Pages, and declares the `DB` binding with `migrations_dir = "migrations"`.

## Where the seed data comes from

The seed migration is not invented. The specifications are the real limits recorded in the
laboratory's handover package (`LIMS-Form-Data.xlsx`, sheet `04_Spec_Matrix`), which in
turn came from the master spec sheet and the eight issued certificates of analysis.

Two unresolved conflicts in the source documents are deliberately preserved in the seed
rather than silently resolved:

- **Butachlor free oil** — the spec sheet says "not more than 2 cc", COA LB69/233 says
  "not more than 1 ml". The spec-sheet value is seeded and the discrepancy is commented in
  `0002_seed.sql`.
- **Fipronil density at 20 °C** — the spec sheet says 1.030–1.070, COA LB69/126 says
  1.030–1.060.

Item codes prefixed `DEMO-` are placeholders: the source spec sheet does not define item
codes for these products. Replace them with the real 365 item codes before go-live.

## Not included (deliberate scope)

- **Authentication.** Who performed an action is chosen from the `users` table, which is a
  placeholder for a real identity provider. The approval routing (test by Chemist, verify by
  TM, approve by Lab Manager) is recorded but not enforced per role. Add Cloudflare Access
  or your IdP before exposing this to a network.
- **Signature capture.** The certificate prints the approver's name, role and timestamp
  from the recorded decision. Wet or electronic signatures are not captured.
- **Instrument integration.** Results are keyed in manually; the HPLC/GC raw-data files and
  instrument control charts from the handover package are not ingested.
- **Stability studies, reagent and instrument calibration records, stock control.**

## Development notes

- SvelteKit 3 keeps its configuration in `vite.config.ts` (there is no `svelte.config.js`)
  and the library alias is the `#lib` subpath import declared in `package.json`, not `$lib`.
- D1 rejects long `UNION ALL` chains ("too many terms in compound SELECT") and
  `CREATE TEMP TABLE`, so seed scripts use `CASE`-driven `INSERT ... SELECT` instead.
- SvelteKit rejects cross-origin form posts. Any HTTP client driving the forms must send an
  `Origin` header and `Accept: text/html` (see `scripts/smoke.mjs`).
