Generated: 2026-04-29 13:33:53 KST (2026-04-29 04:33:53 UTC)

This document supersedes informal continuity notes in older briefings (notably `docs/PROJECT_BRIEFING_20260423.md`, which remains useful for deep historical detail but was zip-focused and predates recent Chrome Web Store packaging work). HEAD at generation time: `3a2810eb3ca4e2578b9143cb85196691a183009e`.

---

### Section 1 [CRITICAL]: Active Work Status

**Current focus**

The short-term product thrust is **shipping KickClip through the Chrome Web Store** while keeping **DEV/PROD parity** (Firebase projects, OAuth clients, Cloud Run APIs). Extension source manifests are at **v1.1.4**. Recent engineering emphasis landed on **UX polish for save feedback** (toast system unification), **discoverability** (toolbar icon opens/toggles the side panel via `chrome.sidePanel.setPanelBehavior`), and **listing hygiene** (manifest description, reduced redundant permissions, privacy policy pages for policy URLs).

**In-flight tasks**

- **Untracked doc artifact**: `docs/PROJECT_BRIEFING_20260423.md` exists as `??` in git — decide whether to track, delete, or fold unique material into dated briefings so `git status` stays clean.
- **Chrome Web Store pipeline**: README still labels Web Store install as **“pending approval”**. Exact review state (submitted vs draft, rejection/appeal cycles) lives **only in the Chrome Developer Dashboard**, not in this repository — verify there before claiming status.
- **`ai-analyze-url` vs server routes**: The extension’s background script forwards `ai-analyze-url` to `POST ${KC_SERVER_URL}/api/v1/ai-analyze-url`, but the tracked `server/src/server.ts` exposes **`/api/v1/analyze-page`** (and no `ai-analyze-url` route). Treat CoreItem tooltip AI as **potentially broken against current server source** until reconciled (either add the route as a thin alias or repoint the client).

**Blocking decisions**

- **Listing visibility** (Public vs Unlisted) and **tester rollout** strategy if OAuth consent remains in “Testing” with user caps — product/marketing choice, not encoded here.
- Whether **Electron + localhost bridges** (`pending-save` on port 3001, etc.) remain first-class or become secondary now that Web Store + extension-only flows are primary.

**Recent completions** (from `git log --oneline` near HEAD)

| Commit | Summary |
|--------|---------|
| `3a2810e` | chore: bump version to **1.1.4** |
| `72d7dae` | refactor: unify page-level feedback into **toast system** (avoid duplicate/conflicting UI paths) |
| `27729cd` | feat: **side panel toggle** on toolbar icon (`setPanelBehavior`) |
| `2c6b6ad` | Chrome Web Store **appeal-oriented** manifest description tweak |
| `863bada` | **Permission cleanup** for Web Store policy/readability |
| `49321e9` / `f13241b` | README/documentation restructuring |
| `a8c6eec` | **Privacy policy** pages for store-required URLs |
| `f1636ae` | Prod manifest preparation for packaging |
| Earlier `0afa1bb`–`998537b` | User profile upsert, Drive phases, upload reliability, OAuth `drive.file` scope |

**Pending external events**

- **Chrome Web Store review** outcome for the build that corresponds to **v1.1.4** (confirm in dashboard; repo does not mirror review timestamps).
- **GCP OAuth consent screen** mode (Testing vs Production) and **verified domains** for sensitive scopes — operational status is in Google Cloud Console / OAuth consent UI.
- **No automated CI status** is described in-repo for this snapshot; treat CI as unknown unless hooked up elsewhere.

**Repository hygiene notes (for the incoming assistant)**

- `git status` at generation time was **clean for tracked files** but showed `?? docs/PROJECT_BRIEFING_20260423.md` — this large, untracked briefing may be a **WIP export** or an accidental duplicate of older multi-hundred-KB archives also present under `docs/`. Do not delete without confirming with the maintainer, but **do** avoid letting untracked multi-MB files linger unmentioned in future handoffs.
- `HEAD` is **`3a2810e`** on `main` (verify after new pulls). All section-13 commit references were taken from that snapshot; if `main` advances, re-run `git log --oneline -50` to append new work.

**Open risks & tech debt (explicit)**

1. **AI endpoint mismatch** — Extension expects **`/api/v1/ai-analyze-url`** but server implements **`/api/v1/analyze-page`** + commented save hooks — until reconciled, tooltip AI may always error despite functioning Gemini keys.
2. **Dual API implementations** — `functions/src/index.ts` and `server/src/server.ts` both define overlapping Express surfaces — deployment drift risk if only one folder releases.
3. **Electron assumptions** — Localhost pings improve UX on developer desktops but complicate reasoning about MV3-only testers — keep verifying extension-only paths whenever touching background commands.
4. **Large legacy briefing archives** — Multiple multi-hundred-KB `PROJECT_BRIEFING_*.md` files may confuse newcomers — prefer linking **dated** concise briefings from journal entries rather than duplicating content indefinitely.

**Continuity vs prior briefings**

- Earlier document `docs/PROJECT_BRIEFING_20260423.md` (and other `PROJECT_BRIEFING_*.md` volumes) contains **exhaustive line-level commentary** and long code citations. This 2026-04-29 edition **re-baselines** on the **Web Store + permission + toast + side panel** thread (late April 2026) and explicitly calls out **server/client AI route drift** which older zip-distribution briefings may not emphasize.
- `DEPLOYMENT_INFO.md` “Current stable commit” line may lag `main` — trust `git log` for truth, `DEPLOYMENT_INFO` for historical deploy context.

---

### Section 2 [CRITICAL]: Working Conventions with AI Assistant

**Cursor prompt style**

- Prefer **English** for code blocks and technical steps; the developer is comfortable with **Korean** for explanations and mixed discussion.
- For large changes, use **phased plans** (inspect → minimal repro → patch → verify). A short **pre-flight file read** of touched modules before editing is expected.
- **Cross-reference with `path:line`** so follow-up sessions can jump straight to definitions.

**Decision style**

- Give **one primary recommendation** with crisp rationale and explicit tradeoffs only when they affect safety or maintenance — avoid presenting three equally-weighted options without a recommendation.

**Confirmation flow**

- **Stop and ask** before: `git push --force`, history rewrite, deleting user data keys, mass refactors, or edits to **secrets**, **`.pem` keys**, or **service accounts**.
- Prefer **small, reviewable commits**; avoid bundling unrelated fixes.

**Commit conventions**

