# HANDOFF — LIMS on Cloudflare Pages + D1

Read this before continuing work on the project. `README.md` covers how to run and
deploy; this file covers **where things stand, what is decided, what is still open,
and the machine-specific traps that cost time last cycle.**

*Last updated: 2026-10-15.*

---

## 1. Current state

| What | Where / value |
|------|---------------|
| Live application (production) | https://lims-8sr.pages.dev |
| Cloudflare Pages project | `lims` |
| D1 database | `lims`, id `edecc2f8-e656-4dad-b7dd-ed7a4dc399ee`, region APAC (id is also in `wrangler.toml`) |
| GitHub repository | https://github.com/pjfchatgpt/LIMP , branch `main` |
| Framework | SvelteKit 3 + `@sveltejs/adapter-cloudflare` 8, Drizzle ORM over D1 |
| Data in production | 6 materials, 39 specifications, 3 demo samples, 13 results (from `seeds/demo_samples.sql`) |
| Verified | `svelte-check` 0 errors/0 warnings · 32 unit tests · 54 end-to-end checks, run against the live site |

All four business flows work in production: goods inward → result entry with
automatic pass/fail → review (approve / reject / retest) → certificate of analysis
(print view + spreadsheet export).

## 2. Running and deploying (short version)

```bash
npm install
npm run db:migrate:local     # schema + seed master data into local D1
npm run db:demo:local        # optional demo samples
npm run dev                  # vite dev, uses the local D1 binding

npm run check                # svelte-check
npm test                     # vitest (specification engine)
npm run deploy               # build + deploy to Cloudflare Pages
```

Deploying needs an authenticated wrangler: `npx wrangler login` (OAuth, browser).
The session on the owner's machine was created 2026-10-15; re-run the login if it
expires or if you work from another machine.

## 3. Verification workflow — do this before every hand-off

1. `npm run check` — must report 0 errors, 0 warnings.
2. `npm test` — 32 tests for `src/lib/spec.ts`.
3. `npm run build` — must succeed through the Cloudflare adapter.
4. `node scripts/smoke.mjs http://127.0.0.1:8788` — 54 checks across all four flows.
   **It writes samples to whatever it points at.** Run it against a local server, or
   against production only if the extra `SMOKE-*` rows are acceptable.

Last cycle the suite initially passed *vacuously* (it asserted "no line failed"
instead of "every line passed") and that hid a real defect. Keep the assertions
positive; do not weaken them to make a run go green.

## 4. Next scope, in priority order

### 4.1 Authentication & user accounts — blocking for real use
- Anyone with the URL can currently enter and approve results.
- The `users` table already exists with roles `CHEMIST`, `TM`, `LAB_MANAGER`,
  `SYSADMIN`; the approval routing (test → verify → approve) is recorded but roles
  are **not enforced**.
- Work: put the app behind Cloudflare Access or an identity provider, read the
  verified identity in `hooks.server.ts` / the load functions, replace the two
  "select a person" dropdowns (analyst on the results form, decider on review) with
  the logged-in identity, and enforce role on the review action.
- Open decision (owner, not yet made): Cloudflare Access vs own IdP.

### 4.2 Full master data load — biggest data task
- Source of truth: `1. LIMs data  for IT.xlsx` (one level up), the derived package
  `../LIMS-Form-Data.xlsx` (sheets `02_Material_Master`, `03_Test_Item_Master`,
  `04_Spec_Matrix`), and the CSV bundle `../LIMS-import-csv.zip`.
- Scale: roughly 660 items (105 raw material, 98 work-in-process, 461 finished
  goods). Specification coverage in the source spreadsheets is under 3%.
- Replace every `DEMO-*` item code with the real 365 codes.
- **Three specification conflicts need a lab manager decision before load** — they
  change pass/fail outcomes (findings DQ-08/09/10 in `LIMS-Form-Data.xlsx`):
  - Cartap 4% GR: pH 3.00–5.00 (spec sheet) vs 3.00–6.00 (COA LB69/123)
  - Fipronil 5% SC: density@20 1.030–1.070 (sheet) vs 1.030–1.060 (COA LB69/126)
  - Butachlor 60+6% EC: free oil ≤2 cc (sheet) vs ≤1 ml (COA LB69/233)
- Import mechanics: D1 rejects long `UNION ALL` chains and `CREATE TEMP TABLE`;
  use one `CASE`-driven `INSERT ... SELECT` per material (see `seeds/demo_samples.sql`)
  or batched small statements.
- Deliver as a numbered migration (`0003_master_data.sql`) so remote and local stay
  in step, and keep `src/lib/server/db/schema.ts` in sync with any schema change.

### 4.3 Raw data & instrument integration
- HPLC/GC raw-data PDFs exist only as scans (no text layer) — 5 files, 7–10 pages
  each. Attachments need object storage: create an R2 bucket and bind it in
  `wrangler.toml`, then link files to `test_results` rows.
