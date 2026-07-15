# Lottery ML Portfolio Delivery Roadmap

> **For agentic workers:** Each phase requires its own detailed implementation plan before implementation. Execute phases in dependency order; do not treat this roadmap as a substitute for a task-level plan.

**Goal:** Deliver a GitHub Pages portfolio that demonstrates a reproducible, leakage-safe ML workflow through a Traditional Chinese case study and a precomputed interactive experiment explorer.

**Architecture:** Python owns ingestion, validation, feature generation, model evaluation, and versioned artifacts. A statically exported Next.js application reads only validated artifacts. GitHub Actions schedules data refresh and publishes the static site to GitHub Pages.

**Tech Stack:** Python 3.11+, scikit-learn, LightGBM, pandas, pytest, Ruff, mypy; Next.js App Router, TypeScript, Apache ECharts; GitHub Actions and GitHub Pages.

## Global Constraints

- Lottery outcomes are random; describe results as an ML process case study, never as a credible winning-number service.
- Every feature for draw `t` must use only information strictly earlier than `t`.
- Development uses expanding-window Time Series Cross Validation for 2018–2023; dates from 2024 onward remain a locked temporal holdout until the selection protocol is frozen.
- Python and the web exchange versioned JSON/CSV artifacts only; the web must not import Python code or train models at runtime.
- Raw snapshots are immutable. A failed fetch or validation must never replace the last verified canonical dataset.
- v1 is Traditional Chinese with English technical terms and has no GSAP dependency.
- GitHub Pages is the only v1 hosting target. No Vercel configuration or runtime service is required.

---

## Delivery Sequence

### Phase 1 — Data Foundation

Deliver the Python package foundation, NFD year-page ingestion, parser fixtures, validation gates, immutable raw snapshots, manifests, canonical dataset publication, and a local CLI.

**Exit gate:** A fixture-backed integration test proves that a valid fetch creates a content-addressed snapshot and canonical dataset, while invalid or historically mutated input leaves the verified dataset unchanged.

Detailed plan: `docs/superpowers/plans/2026-07-15-data-foundation.md`

### Phase 2 — Leakage-Safe Features

Deliver the candidate-row representation for Area 1 and Area 2, four versioned feature sets, and tests proving temporal boundaries and draw grouping.

**Depends on:** Phase 1 canonical draw schema.

**Exit gate:** Feature matrices are deterministic, schema-validated, and no row for draw `t` contains information from `t` or later.

### Phase 3 — Time-Series Evaluation Core

Deliver Uniform, Rolling Frequency, and Shuffled History baselines; Logistic Regression, Random Forest, and LightGBM pipelines; the six expanding-window folds; bounded hyperparameter search; probability/ranking metrics; multi-seed aggregation; and locked-holdout enforcement.

**Depends on:** Phase 2 feature contracts.

**Exit gate:** Reproducible CV reports compare every selected model and feature set against Uniform without reading holdout targets during selection.

### Phase 4 — Experiment Artifact Contract

Deliver run IDs, config/environment capture, fold and holdout result schemas, keyed prediction output, summary generation, draw-level paired bootstrap intervals, and artifact validation.

**Depends on:** Phase 3 evaluation outputs.

**Exit gate:** A single command produces a self-contained, schema-valid experiment directory that can be copied into the web app without importing Python.

### Phase 5 — Case Study Web v1

Deliver the static Next.js application, Traditional Chinese content, responsive navigation, case-study routes, Experiment Playground filters/comparison, ECharts visualizations with accessible table fallbacks, and explicit loading/empty/error states.

**Depends on:** Phase 4 public artifact schema. Content shell and design tokens may start earlier, but data-bound components must use the approved schema.

**Exit gate:** Static export passes at 375, 768, 1024, and 1440 px; keyboard paths and artifact failure states are verified.

### Phase 6 — Research Extensions and Learning Docs

Deliver statistical randomness checks and clearly separated decision-analysis demonstrations, plus system design, learning path, glossary, leakage guide, evaluation guide, and reproducibility documentation.

**Depends on:** Phases 1–4 for factual outputs. Documentation structure may begin earlier.

**Exit gate:** A newcomer can trace source data to displayed findings and can identify what each ML method does, why it is used, and where its limitations apply.

### Phase 7 — GitHub Automation and Pages Release

Deliver PR quality gates, scheduled ingestion at Monday/Thursday 21:15 Asia/Taipei, manual dispatch, verified-change commits, artifact rebuild rules, static export, GitHub Pages deployment, and post-deploy smoke checks.

**Depends on:** Phase 1 ingestion CLI, Phase 4 artifact CLI, and Phase 5 production build.

**Exit gate:** A clean main-branch workflow publishes the site automatically; a validation failure cannot publish new data; no Vercel configuration exists.

## Recommended Milestones

1. **M1 — Trusted data:** Phase 1 complete.
2. **M2 — Reproducible ML:** Phases 2–4 complete with development CV and frozen selection protocol.
3. **M3 — Reviewable portfolio:** Phase 5 complete using validated precomputed artifacts.
4. **M4 — Public release:** Phases 6–7 complete and GitHub Pages verified.

## Plan Authoring Rule

Before starting Phases 2–7, write a separate detailed plan under `docs/superpowers/plans/` with exact paths, interfaces, test-first steps, commands, expected outcomes, and commit boundaries. If an approved schema changes, update downstream plans before implementation.
