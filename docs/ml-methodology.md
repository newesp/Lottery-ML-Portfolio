# ML 方法與評估

## 問題框架

每期展開成候選分類資料：第一區 1–38 各一列（6 positives），第二區 1–8 各一列（1 positive）。模型輸出候選 probability，第一區取 Top 6、第二區取 Top 1。

## Leakage 控制

第 `t` 期的 feature state 只含日期早於 `t` 的 draws。builder 先輸出整期 46 列與 target，再更新 frequency、gap、EWM、previous-draw context 與 co-occurrence state。測試會改寫當期及未來 target，要求當期以前 features 完全不變。

## Feature sets

- `frequency`：lifetime、rolling windows 3/5/10/20/50/100/200、EWM half-lives 5/10/20/50。
- `frequency_gap`：frequency 加 gap、log gap、平均 gap 與比例。
- `temporal_context`：frequency 加候選編碼、日曆、前一期與 hot/cold context。
- `full`：上述全部加 co-occurrence，共 46 個 features。

Logistic Regression 的 `StandardScaler` 位於每個 fold 的 sklearn Pipeline。樹模型不做 scaling。

## Time Series Cross Validation

使用 expanding-window folds，validation years 為 2018–2023；每個 fold training 截止於前一年。2024-01-01 之後完全不進入 tuning 或 selection。

比較 Logistic Regression、Random Forest、LightGBM，以及 Uniform、Historical Frequency（歷史累積頻率，artifact key 為 `rolling_frequency`）、Shuffled History。超參數先在 development folds 選擇，再跨 feature sets 比較。主要 selection metric 是 mean average hits，以較低 fold standard deviation 和穩定 config ID 破同分。

## Locked holdout

CV 選出第一區 Random Forest + `frequency_gap`，第二區 Random Forest + `full`。`selection-v1.json` 以 development artifact SHA 鎖定後，才對 2024+ 共 265 期執行三 seeds ensemble。

在 holdout-v1.1 中（修正 v1.0 固定選號之取樣偏差，改採解析期望值 $\mu_0 = k^2 / M$）：
- 第一區 average hits 為 0.970（Uniform 理論期望值 0.947、Historical Frequency 0.992），對 Uniform 差值的 95% paired bootstrap CI 為 [-0.109, 0.155]。
- 第二區 average hits 為 0.132（Uniform 理論期望值 0.125、Historical Frequency 0.143），對 Uniform 差值的 95% paired bootstrap CI 為 [-0.049, 0.064]。
- 兩區 CI 都跨 0，且 Historical Frequency baseline 均略高於模型，不能主張模型具有穩定超越隨機的預測優勢。
- （註：v1.0 固定選號歷史數值為第一區 Uniform 0.872, CI [-0.042, 0.238]；第二區 0.106, CI [-0.030, 0.083]；詳見 `docs/specs/holdout-v1.1-erratum.md`）。

## 前瞻盲測（Forward Test Ledger）

為了在 holdout 之外進一步杜絕後見之明（hindsight bias）與資料洩漏疑慮，專案建立了前瞻盲測機制：
1. **開獎前鎖定**：每次開獎日台灣時間 20:00 前（開獎前約 30 分鐘），由排程以截至當期全部驗證資料即時 fit 模型，產出下一期推薦選號，並以 append-only 方式寫入公開帳本 `artifacts/forward/ledger.jsonl`。
2. **開獎後自動計分**：下次抓取資料更新後，系統由帳本與最新開獎資料決定性推導出 `artifacts/forward/summary.json`，計算命中數並公開於網站 `/forward` 頁面。
3. **不可竄改保證**：程式層級禁止修改或刪除既有行，CI workflow 亦透過 `git diff --numstat` 嚴格禁止任何刪除或變更既有記錄之行為。

## 指標

報告 Average hits、Precision@k、Recall@k、Lift over Uniform、Brier score 與 Log loss。Top-k 指標檢查排序；Brier / Log loss 檢查 probability calibration。所有 fold 均保留明細、平均與標準差。
