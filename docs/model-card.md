# Model Card：Lottery ML v1

## Intended use

展示可重現的 ML workflow、temporal evaluation 與負結果溝通。適合 code review、面試討論與學習；不適合投注、財務決策或宣稱能提高中獎機率。

## Data

NFD 歷年頁面，1,927 期，2008-01-24 至 2026-07-13。資料來源不是官方 API；專案保存 raw lineage、SHA-256、驗證結果與一筆具交叉來源的 2025-10-09 第二區修正。

## Models

Development 比較 Logistic Regression、Random Forest、LightGBM 與三個 baselines。Frozen selection 最終使用 Random Forest；第一區採 `frequency_gap`，第二區採 `full`，seeds 17/42/2026。

## Results and limitations

Holdout 點估計略高於 Uniform，但 paired bootstrap confidence intervals 跨 0，Rolling Frequency 也略高於模型。Lottery draws 被設計為隨機且歷史期數有限；feature search、model comparison 與 fold variance 都可能造成偶然高分。結果不支持可泛化的預測能力。

## Ethical communication

網站固定顯示「不是投注建議」，同時展示 baselines、不確定區間、資料限制與反例。不得以單一 fold、單一 seed 或點估計製作命中宣傳。
