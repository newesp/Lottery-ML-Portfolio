# Automation and GitHub Pages Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reproducible CI, scheduled verified data refresh, static web build, and automatic GitHub Pages deployment for `newesp/Lottery-ML-Portfolio`.

**Architecture:** Pull requests run Python and web quality gates without external writes. A unified Pages workflow builds on pushes and, on schedule/manual dispatch, runs the same ingestion/experiment/artifact commands before building; verified changes are committed by the Actions bot. Pages deployment uses official upload/deploy actions and the static `web/out` directory.

**Tech Stack:** GitHub Actions, Python 3.12, Node.js 22, npm, GitHub Pages.

## Global Constraints

- Schedule: Monday and Thursday 21:15 Asia/Taipei, represented as `15 13 * * 1,4` UTC.
- Manual execution uses `workflow_dispatch`.
- Failed fetch, parse, validation, experiment, schema, test, or build must not publish new data or Pages content.
- Workflow permissions are least-privilege: PR CI read-only; Pages workflow uses contents/pages/id-token write only where required.
- No Vercel files, secrets, runtime API, cron service, or database.

---

### Task 1: Add Pull Request Quality Gates

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `scripts/check-artifacts.py`

**Interfaces:**
- Python job runs install, pytest, Ruff, mypy, and artifact validation.
- Web job runs `npm ci`, lint, typecheck, Vitest, and static build.

- [ ] Add a local artifact-check command and fixture test proving hash/schema failures return non-zero.
- [ ] Implement read-only PR/push CI with dependency caching and explicit timeouts.
- [ ] Validate workflow YAML syntax and run every underlying command locally.
- [ ] Commit with `ci: add Python and web quality gates`.

### Task 2: Add Scheduled Verified Refresh

**Files:**
- Create: `.github/workflows/pages.yml`

**Interfaces:**
- Triggers: push to `main`, schedule `15 13 * * 1,4`, and `workflow_dispatch`.
- Refresh commands: full-range ingestion, development/holdout commands only when data changes, and `artifacts sync-web`.

- [ ] Implement checkout with full history, Python 3.12, Node 22, npm/Python caches, and current Taipei year calculation.
- [ ] On schedule/manual, run ingestion before any Git write; use `git diff --quiet -- data` to decide whether experiments/artifacts need regeneration.
- [ ] Commit verified changes with bot identity and `git push`; include data, manifests, experiment artifacts, and web public artifacts only.
- [ ] Ensure unchanged ingestion makes no commit.
- [ ] Commit with `ci: schedule verified lottery refresh`.

### Task 3: Build and Deploy GitHub Pages

**Files:**
- Modify: `.github/workflows/pages.yml`
- Modify: `web/next.config.ts`

**Interfaces:**
- Build uses `NEXT_PUBLIC_BASE_PATH=/Lottery-ML-Portfolio` on GitHub Pages and empty base path locally.
- Uploads `web/out` with `actions/upload-pages-artifact`; deploys using `actions/deploy-pages` in a protected `github-pages` environment.

- [ ] Test local empty base path and production repository base path builds.
- [ ] Add Pages permissions, concurrency, prepare/build artifact job, and separate deploy job.
- [ ] Verify generated HTML asset URLs contain the correct repository base path.
- [ ] Commit with `ci: deploy static portfolio to GitHub Pages`.

### Task 4: Release Verification and Push

**Files:**
- Modify: `README.md`
- Create: `docs/release-checklist.md`

**Interfaces:**
- Public URL target: `https://newesp.github.io/Lottery-ML-Portfolio/`.

- [ ] Run final Python tests/Ruff/mypy, artifact validation, web tests/lint/typecheck/build, secret scan, and `git diff --check` from final HEAD.
- [ ] Review all commits and ensure worktree is clean; verify no Vercel/GSAP/runtime-server files.
- [ ] Push `codex/data-foundation` to `origin`, then merge or fast-forward the approved content to the repository default branch only when repository state permits the authorized release workflow.
- [ ] Inspect GitHub Actions runs and Pages settings; enable Pages source `GitHub Actions` if repository configuration requires it.
- [ ] Smoke-test the deployed URL at desktop/mobile widths and record any external prerequisite that cannot be completed with repository permissions.
- [ ] Update README with public URL and release commands; commit and push the final verified revision.
