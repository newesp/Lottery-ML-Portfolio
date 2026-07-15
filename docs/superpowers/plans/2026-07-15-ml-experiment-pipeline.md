# ML Experiment Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the verified canonical draw history into leakage-safe candidate-row features, expanding-window CV comparisons, a frozen model-selection protocol, locked-holdout results, and versioned artifacts for the static web application.

**Architecture:** Python converts each draw into Area 1 and Area 2 candidate rows whose features use only earlier draws. Evaluation splits by draw ID and calendar year, joins probabilities and targets by `(draw_id, area, number)`, and writes schema-versioned JSON artifacts. Holdout evaluation consumes a committed selection protocol; it never performs model or hyperparameter selection.

**Tech Stack:** Python 3.12+, NumPy, pandas, scikit-learn, LightGBM, pytest, Ruff, mypy.

## Global Constraints

- Candidate features for draw `t` may use only draws with `draw_date < t`.
- Development folds are expanding windows ending in validation years 2018–2023.
- Dates from 2024-01-01 onward are a locked temporal holdout.
- Area 1 has 38 candidate rows and six positives per draw; Area 2 has eight candidate rows and one positive.
- Logistic Regression alone receives `StandardScaler`, fit inside each fold.
- Random Forest and LightGBM use seeds `17`, `42`, and `2026`.
- Selection uses development CV only; holdout metrics never change the committed protocol.
- Every probability/target join uses `(draw_id, area, number)`, never DataFrame row order.

---

### Task 1: Add ML Dependencies and Versioned Configuration

**Files:**
- Modify: `pyproject.toml`
- Create: `configs/features/v1.json`
- Create: `configs/experiments/development-v1.json`
- Create: `configs/experiments/holdout-v1.json`
- Test: `tests/experiments/test_config.py`

**Interfaces:**
- Produces: validated JSON configs with schema `1.0.0`, feature windows `[3,5,10,20,50,100,200]`, seeds `[17,42,2026]`, CV years `2018..2023`, and holdout start `2024-01-01`.

- [ ] Write tests that load each config, assert exact required keys, reject unknown keys, and assert the holdout start is later than every CV validation year.
- [ ] Run `python -m pytest tests/experiments/test_config.py -q`; expect import/config-loader failure.
- [ ] Add `numpy>=2.1,<3`, `pandas>=2.2,<3`, `scikit-learn>=1.6,<2`, and `lightgbm>=4.5,<5`; implement `src/lottery_ml/experiments/config.py` with frozen config dataclasses and `load_experiment_config(path: Path) -> ExperimentConfig`.
- [ ] Run focused tests, Ruff, and mypy; expect all pass.
- [ ] Commit with `build: add versioned ML experiment config`.

### Task 2: Build Leakage-Safe Candidate Features

**Files:**
- Create: `src/lottery_ml/features/__init__.py`
- Create: `src/lottery_ml/features/schema.py`
- Create: `src/lottery_ml/features/builder.py`
- Test: `tests/features/test_builder.py`
- Test: `tests/features/test_leakage.py`

**Interfaces:**
- Consumes: `Sequence[DrawRecord]` and `FeatureConfig`.
- Produces: `build_candidate_rows(draws, config) -> pandas.DataFrame` with key columns `draw_id`, `draw_date`, `area`, `number`, `target`, plus versioned feature columns.
- Produces: `feature_columns(feature_set: str, config: FeatureConfig) -> tuple[str, ...]` for `frequency`, `frequency_gap`, `temporal_context`, and `full`.

- [ ] Write a three-draw fixture test asserting 38+8 rows per draw, six/one positives, stable keys, and exact pre-draw lifetime/rolling counts.
- [ ] Write a leakage test that changes draw `t` and all later targets, rebuilds features, and asserts every feature row through `t` is byte-for-byte unchanged.
- [ ] Run focused tests; expect missing feature module.
- [ ] Implement one chronological pass maintaining per-area counts, occurrence indices, rolling deques, exponentially weighted counts, previous-draw context, candidate encoding, and calendar context. Update state only after emitting all candidates for the current draw.
- [ ] Define feature sets as ordered tuples; `full` must be the union of all implemented features without duplicate names.
- [ ] Run focused/full tests, Ruff, and mypy.
- [ ] Commit with `feat: build leakage-safe candidate features`.

### Task 3: Implement Draw-Level Temporal Splits and Metrics

**Files:**
- Create: `src/lottery_ml/evaluation/__init__.py`
- Create: `src/lottery_ml/evaluation/splits.py`
- Create: `src/lottery_ml/evaluation/metrics.py`
- Test: `tests/evaluation/test_splits.py`
- Test: `tests/evaluation/test_metrics.py`

**Interfaces:**
- Produces: `ExpandingYearFold(train_end_year: int, validation_year: int)` and `development_folds() -> tuple[ExpandingYearFold, ...]` for six folds.
- Produces: `split_candidate_rows(frame, fold) -> tuple[pd.DataFrame, pd.DataFrame]` preserving complete draw groups.
- Produces: `evaluate_predictions(targets, predictions, *, area) -> MetricSummary` after one-to-one key validation.

- [ ] Test exact fold boundaries, `train.max < validation.min`, no overlapping draw IDs, 46 rows per complete draw, and exclusion of 2024+ from all CV folds.
- [ ] Test theoretical Uniform expectations, Area 1 hits/Precision@6/Recall@6/lift, Area 2 Top-1/lift, Brier score, log loss, and rejection of shuffled/missing/duplicate prediction keys.
- [ ] Run focused tests; expect missing modules.
- [ ] Implement key-safe splitting and metric aggregation per draw. Probability arrays must be formed only after an explicit one-to-one merge on all three key columns.
- [ ] Run focused/full tests, Ruff, and mypy.
- [ ] Commit with `feat: add temporal splits and keyed metrics`.

