# Web Case Study Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished Traditional Chinese, responsive, statically exported case study and lightweight Experiment Playground that reads only versioned public artifacts.

**Architecture:** A Next.js App Router application uses server-rendered content routes and small client islands for filtering/charts. Artifact schemas are validated at build time; unsupported or missing data fails the production build. CSS variables, semantic HTML, native controls, and ECharts provide a professional ML-first UI without GSAP.

**Tech Stack:** Next.js, React, TypeScript, Apache ECharts, Vitest, Testing Library, axe-core, CSS.

## Global Constraints

- Static export only; no runtime server, Python API, database, live fetch, or browser training.
- v1 copy is Traditional Chinese with English ML terms.
- No GSAP, scroll hijacking, pinned storytelling sections, glassmorphism-heavy dashboard, or fake live controls.
- Required viewports: 375, 768, 1024, and 1440 px.
- Touch targets are at least 44×44 CSS pixels and all controls are keyboard reachable.
- Every chart has a semantic text/table fallback.

---

### Task 1: Scaffold Static Next.js and Design Tokens

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/next.config.ts`, `web/eslint.config.mjs`, `web/vitest.config.ts`
- Create: `web/app/layout.tsx`, `web/app/globals.css`, `web/app/page.tsx`
- Create: `web/components/site-header.tsx`, `web/components/site-footer.tsx`
- Test: `web/components/site-shell.test.tsx`

**Interfaces:**
- Produces `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`; build output is `web/out`.

- [ ] Write shell tests for skip link, navigation labels, current route semantics, and disclosure text that rejects winning-number claims.
- [ ] Scaffold App Router with `output: "export"`, `images.unoptimized: true`, repository-aware `basePath`, strict TypeScript, and pinned dependency versions.
- [ ] Implement tokens for ink, paper, signal blue, restrained amber, typography scale, spacing, borders, focus ring, reduced motion, and four responsive breakpoints.
- [ ] Run tests, lint, typecheck, and static build.
- [ ] Commit with `build: scaffold static portfolio web`.

### Task 2: Validate and Load Versioned Artifacts

**Files:**
- Create: `web/lib/artifact-schema.ts`, `web/lib/artifacts.ts`, `web/lib/format.ts`
- Test: `web/lib/artifacts.test.ts`

**Interfaces:**
- Produces `loadPortfolioArtifact()`, `loadExperimentMatrix()`, and `loadFeatureCatalog()` with explicit TypeScript return types.

- [ ] Test valid payloads, missing files, unsupported schema, non-finite metrics, and unknown model/feature identifiers.
- [ ] Implement build-time JSON loading from `public/artifacts`; do not use network fetch for server components.
- [ ] Render actionable error text in development and throw during production build.
- [ ] Run tests/typecheck/build and commit with `feat: validate portfolio artifacts at build time`.

### Task 3: Build Case Study Routes

**Files:**
- Create: `web/app/data/page.tsx`, `web/app/features/page.tsx`, `web/app/evaluation/page.tsx`, `web/app/findings/page.tsx`, `web/app/reproducibility/page.tsx`
- Create: `web/components/metric-card.tsx`, `web/components/pipeline.tsx`, `web/components/disclosure.tsx`, `web/components/artifact-link.tsx`
- Create: `web/content/zh-TW/case-study.ts`
- Test: `web/app/routes.test.tsx`

**Interfaces:**
- Produces six static routes: `/`, `/data`, `/features`, `/experiments`, `/evaluation`, `/findings`, `/reproducibility`.

- [ ] Test each route's unique heading, evidence links, disclosure, and absence of predictive marketing language.
- [ ] Implement landing narrative for problem framing, trusted data, leakage-safe features, CV/holdout separation, baseline comparison, result, and lessons.
- [ ] Render real dataset hash/count/range, correction audit, fold boundaries, feature-set definitions, model preprocessing, uncertainty, and reproducibility metadata from artifacts.
- [ ] Run tests/typecheck/build and commit with `feat: build ML case study routes`.

### Task 4: Build Experiment Playground

**Files:**
- Create: `web/app/experiments/page.tsx`
- Create: `web/components/experiment-playground.tsx`, `web/components/experiment-chart.tsx`, `web/components/experiment-table.tsx`, `web/components/filter-panel.tsx`
- Test: `web/components/experiment-playground.test.tsx`

**Interfaces:**
- Controls: area, model, feature set, development fold summary, and comparison run.
- URL state: `area`, `model`, `features`, and `compare` search parameters.

- [ ] Test default selection, filtering, invalid query fallback, compare mode, empty state, keyboard operation, and table/chart agreement.
- [ ] Implement client-side filtering over precomputed runs only. Controls say `Load result` and `Compare`; never `Train` or `Predict`.
- [ ] Render baseline line, fold values, mean±SD, holdout marker, calibration summary, and accessible table fallback with ECharts.
- [ ] Make the filter panel inline on desktop and a native disclosure panel on mobile.
- [ ] Run tests/typecheck/build and commit with `feat: add precomputed experiment playground`.

### Task 5: Visual, Responsive, and Accessibility QA

**Files:**
- Modify: `web/app/globals.css`
- Create: `web/tests/accessibility.test.tsx`
- Create: `docs/web-design.md`

**Interfaces:**
- Produces verified screenshots at 375×812, 768×1024, 1024×768, and 1440×1000 for `/` and `/experiments`.

- [ ] Run axe tests for major routes and fix serious/critical findings.
- [ ] Run production static build and serve `web/out` locally.
- [ ] Inspect every required viewport for overflow, clipped labels, focus visibility, navigation, chart resize, disclosure controls, and table scrolling.
- [ ] Verify reduced-motion behavior and 44×44 targets.
- [ ] Document visual direction and component rules; commit with `style: complete responsive accessibility QA`.