- Instrument output is typed in by hand today; real integration means reading the
  HPLC/GC export files. Scanned pages need OCR at ingestion if they must be searchable.
- The chromatogram PDFs were never transcribed (only the eight COA pages were).

### 4.4 COA branding, custom domain, backups
- The certificate letterhead in `src/lib/components/CoaDocument.svelte` is an
  explicit placeholder; replace with the controlled letterhead and logo.
- Custom domain: Pages dashboard → `lims` project → Custom domains.
- Backups: D1 supports point-in-time recovery (Time Travel); add a scheduled export
  if a file copy is required.

## 5. Open decisions (not engineering — someone must decide)

1. **The three specification conflicts above.** Until they are decided, the seeded
   limits follow the master spec sheet and say so in comments.
2. **COA form revision.** The Excel template footer says
   `FM-QP-LB-16-01-R1 (01/03/65)`, the issued Butachlor COA says `…-R4 (20/05/69)`,
   and the other seven COAs use `FM-QP-LB-16-07-R0`. Which revision is current?
3. **Is stock/inventory in scope?** Two inventory workbooks sit in the source folder
   but are not referenced by the LIMS data package.

## 6. Machine-specific traps (this workstation)

- **Windows' built-in `ssh.exe` is broken here** — it prints nothing, even `ssh -V`.
  Git must use the OpenSSH bundled with Git for Windows. This is already configured
  in the repo's local git config:
  `git config --local core.sshCommand "C:/PROGRA~1/Git/usr/bin/ssh.exe"`.
  **That setting lives in `.git/config` and is NOT committed** — after a fresh clone,
  re-run it. Quoting note: use the 8.3 short path; a quoted `"C:/Program Files/…"`
  value breaks because git splits on the space.
- **GitHub access uses a repository-scoped deploy key** (`ai_deploy_key`, GitHub entry
  "autoclaw"). It can push only to `pjfchatgpt/LIMP`. The private key is kept outside
  the repository — never commit it. If pushes fail with `Permission denied`, check the
  key is still registered under the repo's Deploy keys.
- **The Windows PowerShell TLS stack fails against Cloudflare** ("Could not create
  SSL/TLS secure channel"). Verify live sites with Node (`node scripts/smoke.mjs <url>`)
  or force TLS 1.2 first: `[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12`.
- **Cloudflare credentials:** the wrangler OAuth session lives in
  `%APPDATA%\xdg.config\.wrangler\config`. An API token and R2 keys were shared in
  chat on 2026-10-15 and **were never used or stored anywhere** — they must be
  rotated/deleted (dash → My Profile → API Tokens; R2 → Manage API tokens).

## 7. Framework traps that cost real time last cycle

- **SvelteKit 3 is not SvelteKit 2.** No `svelte.config.js` — configuration lives in
  the `sveltekit(...)` plugin in `vite.config.ts`. Library imports are `#lib/*`
  (declared in `package.json` `imports`), not `$lib/*`. `tsconfig.json` extends
  `$app/tsconfig`. `event.platform` is not populated in production — bindings are read
  from `import { env } from 'cloudflare:workers'` (see `src/lib/server/db/index.ts`).
- **One conversion point for the specification engine.** `specFromRow()` in
  `src/lib/spec.ts` is the only place database rows become engine input. Bypassing it
  silently turns every stored verdict into `NA` while the browser preview still looks
  correct — this exact bug shipped and was caught by the end-to-end suite.
- **D1 is not full SQLite.** No long `UNION ALL` chains ("too many terms in compound
  SELECT"), no `CREATE TEMP TABLE` ("not authorized").
- **SvelteKit rejects cross-origin form posts.** Any HTTP client driving the forms must
  send `Origin` (same host) and `Accept: text/html`; without the latter SvelteKit answers
  with a JSON action envelope instead of a 303 redirect. See `scripts/smoke.mjs`.

## 8. Where things live

| Thing | Location |
|-------|----------|
| D1 schema (source of truth) | `migrations/0001_init.sql` |
| Seed master data | `migrations/0002_seed.sql` |
| Demo samples (optional) | `seeds/demo_samples.sql` |
| Typed schema mirror | `src/lib/server/db/schema.ts` |
| All queries and writes | `src/lib/server/lims.ts` |
| Pass/fail engine + tests | `src/lib/spec.ts`, `src/lib/spec.test.ts` |
| Shared display helpers / types | `src/lib/format.ts`, `src/lib/types.ts` |
| Certificate document | `src/lib/components/CoaDocument.svelte` |
| End-to-end suite | `scripts/smoke.mjs` |
| Full run/deploy instructions | `README.md` |
| Data-quality findings from the handover package | `../LIMS-Form-Data.xlsx`, sheet `01_Data_Quality` (30 findings) |