### Task 4: Add Baselines and Trainable Model Pipelines

**Files:**
- Create: `src/lottery_ml/models/__init__.py`
- Create: `src/lottery_ml/models/baselines.py`
- Create: `src/lottery_ml/models/pipelines.py`
- Test: `tests/models/test_baselines.py`
- Test: `tests/models/test_pipelines.py`

**Interfaces:**
- Produces: `predict_uniform(frame)`, `predict_rolling_frequency(frame)`, and `predict_shuffled_history(frame, seed)` returning keyed probability frames.
- Produces: `build_estimator(model_name, params, seed) -> sklearn-compatible estimator` for `logistic_regression`, `random_forest`, and `lightgbm`.

- [ ] Test Uniform sums to six/one per draw, rolling probabilities use prior-only features, shuffled scores preserve each draw's score multiset, and every baseline returns unique keys.
- [ ] Test Logistic Regression contains `StandardScaler` inside a `Pipeline`; tree models contain no scaler; identical seeds reproduce probabilities.
- [ ] Run focused tests; expect missing modules.
- [ ] Implement probability normalization and bounded model factories. Use `class_weight=None`; do not calibrate or ensemble in v1.
- [ ] Run focused/full tests, Ruff, and mypy.
- [ ] Commit with `feat: add lottery baselines and model pipelines`.

### Task 5: Run Development Matrix and Write Artifacts

**Files:**
- Create: `src/lottery_ml/experiments/schema.py`
- Create: `src/lottery_ml/experiments/runner.py`
- Create: `src/lottery_ml/experiments/artifacts.py`
- Modify: `src/lottery_ml/cli.py`
- Test: `tests/experiments/test_runner.py`
- Test: `tests/experiments/test_artifacts.py`

**Interfaces:**
- Produces: `run_development_matrix(draws, config) -> DevelopmentReport` covering two areas, four feature sets, three trainable models, and three baselines.
- Produces CLI: `lottery-ml experiments development --root . --config configs/experiments/development-v1.json`.
- Writes: `artifacts/experiments/development-v1.json` and `artifacts/summaries/development-v1.json` with data hash, config hash, package versions, commit, folds, seeds, timings, per-fold metrics, mean, and standard deviation.

- [ ] Test a reduced two-fold config end-to-end with fixed data and assert deterministic run IDs, complete fold coverage, key-safe metrics, and schema validation.
- [ ] Test artifact writer rejects NaN/Infinity, missing folds, duplicate run IDs, and unsupported schema versions.
- [ ] Run focused tests; expect missing runner/artifact modules.
- [ ] Implement bounded hyperparameter candidates: Logistic `C=[0.1,1.0]`; Random Forest two configs varying `max_depth`/`min_samples_leaf`; LightGBM two configs varying `num_leaves`/`learning_rate`. Select each model's params by mean development primary metric, breaking ties by lower variance then stable config ID.
- [ ] Add CLI JSON status output and safe errors.
- [ ] Run reduced tests, then the full development command on the verified 1,927-draw dataset.
- [ ] Commit code/config/artifacts with `feat: add reproducible development experiment matrix`.

### Task 6: Freeze Selection Protocol and Evaluate Locked Holdout

**Files:**
- Create: `configs/experiments/selection-v1.json`
- Create: `src/lottery_ml/evaluation/bootstrap.py`
- Modify: `src/lottery_ml/experiments/runner.py`
- Modify: `src/lottery_ml/cli.py`
- Test: `tests/evaluation/test_bootstrap.py`
- Test: `tests/experiments/test_holdout.py`

**Interfaces:**
- Consumes committed `selection-v1.json` containing selected feature set, model, params, seeds, selection metric, development artifact hash, and holdout start.
- Produces CLI: `lottery-ml experiments holdout --root . --selection configs/experiments/selection-v1.json`.
- Writes: `artifacts/experiments/holdout-v1.json` and `artifacts/summaries/portfolio-v1.json`.

- [ ] Test holdout rows never enter fitting/tuning, selection hash mismatch fails closed, and predictions cover each holdout draw exactly once per candidate.
- [ ] Test paired draw-level bootstrap with 10,000 resamples and seed `2026`, including deterministic confidence intervals and identical-model zero difference.
- [ ] Run focused tests; expect holdout runner/bootstrap failure.
- [ ] Commit `selection-v1.json` derived solely from the development artifact.
- [ ] Implement final fit on all pre-2024 rows, one locked evaluation on 2024+, Uniform comparison, calibration bins, timing, and paired bootstrap interval.
- [ ] Run holdout command once, validate artifacts, and never rewrite selection from holdout results.
- [ ] Commit with `feat: evaluate frozen model on locked holdout`.

### Task 7: Sync Public Artifacts and Explain Results

**Files:**
- Create: `src/lottery_ml/experiments/public.py`
- Create: `docs/ml-methodology.md`
- Create: `docs/model-card.md`
- Test: `tests/experiments/test_public_artifacts.py`

**Interfaces:**
- Produces CLI: `lottery-ml artifacts sync-web --root .`.
- Writes stable web payloads under `web/public/artifacts/` without training code dependencies.

- [ ] Test public payload includes dataset lineage, feature catalog, development matrix, selected protocol, holdout result, limitations, and only finite JSON values.
- [ ] Implement deterministic artifact reduction and schema version `1.0.0`.
- [ ] Document candidate-row framing, leakage controls, preprocessing, Time Series CV, holdout lock, metric interpretation, and negative-result conclusions in Traditional Chinese.
- [ ] Run full Python quality gate and artifact sync twice; second run must produce no Git diff.
- [ ] Commit with `docs: publish reproducible ML case study artifacts`.
