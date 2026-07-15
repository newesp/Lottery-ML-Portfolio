# 文件導覽

本目錄將同時服務兩種讀者：

- 想在數分鐘內理解專案價值的技術主管／ML 招募者。
- 希望從實作反向學習 ML 的專案作者與初學者。

## 目前文件

- [完整系統設計](superpowers/specs/2026-07-15-lottery-ml-portfolio-design.md)

## 實作階段將建立的文件

### 入門與導覽

- `learning-path.md`：建議閱讀順序。
- `glossary.md`：英文技術名詞與繁體中文解釋。

### Data

- `data/data-source.md`
- `data/ingestion-and-snapshots.md`
- `data/validation-and-cleaning.md`
- `data/data-contract.md`

### Machine Learning

- `ml/problem-formulation.md`
- `ml/feature-engineering.md`
- `ml/preprocessing.md`
- `ml/model-selection.md`
- `ml/hyperparameter-tuning.md`
- `ml/time-series-cross-validation.md`
- `ml/evaluation-metrics.md`

### Experiments and reproducibility

- `experiments/experiment-protocol.md`
- `experiments/artifact-schema.md`
- `experiments/reproducibility.md`

### Web

- `web/information-architecture.md`
- `web/responsive-design.md`

### Architecture Decision Records

- `decisions/ADR-001-static-experiment-matrix.md`
- `decisions/ADR-002-expanding-window-validation.md`
- `decisions/ADR-003-model-scope.md`
- `decisions/ADR-004-no-gsap-in-v1.md`
- `decisions/ADR-005-versioned-data-snapshots.md`
- `decisions/ADR-006-zh-tw-first-localization.md`

每篇 ML 教學文件都應包含：直覺解釋、必要數學、專案實作、常見錯誤、輸出解讀、對應程式碼及可繼續搜尋的英文關鍵字。
