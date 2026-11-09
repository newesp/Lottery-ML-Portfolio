# 文件導覽

本目錄服務兩種主要的閱讀需求：

- 希望在幾分鐘內掌握系統架構與工程嚴謹度的技術團隊與審閱者。
- 希望透過真實案例深入了解時間序列驗證與防洩漏設計的開發者。

## 核心文件

- [系統設計](system-design.md)
- [ML 方法與評估](ml-methodology.md)
- [Model Card](model-card.md)
- [資料管線與操作方式](data-pipeline.md)
- [前瞻盲測帳本規格](specs/forward-test-ledger.md)
- [Holdout v1.1 勘誤說明](specs/holdout-v1.1-erratum.md)

## 規劃與延伸主題

### 入門與導覽

- `learning-path.md`：建議閱讀順序。
- `glossary.md`：英文技術名詞與繁體中文對照說明。

### 資料工程（Data）

- `data/data-source.md`
- `data/ingestion-and-snapshots.md`
- `data/validation-and-cleaning.md`
- `data/data-contract.md`

### 機器學習（Machine Learning）

- `ml/problem-formulation.md`
- `ml/feature-engineering.md`
- `ml/preprocessing.md`
- `ml/model-selection.md`
- `ml/hyperparameter-tuning.md`
- `ml/time-series-cross-validation.md`
- `ml/evaluation-metrics.md`

### 實驗與可重現性（Experiments & Reproducibility）

- `experiments/experiment-protocol.md`
- `experiments/artifact-schema.md`
- `experiments/reproducibility.md`

### 前端展示（Web）

- `web/information-architecture.md`
- `web/responsive-design.md`

### 架構決策紀錄（ADR）

- `decisions/ADR-001-static-experiment-matrix.md`
- `decisions/ADR-002-expanding-window-validation.md`
- `decisions/ADR-003-model-scope.md`
- `decisions/ADR-004-no-gsap-in-v1.md`
- `decisions/ADR-005-versioned-data-snapshots.md`
- `decisions/ADR-006-zh-tw-first-localization.md`

每篇方法論文件均涵蓋：直覺概念、數學定義、專案實作細節、常見陷阱、結果判讀方式，以及對應的程式碼位置與英文檢索關鍵字。
