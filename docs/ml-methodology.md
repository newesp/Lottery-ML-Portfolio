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

比較 Logistic Regression、Random Forest、LightGBM，以及 Uniform、Rolling Frequency、Shuffled History。超參數先在 development folds 選擇，再跨 feature sets 比較。主要 selection metric 是 mean average hits，以較低 fold standard deviation 和穩定 config ID 破同分。

## Locked holdout

CV 選出第一區 Random Forest + `frequency_gap`，第二區 Random Forest + `full`。`selection-v1.json` 以 development artifact SHA 鎖定後，才對 2024+ 共 265 期執行三 seeds ensemble。

第一區 average hits 為 0.970（Uniform 0.872、Rolling Frequency 0.992），對 Uniform 差值的 95% paired bootstrap CI 為 [-0.042, 0.238]。第二區為 0.132（Uniform 0.106、Rolling 0.143），CI [-0.030, 0.083]。兩區 CI 都跨 0，不能主張穩定優勢。

## 指標

報告 Average hits、Precision@k、Recall@k、Lift over Uniform、Brier score 與 Log loss。Top-k 指標檢查排序；Brier / Log loss 檢查 probability calibration。所有 fold 均保留明細、平均與標準差。