- Keep commits **focused**; match conventional prefixes seen on `main` (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- **Semver (extension)**: manifest `version` tracks user-visible extension releases; **patch** for fixes/tweaks, **minor** for additive behavior, **major** reserved for breaking UX/security contracts.
- **Do not commit**: `node_modules/`, `dist/` build outputs, generated `browser-extension/chromium/manifest.json` if gitignored, **`browser-extension/keys/*.pem`**, Firebase service account JSON, `.env` with real secrets, large accidental binaries.

**No-go list**

- No **force-push** to shared branches unless the developer explicitly requests recovery from a mistake.
- No **interactive rebase** on shared history for “cleanup” without agreement.
- Avoid **permission broadening** (`<all_urls>` → something narrower) without a tracked security review — this codebase currently depends on broad host access by design.

**Communication preferences**

- **Korean replies are welcome** for conversational nuance; **technical artifacts** (code, errors, commit messages) stay English-heavy for portability.
- Tone: **direct, senior-engineer default** — friendly but skip filler.

**Tooling expectations inside Cursor**

- Prefer **repository-backed answers**: run **`rg`/`git grep` equivalents**, open defining files, cite **`path:line`**. Avoid speculative APIs — MV3 surfaces (`chrome.sidePanel`, `chrome.identity`) evolve; verify against **`manifest.json`** version compatibility tables when unsure.
- When producing patches, **keep blast radius small** — the maintainer historically rejects drive-by refactors unless explicitly requested (see user rule set).
- Longitudinal tasks should use TODO tracking sparingly — default pattern is **structured markdown updates + focused commits** rather than sprawling checklist churn inside source files.

**Review etiquette**

- PR descriptions favor **complete sentences** explaining *why* — mirror tone from README/DEPLOYMENT docs.
- Screenshots for reviewer empathy belong in PR commentary, not committed binary blobs unless explicitly requested.

---

### Section 3 [CRITICAL]: Project Identity

**What KickClip is**

KickClip is a **Manifest V3 Chrome extension** (with Firefox/Safari folders present but Chromium-first) for **fast capture** of web pages and focused **CoreItem** regions: keyboard shortcut, optional hover targeting, rich metadata, screenshots, and **Firestore-backed** sync of saved items. It emphasizes **low-latency feedback** (overlays, shutter animation, top-center toasts) and a **side panel** library UI.

**Problem solved**

Reduce friction between “I want to keep this” (page, image, mail thread surface, product card, etc.) and a **durable, organized record** (metadata + optional file upload to **local folder** or **Google Drive** via `drive.file` scope).

**Tech stack (high level)**

- **Extension**: Vanilla JS modules, Shadow DOM UI (`uiManager.js`), MV3 service worker (`background.js`).
- **Backend**: Node **Express** in `server/` (mirrored API surface in `functions/` for Firebase Hosting/Cloud Run deployment patterns — verify which artifact is actually deployed for each environment).
- **Firebase**: Auth (Google), Firestore (user items/directories), Storage for screenshots/assets as applicable.
- **Electron client** (`client/`): optional desktop shell / dock workflows; local HTTP receivers for extension pings — parallel track to the browser extension.

**Architecture sketch**

```
Extension (content + SW + side panel)
    → HTTPS Cloud Run API (`KC_SERVER_URL` in config)
    → Firebase (Auth token on client; Admin SDK on server/functions)
    → Firestore + Storage

Optional: Electron localhost ports for pending-save / richer desktop integration
```

**Non-goals / boundaries**

- KickClip is **not** a full read-later archive with offline article extraction guarantees — it prioritizes **fast capture** and **metadata**, sometimes leaning on platform-specific heuristics (`itemDetector.js`, `dataExtractor.js`).
- The **Electron** client coexists for power users / dock workflows but extension-only operation must remain viable for Chrome Web Store reviewers who will not install desktop apps.
- **Instagram/Facebook OAuth** narratives were explicitly trimmed from README (`cac3290`) — do not reintroduce dead roadmap sections without product confirmation.

**Brand**

- Name: **KickClip** (legacy internal codename **Blink** largely migrated).
- Accent: **`#BC13FE`** purple.
- UX values: **speed**, **clarity of save outcome**, **minimal intrusion** on host pages (Shadow DOM isolation).

---

### Section 4 [CRITICAL]: Environment & Infrastructure

**Firebase projects**

| Env | Project ID | Notes |
|-----|------------|-------|
| DEV | `saveurl-a8593` | Default alias in `.firebaserc` |
| PROD | `saveurl-prod` | Production users |

**Region**

- Default GCP / Firestore / Functions alignment documented as **`asia-northeast3` (Seoul)** in `DEPLOYMENT_INFO.md` — confirm in console if infra migrates.

**Cloud Run / API URLs** (from `browser-extension/chromium/config.dev.js` pattern)

| Env | API base (`KC_SERVER_URL`) |
|-----|----------------------------|
| DEV | `https://api-gstf2hxbiq-du.a.run.app` |
| PROD | `https://api-hn4mxotviq-du.a.run.app` |

**OAuth setup**

- Extension uses `chrome.identity.launchWebAuthFlow` patterns with **`openid` + `email` + `profile` + `https://www.googleapis.com/auth/drive.file`** per current manifests (see `browser-extension/chromium/manifest.dev.json` / `manifest.prod.json`).
- **DEV OAuth client ID** (Chrome extension type): `658386350246-kinolt4jf9l7131r76rnbii0407ookcj.apps.googleusercontent.com` — ties to extension ID `knpcebcbpcjoiagccededjhamononapd`.
- **PROD OAuth client ID**: `[REDACTED — see GCP Console → APIs & Credentials → OAuth 2.0 Client IDs for project saveurl-prod; also mirrored in manifest.prod.json locally]` — ties to extension ID `kbdieogmfmbeeplefmcielmcenpajioi`.
- **Client secrets**: not embedded in MV3 extension; any server credentials belong in **Cloud Run secrets / `.env` / 1Password**, never committed.

**Chrome Web Store**

- **PROD extension ID**: `kbdieogmfmbeeplefmcielmcenpajioi` (deterministic from signing key material).
- **Listing URL**: construct from Chrome Web Store developer dashboard item linked to that ID — do not guess a public URL if not published.

**Domains / URLs**

- **Marketing/docs site (GitHub Pages)**: `https://tlstlsgns.github.io/KickClip/`
- **Privacy policy**: `https://tlstlsgns.github.io/KickClip/privacy-policy.html` (English variant `privacy-policy-en.html` exists under `docs/`).
- **Support / contact**: see README (`tlstlsgns@gmail.com`).

**Backup & critical asset custody**

- **Extension signing keys** live outside git (`browser-extension/keys/*.pem`) with **Bitwarden** secure-note backups documented in `DEPLOYMENT_INFO.md`. If keys are lost, **extension IDs rotate irreversibly** and OAuth clients must be re-keyed — schedule periodic vault audits before hardware wipes.
- **Service account JSON** for Firebase Admin belongs in **secure secret storage** only; `GOOGLE_APPLICATION_CREDENTIALS` should point to a local path outside Dropbox/iCloud-synced folders unless encrypted.

**Analytics / observability**

- There is **no first-party analytics suite** called out in this briefing snapshot — product telemetry, if added later, must align with privacy policy promises (`docs/privacy-policy*.html`). Cloud Run logs / Firebase usage dashboards remain the default ops observability channels.

**Developer environment**

- macOS workstation; Chrome stable; Cursor IDE; shell zsh — per developer notes and prior briefings.

**Secrets handling**

- API keys (e.g. **Gemini**): `[REDACTED — see server/.env or deployment secret manager]` per `server/.env.example`.
- Firebase Admin: `[REDACTED — GOOGLE_APPLICATION_CREDENTIALS path or workload identity]`.
- Extension signing **private keys**: `browser-extension/keys/*.pem` + Bitwarden backups — `[REDACTED — never paste]`.

**Cloud Run / HTTPS API operational checklist**

1. **Traffic splitting**: When deploying new revisions (`api-*-du.a.run.app` endpoints listed earlier), confirm traffic percentages in GCP console — accidental 0% assignments strand fixes behind unrouted revisions.
2. **Cold starts**: Express boots quickly but Gemini crawls + screenshot uploads may spike latency — watch **p95** during crawl-heavy workloads (`crawlPageContent` invoked by `/api/v1/analyze-page`).
3. **IAM**: Cloud Run service accounts must permit Firestore + Storage access — rotating credentials requires updating **Workload Identity** bindings, not merely `.env` locally.
4. **CORS**: Extension calls originate from **`chrome-extension://` origins** — ensure APIs do not reflexively enable permissive `*` CORS on authenticated routes (risky). Current architecture proxies via extension backgrounds/service workers largely hitting HTTPS APIs server-side — validate before exposing browser-callable endpoints publicly.
5. **Secrets mounting**: Mirror `.env.example` keys into Secret Manager entries matching CI/CD pipeline expectations — drift yields successful local runs but failing prod (`503` from missing Gemini key).
6. **Rollback**: Keep prior Cloud Run revisions tagged per manifest version (`1.1.4`) so expedited rollback does not require rebuilding artifacts during outage windows.

---

### Section 5 [CRITICAL]: Current Version State

| Question | Answer |
|----------|--------|
| **Latest source version** | **1.1.4** (`manifest.dev.json` / `manifest.prod.json`) |
| **Submitted to Web Store** | Repository signals **readiness** (description, permissions, privacy HTML) but **does not record** submission timestamps — confirm which package was uploaded. |
| **In users’ hands** | **Beta/zip distribution** remains viable (`browser-extension/scripts/build-user-package.js` lineage); Web Store users **only after approval**. Treat Web Store as **pending** unless dashboard says otherwise. |
| **Bump policy** | **Patch**: fixes, copy tweaks, toast/UI tuning. **Minor**: new user-visible capabilities (Drive milestones crossed, side panel behavior changes). **Major**: rare — breaking data/schema or permission contraction/expansion needing migration. |

**Packaging artifacts travelers should know**

- **`browser-extension/dist/kickclip-prod.zip`**: Primary zipped Chromium bundle produced by production script — upload candidate for Chrome Web Store packaging workflow when paired with listing assets.
- **`browser-extension/dist/kickclip-vX.Y.Z-prod.zip`**: Tester-ready archive combining prod zip + rendered README for cohorts who sideload without Developer Mode nuances — verify semantic version in filename tracks **`manifest.prod.json`** (`3a2810e` bumped both manifests together).

**Dual-track distribution commentary**

- Many teammates may still run **unpacked dev** builds (`npm run build:dev`) hitting **`saveurl-a8593`** Firebase — never confuse DEV telemetry with PROD incident reports.
- Web Store users load **`kbdieogmfmbeeplefmcielmcenpajioi`** against **`saveurl-prod`** infra — when debugging “works on my machine,” confirm KC_IS_DEV alignment **before** diving into CoreItem heuristics.
- When cutting hotfix branches, keep **`manifest` version**, **`package` scripts output**, and **tagged Cloud Run revision** names aligned so support tickets referencing “1.1.4” can be matched to an immutable deployment artifact without guesswork.

---

### Section 6 [CRITICAL]: Decision Log

**Decision: Host permission breadth (`<all_urls>`)**

- **Decided**: Keep **broad host permissions** for content scripts and reliable capture across arbitrary sites.
- **Why**: KickClip must inject on diverse domains; `activeTab`-only models break hover detection, late injection, and consistent shortcut handling — trading store-review scrutiny for product completeness.
- **Rejected**: Narrowing to `activeTab` without a redesign of discovery/hover — would gut CoreItem detection UX.
- **Date/commit**: longstanding; reinforced during permission audits (`863bada`).

**Decision: Chrome Web Store readiness vs immediate Public listing**

- **Decided**: Ship **policy-compliant artifacts** (privacy pages, minimized permissions, clearer description) **before** chasing broad distribution.
- **Why**: Reduces rejection cycles; scopes (`drive.file`) still demand accurate OAuth disclosures.
- **Rejected**: Uploading early minimal ZIP without privacy URLs — fails automated checks.

**Decision: Toast unification for page-level feedback**

- **Decided**: Route page-level status through the **same toast helpers** as other save feedback rather than ad-hoc DOM duplicates (`72d7dae`).
- **Why**: Single UX language; fewer race conditions between “legacy page toast” vs Core copy toast.
- **Rejected**: Keeping separate experimental page toast — caused inconsistent styling/timing.

**Decision: Side panel toggle via `setPanelBehavior`**

- **Decided**: Call `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` at service worker startup (`27729cd`, see `background.js:11–15`).
- **Why**: Chrome’s supported UX for MV3 side panel — toolbar icon opens/closes panel without custom popup page.
- **Rejected**: Relying solely on `action.onClicked` without behavior wiring — worse defaults on some channels.

**Decision: Shadow DOM encapsulation for injected UI**

- **Decided**: Host all injected visuals under a **closed ShadowRoot** (`uiManager.js` + consumers).
- **Why**: Page CSS (e.g., aggressive `body > *` rules) previously broke overlays.
- **Rejected**: Inline styles only — insufficient against global resets.

**Decision: OAuth scopes migration away from Gmail broad reads**

- **Decided**: Prefer **`drive.file`** cloud saves vs historic `gmail.readonly` expansions (`f2f36ea` lineage).
- **Why**: Principle of least privilege aligned with store scrutiny.
- **Rejected**: Keeping mail-wide scopes without independent verification — stalls approvals.

**Decision: Full-page entry toast reads shortcut from storage**

- **Decided**: `showFullpageEntryToast` pulls **`kickclipShortcut`** from `chrome.storage.local` populated by background shortcut polling (`coreEntry.js:153–177`).
- **Why**: Avoid async `sendMessage` latency producing wrong shortcut glyphography at toast render.

**Decision: Permission cleanup ahead of Chrome Web Store review**

- **Decided**: Drop redundant manifest entries cautiously while verifying MV3 feature coverage (`863bada`).
- **Why**: Fewer permissions improves reviewer confidence and shrinks disclosure surface — must be balanced against actual feature usage (downloads, clipboard, cookies each justified by upload/copy flows).
- **Rejected**: Blindly removing **`cookies`** or **`downloads`** without tracing Drive/upload modules — would cause latent regressions.

**Decision: Manifest description tuned for appeal cycles**

- **Decided**: Iterate **customer-facing description** copy for clarity (`2c6b6ad`) anchoring on shortcut capture + destinations + organization.
- **Why**: Store reviewers reference manifest description against runtime behavior during appeals.
- **Rejected**: Overly technical descriptions referencing internal codenames — triggers suspicion.

**Decision: Privacy policy pages hosted on GitHub Pages**

- **Decided**: Maintain **static HTML** policies under `docs/` deployed to GitHub Pages (`a8c6eec`).
- **Why**: Chrome Web Store requires stable policy URLs; GitHub Pages provides zero-backend hosting aligned with OSS repo layout.
- **Rejected**: Google Docs links with changing share permissions — unreliable as canonical legal URLs.

**Decision: Commenting-out server-side post-save AI**

- **Decided**: Keep **`analyzeAndUpdateDocument`** disabled in `/api/v1/save-url` until product + cost controls align (`1389–1393`, `1497–1499`).
- **Why**: Prevent accidental Gemini spend / latency spikes on every save while telemetry stabilizes.
- **Rejected**: Deleting helper entirely — would lose partially-tested integration when re-enabling.

---

### Section 7 [REFERENCE]: Project Structure

The tree lists intent, not a full filesystem snapshot — always prefer `find`/`tree` when validating new assets.

```text
KickClip/
├── browser-extension/
│   ├── chromium/                 # Primary MV3 extension source (load unpacked here)
│   │   ├── background.js         # Service worker: SW cache, commands, fetches, AI proxy
│   │   ├── coreEntry.js          # Content script orchestration: save, clipboard, AI tooltip
│   │   ├── uiManager.js          # Shadow DOM UI: highlights, badges, tooltips
│   │   ├── sidepanel.js/html/css # Side panel app + optimistic cards
│   │   ├── brandConfig.js        # Firebase web config + branding
│   │   ├── config*.js            # KC_IS_DEV + KC_SERVER_URL selection
│   │   ├── manifest.dev.json     # Dev signing key + broader CSP/connect rules
│   │   └── manifest.prod.json    # Store-oriented manifest
│   ├── scripts/                  # build-dev, build-prod, zip packaging
│   ├── docs/                     # Korean user install guide templates
│   ├── firefox/ , safari/        # Alternate targets (not the daily driver path)
│   └── keys/                     # PEM keys (gitignored)
├── server/
│   └── src/server.ts             # Express API + Gemini integration
├── functions/
│   └── src/index.ts              # Cloud Functions / hosted API variant (parity check!)
├── client/
│   └── src/main.ts               # Electron main process entry
├── docs/
│   ├── index.html                # GitHub Pages landing
│   ├── privacy-policy.html       # KO privacy (canonical policy URL)
│   ├── privacy-policy-en.html    # EN mirror
│   └── PROJECT_BRIEFING_*.md     # Session handoff briefings (large archives exist)
├── assets/                       # Repo-level icons / shared imagery
├── firebase.json                 # Firebase deploy wiring (hosting/functions — verify)
├── firestore.rules               # Security rules source of truth
├── firestore.indexes.json        # Composite indexes (if present)
├── scripts/
│   └── migrate-schema.js         # Firestore taxonomy / schema migrations
└── DEPLOYMENT_INFO.md            # Ops log + recovery playbook + env tables
```

---

### Section 8 [REFERENCE]: Component Breakdown

#### Server (`server/src/server.ts`)

**Persistence ladder for `POST /api/v1/save-url`** (read alongside `1243:1560:server/src/server.ts`)

The handler validates core fields (`url` rules relax when `img_url` exists), normalizes rich metadata from the extension (`category`, `platform`, `confirmed_type`, portrait/extracted-image flags, optional Gmail/Naver helpers), then attempts saves in **priority order**:

1. **Electron forward** (`forwardToElectronApp`): When the desktop app is reachable, Firestore writes may occur via Electron’s bridge — optimal when the full desktop pipeline is active.
2. **Firestore Admin direct**: If `userId` is present and Admin SDK is configured, `users/{uid}/items` documents are created with monotonic `order` insertion (fetch lowest `order`, subtract one), timestamps, and derived `domain` via `extractSource`.
3. **Local JSON fallback**: If no authenticated user path succeeds, entries append to a local `saved-urls.json`-style datastore for developer/offline diagnostics — **not** the production Chrome extension path.

Parallel asynchronous work:

- **Screenshot upload**: When base64 screenshot payload qualifies (guards for portrait extracted images, SNS page edge cases), `uploadScreenshotToStorage` pushes to Firebase Storage and patches `img_url` + optional `screenshot_bg_color` on the Firestore doc (`1365:1385`, `1472:1494`).
- **Post-save Gemini enrichment**: The `analyzeAndUpdateDocument` hook is **present but commented out** (“disabled — re-enable in future update”) at `1389:1393` and `1497:1499`. Treat server-driven AI enrichment after save as **off by default** in the tracked tree even though helper implementations exist elsewhere in the file.

- **Port**: `process.env.PORT || 3000` (see bottom `app.listen`).
- **Framework**: Express (TypeScript).
- **Endpoints** (non-exhaustive but practical):

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/save-url` | Primary extension save ingress (metadata persistence pipeline) |
| POST | `/api/v1/firestore/move-item` | Move item between directories |
| POST | `/api/v1/firestore/move-directory` | Directory mutations |
| DELETE | `/api/v1/items/:itemId` | Delete saved item |
| GET | `/api/v1/saved-urls` | Query saved URL summaries |
| POST | `/api/v1/extension/ping` | Connectivity / presence |
| GET | `/api/v1/image-proxy` | Proxy remote images |
| GET | `/api/v1/extension/status` | Health/feature bits |
| GET | `/api/v1/dock/width` | Legacy Electron dock integration |
| GET | `/api/v1/logo/:domain` | Favicon/logo helper |
| POST | `/api/v1/analyze-page` | Crawl + Gemini structured analysis |

- **Env vars (names only)**: `GEMINI_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_STORAGE_BUCKET`, `PORT`, plus any Firebase project overrides embedded in code paths — inspect file header imports.

#### Chrome Extension (`browser-extension/chromium/`)

**Manifest highlights** (`manifest.prod.json`)

- **permissions**: `storage`, `downloads`, `scripting`, `tabs`, `contextMenus`, `windows`, `sidePanel`, `identity`, `clipboardWrite`, `cookies`.
- **host_permissions**: `<all_urls>`.
- **commands**: `save-url` default `Ctrl+Shift+S` / Mac `Command+Shift+S`.
- **side_panel.default_path**: `sidepanel.html`.
- **action**: empty `default_popup` — icon relies on side panel behavior.
- **oauth2.scopes**: openid, email, profile, drive.file.

**DEV vs PROD manifest deltas worth memorizing**

- **Signing key**: `manifest.dev.json` embeds a **`key`** field for deterministic unpacked extension ID during development. **`manifest.prod.json` intentionally omits `key`** so the Chrome Web Store signing pipeline supplies the production key material — never paste prod `.pem` into the tracked manifest.
- **Host permission specificity**: Dev manifest historically enumerates API hosts + localhost debugging origins alongside `<all_urls>` (see `manifest.dev.json:25–29`) whereas prod collapses to `<all_urls>` only — tighter CSP/connect-src differences accompany dev local debugging (`manifest.dev.json:106–107`).
- **Connect-src CSP**: Prod restricts extension pages to `'self'`, data, and `https:` broadly (`manifest.prod.json:102–103`); dev adds explicit localhost ports for Electron bridges — accidental divergence here manifests as **silent network failures** in the side panel.

**Build pipeline (`browser-extension/scripts/`)**

| Script | Purpose |
|--------|---------|
| `build-dev.js` | Copies Chromium folder → `dist/dev`, swaps **`manifest.dev.json` → manifest.json** and **`config.dev.js` → config.js** so developers load a coherent DEV bundle. |
| `build-prod.js` | Produces production folder under `dist/prod`, asserts **`KC_IS_DEV = false`** substitution in emitted `config.js`, zips artifacts (`kickclip-prod.zip`). |
| `build-user-package.js` | Wraps production zip + templated README into **`kickclip-vX.Y.Z-prod.zip`** for tester distribution lists. |

Operational cautions:

- Always rebuild after touching **`brandConfig.js`** or Firebase IDs — stale caches cause **`auth/invalid-credential`** mismatched audiences.
- **`manifest.json` inside `chromium/`** should be treated as **generated** output of npm scripts — edits belong in `manifest.dev.json` / `manifest.prod.json` sources.
- When validating Drive OAuth, confirm **`oauth2.scopes`** alignment across Firebase Authorized domains + GCP OAuth consent + Firebase Authentication templates — mismatches yield opaque **`403`** responses from Google APIs.

**Major files**

- **`background.js`**: Service worker; persists saved URL cache; migration `blinkSavedUrls` → `kickclipSavedUrls`; **side panel behavior**; **command handler** + optional localhost pending-save ping; **image/context menu** saves; message hub including **`ai-analyze-url` proxy**; Drive/upload helpers as present in file tail.
- **`coreEntry.js`**: Content script brain — CoreItem hover maps, keyboard save path, screenshot pipeline, **toast** messaging, **`saved-urls-updated` listener** (sync-only UI path post-refactor), clipboard orchestration, **`analyzeUrlForTooltip`** (AI tooltip).
- **`uiManager.js`**: Shadow DOM factory; **full-page highlight** overlay + border animation; **`setFullPageHideCallback`** hooks entry toast dismissal when highlights hide; core highlight + shutter effects.
- **`sidepanel.js` / `sidepanel.html`**: Auth UI, optimistic cards, Firestore listeners, upload/destination UI, move/delete network calls to API.
- **`dataExtractor.js` / `itemDetector.js` / `coreEngine.js`**: Metadata + structural heuristics for CoreItems.
- **`content-loader.js`**: Loads `coreEntry` as ES module.
- **`upload.js` / `uploadStorage.js`**: Local filesystem vs Drive orchestration; **`uploadStorage.js`** abstracts persisted handles / quotas for repeat saves.
- **`picker.html` / `picker.js`**: Modal UX for choosing folders / confirming destinations — coordinated with **File System Access** APIs where permitted.
- **`urlResolver.js`**: Canonical URL normalization + dedupe helpers shared between tooltip flows and save payloads.
- **`stateLite.js`**: Lightweight reactive/shared state between modules (`state` export consumed by `uiManager.js`).
- **`firebase-bundle.js`**: Packed Firebase SDK entry used by side panel/auth flows (avoid duplicating modular imports across MV3 constraints).
- **`brandConfig.js`**: Firebase web config + brand constants; **`KC_IS_DEV`** gates environment switches paired with `config.js`.
- **`html2canvas.bundle.js`**: Bundled renderer dependency for fallback captures when tab screenshot APIs are insufficient — watch perf on heavy pages.

**Cross-file messages** (illustrative)

- `chrome.tabs.sendMessage` / `runtime.sendMessage` actions: `save-url`, `get-saved-urls`, `ai-analyze-url`, `saved-urls-updated`, side panel focus bookkeeping.

#### Electron (`client/`)

- **Entry**: `client/src/main.ts` — window lifecycle, optional HTTP servers on **3001/3002**, IPC bridges, Firestore watchers.
- **IPC**: extensive `ipcMain` handlers — search `ipcMain.handle` in `main.ts` / renderer libs when extending desktop behavior.

**Localhost bridges (Electron ↔ extension)**

| Port | Direction | Purpose |
|------|-----------|---------|
| **3001** | Extension → Electron | Receives **`pending-save`** placeholder payloads fired immediately on shortcut (`background.js:311–318`) so the desktop shell can animate dock/dropzone UI before Firestore catches up. |
| **3002** | Extension/Electron internal | Secondary Firestore save server (`FIRESTORE_SAVE_PORT` constant near top of `main.ts`) — historical split from pending-save pipeline; verify active usage before refactoring. |
| **3000** | Desktop ↔ local Node | README positions **`server`** dev API at `localhost:3000` — unrelated to MV3 service worker except during hybrid debugging sessions. |

These bridges explain why **`manifest.dev.json`** broadens `connect-src` with explicit localhost endpoints while prod manifest omits them — Web Store builds should never rely on localhost-only behaviors.

**Glossary (terms reused across modules)**

| Term | Meaning |
|------|---------|
| **CoreItem** | Heuristically detected primary content region — videos, cards, articles — receiving purple outline + precision screenshot framing. |
| **OptimisticCard** | Side panel UI row inserted immediately with provisional metadata before Firestore ACK — reconciled via **`temp_id`** matching server echoes. |
| **temp_id / tempId** | Ephemeral identifier bridging optimistic UI rows with persisted docs — critical during flaky networks. |
| **Full-page highlight** | Animated border overlay signaling page-scope saves distinct from Core selections (`showFullPageHighlight`). |
| **Shutter effect** | Brief green/red tint after save attempt communicating success vs failure atop overlays (`triggerShutterEffect`). |
| **Shadow host** | `<div id="kickclip-shadow-host">` root encapsulating extension visuals away from page CSS. |
| **KC_IS_DEV** | Boolean compiled into `config.js` flipping Firebase config + API endpoints — must match environment under test. |

**When Electron is irrelevant**

- Chrome Web Store reviewers and most end-users **will not** run KickClip desktop. Any feature gated solely on `localhost` posts must be **nice-to-have**, not mandatory for save correctness — extension-only flows must succeed through **`KC_SERVER_URL`** + Firebase alone.

#### Firebase / Firestore

- **Auth**: Google provider / OAuth token flows in extension + Firebase web SDK bundle.
- **Collections** (see `firestore.rules`): `users/{uid}`, nested `items`, `directories`, `instagramSession`.
- **Rules summary**: authenticated user may only read/write their own subtree — see `firestore.rules` (do not duplicate inline).

**Taxonomy snapshot (April 2026)**

- `6df7b9f` formalized a **four high-level category taxonomy** migration — downstream UI (`sidepanel.js`) still surfaces finer-grained labels (Article vs Video vs Mail, etc.) via combined **`category` + `platform` + `confirmed_type`** signals rather than a single enum everywhere.
- Detection splits across **URL-only heuristics** (`detectItemCategory` patterns inside server helpers) and **DOM-heavy CoreItem logic** (`itemDetector.js`). When debugging miscategorized pages, ask whether failure originates **before** DOM scan (early URL classification) vs **after** (structure mismatch).
- **`directoryId`** defaults to literal `'undefined'` in some server inserts — side panel code historically tolerated this sentinel; changing it requires a coordinated migration + UI guard audit.

**Indexes & query patterns**

- Server-side ordering uses **`itemsRef.orderBy('order', 'asc').limit(1)`** when calculating insertion (`1427–1434`). If Firestore logs complain about missing composite indexes, update **`firestore.indexes.json`** (if present) via Firebase CLI rather than suppressing queries blindly.
- Heavy client listeners live inside **`sidepanel.js`** — watch for unbounded snapshots during large libraries; pagination may become necessary beyond early-beta corpus sizes.

**Representative `users/{uid}/items/{itemId}` fields** (derived from `server/src/server.ts` Firestore write paths — not exhaustive):

| Field | Role |
|-------|------|
| `url`, `title`, `timestamp` | Canonical identity for dedupe + UI sorting |
| `domain` | Normalized site label (`extractSource`) |
| `type` | Legacy/type discriminator (`image`, page detectors, Instagram-specific types when supplied) |
| `directoryId` | Folder bucket (`'undefined'` sentinel appears in server writes — verify UI expectations) |
| `order` | Sort key — newer saves typically get more negative numbers to surface at top |
| `saved_by` | `'browser-extension'` vs others |
| `createdAt` | Server timestamp |
| `category`, `platform`, `confirmed_type` | Taxonomy axes from client detectors |
| `img_url`, `screenshot_bg_color` | Thumbnail/screenshot pointers post-upload |
| `sender`, `page_description` | Mail/blog-specific enrichment when captured |

---

### Section 9 [REFERENCE]: Key Data Flows

**1. Save flow: Cmd+Shift+S with active CoreItem (`htmlContext`)**

1. User presses **`save-url` command** bound to manifest commands (`manifest.prod.json:81–88`).
2. Service worker receives `chrome.commands.onCommand` → `'save-url'` (`background.js:285`).
3. **Signed-out shortcut**: `_cachedUserId` guard triggers **`chrome.sidePanel.open`** so onboarding/sign-in is reachable without silent failure (`287–298`).
4. **Electron placeholder**: Optional `fetch('http://localhost:3001/pending-save')` fires immediately for dock/desktop UX (`311–318`) — safe no-op if Electron absent.
5. **Tab routing**: Query active tab; reject restricted schemes (`chrome://`, `chrome-extension://`, `edge://`, `arc://`) (`327–329`).
6. **Primary attempt**: `chrome.tabs.sendMessage(tabId, { action: 'save-url' })` (`333`).
7. **Injection recovery**: On connection errors, probe `window.__kcMainLoaded` + `chrome.scripting.executeScript` retries (`341–367` region) — ensures heavy pages eventually receive the message.
8. **Content script gate**: `coreEntry.js` rejects when `_kcUserReady` false (`2599`) or iframe constraints (`2604–2606`).
9. **Pointer resync**: If CoreItem cleared between keydown and message delivery, `elementFromPoint(lastPointerX/Y)` attempts re-selection (`2610+`).
10. **Capture pipeline**: Screenshot stack (`captureVisibleTab`, canvas/HTML pipeline — follow `waitForRepaint` usage) produces **`screenshot_base64`** + optional **`screenshot_bg_color`**.
11. **Metadata**: `dataExtractor`/`itemDetector` outputs determine **`category`**, **`platform`**, **`confirmed_type`**, overlay ratios for SNS Page edge cases.
12. **Clipboard**: Parallel `performClipboardCopy` chooses bytes vs URL text — merges status into **`buildToastMessage`** outcome for unified toast (`clipboard` section of file).
13. **Network**: `fetch(`${KC_SERVER_URL}/api/v1/save-url`)` includes **`userId`**, **`temp_id`**, serialized **`htmlContext`** payload segments as implemented in active branch (`2010` / `2326` neighborhoods).
14. **API/server**: Firestore persistence ladder executes (Electron → Admin → JSON) per Section 8 notes; screenshot upload may patch storage URLs asynchronously.
15. **Optimistic UI**: Side panel inserted optimistic card keyed by **`temp_id`** before server ACK — reconcile replaces provisional row when Firestore snapshot arrives.
16. **Background cache**: Saved URLs cache updates propagate via messaging → **`saved-urls-updated`** fan-out.

**2. Save flow: Cmd+Shift+S page-level (no CoreItem)**

1–7. Identical to Core flow through successful content-script delivery.
8. Branch chooses **page-level capture**: `showFullPageHighlight`, `resetFullPageHideTimer` around shutter success/error (`uiManager.js`).
9. Metadata defaults rely on **page URL + extractor heuristics** rather than CoreItem bounding boxes.
10. POST body marks page semantics (`page_save` flag where applicable — see server destructuring `1255`).
11. Toast strings emphasize **page subject** copy semantics vs Core-specific strings.
12. Optimistic card still ties to **`temp_id`** if implemented for page saves in `sidepanel.js` listeners.
13. **`initPageLevelMetadata`** may run once URL sets stabilize — ensures page-level hover classification picks up Firestore-backed dedupe signals without spamming network calls (`2576–2591` region interplay).
14. **`showFullpageEntryToast`** path should **not** fire on every minor saved-url sync — only user gestures + explicit page entry triggers — saved-url refactors explicitly removed duplicate UI retriggers to reduce toast fatigue.

**3. OAuth sign-in (extension → Firebase / Google)**

1. User opens side panel (`sidepanel.html`) via toolbar icon behavior (`setPanelBehavior`).
2. Renderer initializes Firebase app from `brandConfig.js` configuration (`KC_IS_DEV` selects dev vs prod Firebase config objects).
3. Sign-in button triggers OAuth flow using **`chrome.identity`** APIs where applicable + Firebase `GoogleAuthProvider`.
4. Tokens propagate to Firestore listeners — **`users/{uid}`** profile doc upsert (`feat(auth): upsert user profile` commit lineage).
5. Background caches `_cachedUserId` for synchronous command handling (`background.js` top-of-file variables).
6. Storage migration hooks may repopulate **`kickclipShortcut`** + saved-url caches after restart.

**4. AI analysis flows**

- **A. Tooltip “fast” analysis (`analyzeUrlForTooltip`)**  
  1. Hover pipeline schedules tooltip prefetch (`schedulePreScan` / idle callbacks).  
  2. When CoreItem stabilizes, `analyzeUrlForTooltip` increments session token to cancel stale network replies (`1404–1409`).  
  3. Cache hits (`_aiUrlCache`) short-circuit network for repeated URLs (`1411–1415`).  
  4. Miss path clears tooltip then issues runtime message **`ai-analyze-url`** (`1418–1434`).  
  5. Service worker wraps **`fetch(`${KC_SERVER_URL}/api/v1/ai-analyze-url`)`** (`1357`).  
  6. **Gap**: No matching Express route in tracked `server.ts` — expect HTTP **404** unless production deploy differs; fix by aligning endpoint names or restoring handler from older revision / `functions/src`.  
  7. Success sets **`type` + `summary`** fields consumed by tooltip renderer (`1438–1439`).  
  8. Failure displays `"Analysis unavailable."` (`1442`).

- **B. Deep crawl analysis (`POST /api/v1/analyze-page`)**  
  1. Server validates URL + Gemini API key presence (`1967–1974`).  
  2. `crawlPageContent` extracts textual corpus (`1977`).  
  3. Builds multilingual instruction via first segment of `userLanguage` (`1983–1988`).  
  4. Issues Gemini request with tools/functionDeclarations (`1991–2047`).  
  5. Parses structured JSON args — fallback raw text path if model replies conversationally (`2061–2065`).  
  6. Returns JSON payload with derived metadata (`2082+`).  
  7. **Client wiring**: confirm whether side panel/devtools harness calls this — absence in extension grep implies experimental/server-only usage currently.

- **C. Post-save AI enrichment (`analyzeAndUpdateDocument`)**  
  - Implemented but **comment-disabled** inside `/api/v1/save-url` success paths (`1389–1393`, `1497–1499`). When re-enabled, expect Firestore patches on saved items after Gemini evaluation.

**5. `saved-urls-updated` sync (post-refactor)**

1. Background **`chrome.storage` / Firestore sync layer** (depending on implementation branch) detects updated saved URL digest.
2. Broadcast **`saved-urls-updated`** to tabs (`coreEntry.js:2576`).
3. Listener asynchronously queries **`get-saved-urls`** via runtime message to obtain authoritative list (`2577–2580`).
4. `normalizeSavedUrlsResponse` ensures consistent schema when merging (`2581`).
5. `_savedUrlSet` merges remote URLs with optimistic/local inserts to avoid race regressions (`2582–2584`).
6. **Explicit non-goals** after refactor: **do not** call page-entry toast or duplicate save acknowledgment (`2592–2593` comments). User-visible feedback stays in **`showCopyToast`** paths tied directly to save gestures.

---

### Section 10 [REFERENCE]: AI System

| Topic | Detail |
|-------|--------|
| **Provider/model** | Google **Gemini** via REST (`gemini-2.5-flash` endpoint constant near top of `server/src/server.ts`) |
| **Auth** | API key on server (`GEMINI_API_KEY`) — `[REDACTED]` at rest |
| **CoreItem prompt path** | Intended fast classification for hover tooltip — wired through **`ai-analyze-url`** message; server parity **unverified** |
| **Page analysis prompt** | `/api/v1/analyze-page` builds **function-calling** schema (`analyze_page_content`) asking for title, key points, keywords, content_type with **multilingual output** derived from `userLanguage` prefix (`1965+`) |
| **Firestore writes** | Primary AI enrichment historically ties into save pipeline (`analyzeAndUpdateDocument` helper exists in server — check activation flags); ensure dead-code vs enabled paths before citing guaranteed behavior |
| **userLanguage** | Passed into `/api/v1/analyze-page`; mapped to human-readable language name for Gemini instructions |

**Operational notes**

- **Secret rotation**: Rotating `GEMINI_API_KEY` requires redeploying Cloud Run / Functions + updating local `.env` — no client-visible change.
- **Model swaps**: `GEMINI_API_URL` string constants control Flash vs Pro; evaluate cost/latency before switching — function-calling schema must remain compatible.
- **Failure semantics**: `/api/v1/analyze-page` returns **503** when key unset (`1972`) — clients should degrade gracefully (empty AI badges).
- **Privacy**: Crawl-based analysis transmits page text to Google Gemini — disclosure belongs in privacy policy / listing (`docs/privacy-policy*.html`).

**Prompt intent summaries** (non-verbatim)

- **Tooltip path** (intended): classify hovered asset/page quickly with compact **`type` + `summary`** suitable for ephemeral UI — blocked until server route exists.
- **Page path**: deeper summarization with bullet **key_points** + SEO-like **keywords** + coarse **`content_type`** enum — suited for future detail panels or knowledge cards.

**Environment variable matrix (server)**

| Variable | Role | Failure mode |
|----------|------|--------------|
| `GEMINI_API_KEY` | Authenticates Gemini REST calls | `/api/v1/analyze-page` returns **503**; crawl-only flows may still partially log warnings |
| `GOOGLE_APPLICATION_CREDENTIALS` | Points Firebase Admin SDK credentials | Firestore direct saves fail → `/api/v1/save-url` may fall back to local JSON depending on branch |
| `FIREBASE_STORAGE_BUCKET` | Targets screenshot bucket | Upload routines warn / noop — screenshots remain base64-only client-side |
| `PORT` | Binds Express locally | Overrides default **3000** — mismatch breaks README quickstart expectations |

Cloud deployments should mirror these keys via secret injection rather than plaintext Kubernetes YAML checked into git.

**Cost awareness**

- Gemini calls charge per token; crawl-heavy pages can accumulate input tokens quickly — monitor usage dashboards if `/api/v1/analyze-page` or re-enabled `analyzeAndUpdateDocument` traffic spikes (e.g., viral social traffic driving saves).
- Implement exponential backoff or per-user rate limits before exposing Deep Analysis buttons broadly — accidental infinite retry loops in client prototypes become expensive quickly at fleet scale.
- Cache crawl results server-side only after verifying licensing/residency constraints — storing arbitrary page text may trigger GDPR retention discussions independent of Firebase Auth locality.

---

### Section 11 [REFERENCE]: Critical Code Snippets

Section 11 intentionally mixes **curated excerpts** with pointers back to canonical sources. When the assistant pastes snippets into chat, prefer **`read_file`** with precise line ranges rather than trusting stale copies — MV3 service workers, Firestore rules, and CSP evolve quickly around release milestones like **`1.1.4`**.

**Snippet philosophy**

- **`manifest.prod.json`**: Only partially reproduced below — include full file via tooling when editing **`permissions`**, **`host_permissions`**, **`oauth2`**, **`web_accessible_resources`**, or CSP stanza because reviewers compare listing declarations byte-by-byte against packaged ZIPs.
- **`background.js`**: Three excerpts capture **(a)** side panel defaults, **(b)** keyboard shortcut routing + Electron placeholder ping, **(c)** AI proxy gap — combine with searches for **`fetch(`${KC_SERVER_URL}`)** to enumerate every outbound integration point (save-url upload, Drive token exchanges, etc.).
- **`coreEntry.js`**: Toast + saved-url excerpts illustrate **UX state machines** — full file still houses detector timers, screenshot pipelines, and clipboard retry stacks numbering thousands of lines — never paste wholesale into prompts.
- **`uiManager.js`**: Highlights demonstrate **Shadow DOM + animation coupling** — additional exports (`ensureCoreOverlay`, metadata tooltip builders) remain in-file only.
- **`server/.env.example`**: Shows non-secret placeholder guidance — production deployments must source secrets from vaults; avoid echoing `.env` contents into tickets.

**Security hygiene while copying**

- Replace live OAuth client IDs with `[REDACTED]` when exporting snippets **into public threads** even though Chrome OAuth clients are semi-public — pairing IDs with accidental PEM leaks equals exploit surface area.
- Gemini URLs embed API keys only on server-side fetch patterns — never replicate query-string secrets inside extension bundles.

#### `browser-extension/chromium/manifest.prod.json` (full structure — OAuth client ID redacted)

```json
{
  "manifest_version": 3,
  "name": "KickClip",
  "version": "1.1.4",
  "description": "Capture any web page, image, or content with Cmd+Shift+S. Save to folder or Drive. Auto-organized.",
  "permissions": [
    "storage", "downloads", "scripting", "tabs", "contextMenus",
    "windows", "sidePanel", "identity", "clipboardWrite", "cookies"
  ],
  "host_permissions": ["<all_urls>"],
  "commands": { "save-url": { "suggested_key": { "default": "Ctrl+Shift+S", "mac": "Command+Shift+S" },
      "description": "Save current URL or hovered image" } },
  "side_panel": { "default_path": "sidepanel.html" },
  "oauth2": {
    "client_id": "[REDACTED — see GCP OAuth client for prod extension]",
    "scopes": [
      "openid", "email", "profile",
      "https://www.googleapis.com/auth/drive.file"
    ]
  },
  "action": { "default_title": "KickClip", "default_popup": "" }
}
```

*(Icons, CSP, `web_accessible_resources`, and other keys omitted here for brevity — fetch full file in repo.)*

#### `browser-extension/chromium/background.js` — `setPanelBehavior` block (`11:15:browser-extension/chromium/background.js`)

```javascript
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('Failed to set side panel behavior:', error));
```

#### `browser-extension/chromium/background.js` — `chrome.commands` handler excerpt (`285:333:browser-extension/chromium/background.js`)

```javascript
chrome.commands.onCommand.addListener((command) => {
  if (command === 'save-url') {
    if (!_cachedUserId) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs?.[0]?.id && tabs?.[0]?.windowId) {
          chrome.sidePanel.open({
            tabId: tabs[0].id,
            windowId: tabs[0].windowId,
          }).catch(() => {});
        }
      });
      return;
    }
    const timestamp = Date.now();
    const placeholderPayload = {
      url: 'about:blank',
      title: 'Loading...',
      timestamp: timestamp,
      saved_by: 'extension',
    };
    fetch('http://localhost:3001/pending-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(placeholderPayload),
    }).catch(() => {});
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0 && tabs[0]) {
        const tabId = tabs[0].id;
        const tabUrl = tabs[0].url || 'unknown';
        if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://') || tabUrl.startsWith('edge://') || tabUrl.startsWith('arc://')) {
          return;
        }
        chrome.tabs.sendMessage(tabId, { action: 'save-url' }, (response) => {
          if (chrome.runtime.lastError) {
            // injection retry logic continues...
```

#### `browser-extension/chromium/background.js` — `ai-analyze-url` proxy (`1349:1373:browser-extension/chromium/background.js`)

```javascript
if (request.action === 'ai-analyze-url') {
  const { url } = request;
  if (!url || typeof url !== 'string') {
    sendResponse({ success: false, error: 'Invalid payload' });
    return true;
  }
  fetch(`${KC_SERVER_URL}/api/v1/ai-analyze-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
    .then(async (res) => {
      if (!res.ok) {
        sendResponse({ success: false, error: `Server error ${res.status}` });
        return;
      }
      const data = await res.json();
      sendResponse({ success: true, data });
    })
    .catch((err) => {
      sendResponse({ success: false, error: err.message || 'Failed to fetch' });
    });
  return true;
}
```

#### `browser-extension/chromium/coreEntry.js` — full-page entry toast + hide (`153:240:browser-extension/chromium/coreEntry.js`)

```javascript
function showFullpageEntryToast() {
  try {
    chrome.storage.local.get('kickclipShortcut', (result) => {
      try {
        const raw = result?.kickclipShortcut || 'Ctrl+Shift+S';
        const isMac = navigator.platform.toUpperCase().includes('MAC') ||
          navigator.userAgent.includes('Mac');
        const display = isMac
          ? raw
              .replace(/MacCtrl/gi, '⌃')
              .replace(/Ctrl/gi, '⌘')
              .replace(/Command/gi, '⌘')
              .replace(/Shift/gi, '⇧')
              .replace(/Alt/gi, '⌥')
              .replace(/\+/g, '')
          : raw;
        const message = _kcUserReady
          ? `${display} to save this page`
          : `Press ${display} to start KickClip`;
        renderFullpageEntryToast(message);
      } catch (e) {}
    });
  } catch (e) {
    const fallback = _kcUserReady
      ? 'Press shortcut to save this page'
      : 'Press shortcut to start KickClip';
    try { renderFullpageEntryToast(fallback); } catch (_) {}
  }
}

function hideFullpageEntryToast() {
  if (_fullpageToastTimer !== null) {
    clearTimeout(_fullpageToastTimer);
    _fullpageToastTimer = null;
  }
  if (_fullpageToastEl) {
    _fullpageToastEl.remove();
    _fullpageToastEl = null;
  }
}
```

#### `browser-extension/chromium/coreEntry.js` — `saved-urls-updated` (`2576:2595:browser-extension/chromium/coreEntry.js`)

```javascript
if (request?.action === 'saved-urls-updated') {
  chrome.runtime.sendMessage({ action: 'get-saved-urls' }, (response) => {
    if (chrome.runtime.lastError) return;
    const entries = response?.urls;
    if (Array.isArray(entries)) {
      const normalized = normalizeSavedUrlsResponse(entries);
      _savedUrlSet = new Set([..._savedUrlSet, ...normalized]);
    }
    if (IS_IFRAME || window.self !== window.top) return;
    try {
      if (!_pageMetaInitialized) {
        _pageMetaInitialized = true;
        initPageLevelMetadata();
      }
      // UI re-trigger removed: saved-urls-updated should sync data only.
      // Save feedback is already handled by showCopyToast in save paths.
    } catch (e) {}
  });
  return false;
}
```

#### `browser-extension/chromium/uiManager.js` — full-page highlight + callback hook (`27:29:browser-extension/chromium/uiManager.js` + `820:877:browser-extension/chromium/uiManager.js`)

```javascript
export function setFullPageHideCallback(callback) {
  _fullPageHideCallback = typeof callback === 'function' ? callback : null;
}

export function showFullPageHighlight(isSaved = false) {
  try {
    const el = ensureFullPageOverlay();
    el.style.opacity = '1';
    updateFullPageHighlightClass(false);
    const w = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    const pagePathLength = updateBorderSvg('page', w, h, 4);
    if (!_pageAnimFrame) {
      startBorderAnimation('page', el, (id) => { _pageAnimFrame = id; }, pagePathLength);
    }
    if (_fullPageHideTimer !== null) {
      clearTimeout(_fullPageHideTimer);
    }
    _fullPageHideTimer = setTimeout(() => {
      _fullPageHideTimer = null;
      hideFullPageHighlight();
    }, 10000);
    return true;
  } catch (e) {
    return false;
  }
}

export function hideFullPageHighlight() {
  if (_fullPageHideTimer !== null) {
    clearTimeout(_fullPageHideTimer);
    _fullPageHideTimer = null;
  }
  const el = getKCShadowElement(FULLPAGE_OVERLAY_ID);
  if (el) {
    el.style.opacity = '0';
    el.classList.remove('shutter-success', 'shutter-error');
    if (_pageAnimFrame) {
      cancelAnimationFrame(_pageAnimFrame);
      _pageAnimFrame = null;
    }
  }
  if (_fullPageHideCallback) {
    try { _fullPageHideCallback(); } catch (_) {}
  }
}
```

#### `server/.env.example` (placeholders only)

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
```

---

### Section 12 [REFERENCE]: Pending Action Items

**Immediate (code)**

- [ ] **Reconcile `ai-analyze-url`**: Either implement `POST /api/v1/ai-analyze-url` on the deployed API or change `background.js` to call an existing endpoint (`analyze-page`?) with compatible payload — confirm with network traces.
- [ ] **Confirm Cloud Run revision** matches `server/` vs `functions/` sources actually deployed for DEV/PROD.
- [ ] **Clean git hygiene**: Track or remove untracked `docs/PROJECT_BRIEFING_20260423.md`.
- [ ] **Verify Gemini enablement**: `/api/v1/analyze-page` returns **503** when `GEMINI_API_KEY` unset — ensure secrets exist in Cloud Run for production AI features before promising customers summarization.
- [ ] **Re-enable or delete `analyzeAndUpdateDocument`**: Commented blocks in `/api/v1/save-url` (`1389–1393`, `1497–1499`) indicate intentional pause — decide whether post-save AI enrichment is still a roadmap item; dead code confuses operations audits.
- [ ] **Parity pass `functions/src/index.ts` vs `server/src/server.ts`**: Deployed API might originate from either — diff routes (`fetch-metadata` exists in compiled `functions/lib` output per repo grep) so drift causes subtle production-only bugs.

**Immediate (QA matrix — extension)**

| Surface | Minimum smoke |
|---------|----------------|
| Signed-out shortcut | Opens side panel; no uncaught service worker errors (`chrome://extensions` → service worker link). |
| Signed-in shortcut (top frame) | Save succeeds; optimistic card reconciles; toast unified (`72d7dae` behavior). |
| Iframe-heavy sites | Ensure iframe guardrails — saves should not silently fire from cross-origin child frames against design (`coreEntry.js` iframe checks). |
| Image hover | Clipboard attempts three-tier fetch → background relay → canvas (`README` architecture section mirrors this). |
| Drive destination | OAuth consent grants **`drive.file`** — verify uploads land under user-controlled folder (`kickclip_files` convention per README). |

**Post-Web-Store-approval**

- [ ] Update README install instructions from “pending” → live store link when published.
- [ ] Broadcast release notes to testers (zip + Web Store cohorts).
- [ ] Refresh screenshots / promo tiles if marketing assets predated Shadow DOM + purple toast styling — store listings with stale UI confuse reviewers.
- [ ] Post-mortem **OAuth consent screening**: if Google requests demo video for restricted scopes, capture a **≤2 minute** screen recording showing Drive permission prompt + successful upload + revocation path.

**Deferred / future**

- [ ] Deeper permission narrowing strategy (site-grained experimental modes).
- [ ] Electron parity testing if desktop client remains supported alongside extension-first workflows.
- [ ] Safari/Firefox packaging parity — folders exist (`browser-extension/firefox`, `safari`) but Chromium receives prod investment first.
- [ ] Automated regression harness for **`saved-urls-updated`** merge semantics — subtle race if Firestore returns partial datasets during offline periods.

**Incident response cheatsheet (copy when debugging live)**

1. **Auth suddenly fails after deploy**: First suspect **OAuth client ↔ extension ID mismatch** — `.pem` rotation or manifest key edits require GCP OAuth client Application ID updates (`DEPLOYMENT_INFO.md` narrative).
2. **Save reaches API but item missing in UI**: Inspect **`temp_id`** reconciliation path in `sidepanel.js` listeners + Firestore snapshot ordering.
3. **Gemini errors spike**: Check quota + model deprecation announcements — `GEMINI_API_URL` hardcodes **`gemini-2.5-flash`**; rotate model string deliberately with QA due to JSON schema differences.

---

### Section 13: Recent Session Highlights

```
- 3a2810e 2026-04-29 chore: bump version to 1.1.4 — release marker for store-bound build
- 72d7dae 2026-04-29 refactor: unify page-level feedback into toast system — UX consistency + fewer duplicate notifications
- 27729cd 2026-04-29 feat: enable side panel toggle on toolbar icon click — Chrome-standard side panel affordance
- 2c6b6ad 2026-04-28 chore: update manifest description for Chrome Web Store appeal — listing copy alignment
- 863bada 2026-04-28 chore: clean up redundant permissions for Chrome Web Store — policy hygiene
- 49321e9 2026-04-28 docs: remove outdated USAGE_GUIDE.md, integrate Usage into README — doc consolidation
- f13241b 2026-04-28 docs: rewrite README for Chrome Extension architecture — onboarding clarity
- cac3290 2026-04-28 docs: remove Instagram/Facebook OAuth section from README — accurate scope story
- a8c6eec 2026-04-28 docs: add privacy policy pages for Chrome Web Store — legal prerequisite URLs
- f1636ae 2026-04-27 chore(manifest): prepare prod manifest for Chrome Web Store — packaging readiness
- 69732ec 2026-04-27 chore(scripts): add user profile backfill migration — data hygiene tooling
- 0afa1bb 2026-04-27 feat(auth): upsert user profile on sign-in — v1.1.1 profile completeness
- f6ab711 2026-04-27 feat(firestore): allow user parent document access — rules alignment with profile doc
- d42a55a 2026-04-27 chore(release): bump version to 1.1.0 — milestone tagging
- 75c1058 2026-04-26 fix(upload): wait for actual Save As completion before success toast — prevents false-positive UX
- 8fd1ca7 2026-04-26 feat(drive): Drive UI integration with My Drive root — cloud destination UX
- 998537b 2026-04-26 feat(drive): Drive infrastructure — background handlers + picker flow — foundational Drive enablement
- 76ffbdd 2026-04-26 fix(upload): strip emoji and unicode controls from filenames — filesystem compatibility
- 518f57b 2026-04-26 fix(csp): allow https: in connect-src — CDN fetch unblock follow-up
- 95e81a1 2026-04-26 feat(oauth): add drive.file scope + generic OAuth token handler — least-privilege cloud saves
- f2f36ea 2026-04-26 refactor(oauth): remove gmail.readonly scope — scope reduction for approvals
- cb5c9e1 2026-04-26 feat(upload): dual-path local save with popup-window picker — local saves UX
- b898faa 2026-04-26 feat(sidepanel): add upload icon + destination chooser popover — UI scaffold for destinations
- d125a4a 2026-04-25 docs: add secrets inventory and recovery playbook — operational safety net
- fd98d78 2026-04-25 feat(build): add user-facing install package for preview distribution — zip beta channel
- 4b9d3fb 2026-04-24 docs: log Phase 3+4 deployment info — Shadow DOM + rebrand operational notes
- 4e67837 2026-04-24 feat(extension): rebrand internal identifiers Blink -> KickClip — consistency pass
- ca6dc9a 2026-04-24 feat(extension): migrate all UI into closed Shadow DOM — CSS isolation fix
- 58f38ea 2026-04-24 feat: clipboard copy + OptimisticCard performance + tempId matching — core save-loop quality
- 6df7b9f 2026-04-21 feat: migrate to new 4-category taxonomy — foundational classification schema
- 6fb5c58 2026-04-21 docs: add DEPLOYMENT_INFO.md with recovery playbook — ops chronicle baseline
- f8089a0 (historical) Initial commit: Phase A complete — repo bootstrap snapshot
```

---

_End of briefing — maintain alongside `DEPLOYMENT_INFO.md`, `README.md`, and `docs/SECRETS_INVENTORY.md` for operational continuity._
