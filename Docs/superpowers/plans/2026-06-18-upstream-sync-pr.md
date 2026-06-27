# Upstream Sync PR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only upstream sync workflow that checks `Pretic/PakrPre/main` and creates a GitHub pull request instead of directly modifying `main`.

**Architecture:** Cloudflare Pages Functions expose sync endpoints that only trigger and observe GitHub Actions. GitHub Actions performs the actual git fetch, merge dry run, branch push, and PR creation inside GitHub's clean repository environment. Cloudflare deployment remains tied to normal `main` updates, so sync does not deploy unless the PR is merged.

**Tech Stack:** Cloudflare Pages Function in `_worker.js`, GitHub Actions YAML, static frontend JavaScript in `index.html`, Node assertion scripts in `Scripts/`.

---

### Task 1: Add Backup And Verification Guardrails

**Files:**
- Existing backup: `backups/PakrPre-local-before-upstream-sync-20260618-210022.zip`
- Modify: `.gitignore`
- Modify: `Scripts/verify_pakrpre_alignment.mjs`
- Modify: `Scripts/verify_templates.mjs`

- [ ] Confirm the backup zip exists before code changes continue.
- [ ] Extend verification scripts to check for the sync workflow, Worker sync routes, frontend sync controls, and admin-only protections.
- [ ] Run `node Scripts\verify_pakrpre_alignment.mjs` and `node Scripts\verify_templates.mjs`.

### Task 2: Add GitHub Action For PR-Based Sync

**Files:**
- Create: `.github/workflows/sync-upstream.yml`

- [ ] Add `workflow_dispatch` inputs: `sync_id`, `mode`, `upstream_repo`, `upstream_branch`.
- [ ] Set permissions to `contents: write`, `pull-requests: write`, and `actions: read`.
- [ ] Validate `upstream_repo` against an allowlist containing `Pretic/PakrPre`.
- [ ] In check mode, fetch upstream and write ahead/behind/conflict details to the job summary.
- [ ] In PR mode, merge upstream into a new `sync/upstream-*` branch, push it, and create a PR with `gh pr create`.
- [ ] If a merge conflict occurs, abort the merge, write conflict files to the summary, and fail the run without pushing.

### Task 3: Add Worker Sync API

**Files:**
- Modify: `_worker.js`

- [ ] Route `POST /sync/check`, `POST /sync/start`, `GET /sync/status`, and `GET /sync/logs`.
- [ ] Require `ADMIN_PASSWORD` for sync endpoints even if other routes would allow anonymous use.
- [ ] Trigger `sync-upstream.yml` with a generated `sync_id`.
- [ ] Reuse existing GitHub API helper, but keep sync workflow name and upstream repo fixed or allowlisted.
- [ ] Return status, progress, run id, conclusion, failed step, and PR URL when available from logs.

### Task 4: Add Frontend Admin Controls

**Files:**
- Modify: `index.html`

- [ ] Add a nav icon button for repository sync.
- [ ] Add a compact sync panel with check, create PR, cancel/close, status, progress, and log display.
- [ ] Implement `startSync(mode)`, `pollSyncStatus()`, `fetchSyncLogs()`, and status rendering.
- [ ] Do not expose arbitrary upstream repo input in the UI.

### Task 5: Verify And Document Limits

**Files:**
- Modify: `Docs/guide/deploy.md` or `README.md` if a brief note is needed.

- [ ] Run Node verification scripts.
- [ ] Confirm no actual GitHub push or Cloudflare deployment was performed from this local session.
- [ ] Document that Cloudflare deploys only after the sync PR is merged into `main`.
