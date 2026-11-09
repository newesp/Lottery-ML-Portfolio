# ML 方法與評估

## 問題定義與資料展開

每期開獎紀錄會展開為獨立的候選號碼分類問題：第一區 1–38 號各成一列（每期 6 個正樣本），第二區 1–8 號各成一列（每期 1 個正樣本）。模型針對每個候選號碼輸出開出機率，最終於第一區取機率最高的前 6 號（Top 6）、第二區取最高 1 號（Top 1）。

## 防洩漏控制（Leakage Control）

計算第 `t` 期特徵時，內部累積狀態（State）僅包含開獎日早於 `t` 的歷史期數。特徵建構器必須先完整輸出當期 46 列候選特徵與目標值（Target），隨後才會將第 `t` 期的開獎結果更新至頻率、間隔、指數移動平均（EWM）、前期統計與共現矩陣中。自動化測試會刻意篡改當期與未來的開獎結果，並驗證當期以前的所有特徵數值逐位元完全不變。

## 特徵組合（Feature Sets）

- `frequency`：歷史累積出現率、移動視窗（3／5／10／20／50／100／200 期）出現率，以及指數加權移動平均（EWM，半衰期 5／10／20／50 期）。
- `frequency_gap`：在 `frequency` 基礎上，加入距離上次開出的間隔期數、對數間隔、歷史平均間隔與間隔比值。
- `temporal_context`：在 `frequency` 基礎上，加入候選號碼編碼、開獎日曆特徵、前一期開獎統計與冷熱門號指標（Hot/Cold Context）。
- `full`：整合上述所有特徵並加上號碼共現關係（Co-occurrence），共計 46 項特徵指標。

Logistic Regression 所使用的 `StandardScaler` 封裝於各驗證輪次（Fold）的 scikit-learn Pipeline 內，確保標準化參數僅由當輪訓練集算出；樹模型（Random Forest、LightGBM）則直接使用原始特徵值。

## 時間序列交叉驗證（Time Series CV）

採用向外擴展的訓練視窗（Expanding-window Folds），驗證年份涵蓋 2018–2023 年；每一輪驗證的訓練集均嚴格截止於前一年底。2024-01-01 之後的開獎資料完全隔離，不參與任何參數調整或模型選型。

實驗同步比較 Logistic Regression、Random Forest、LightGBM 三種模型，以及 Uniform（完全隨機選號）、Historical Frequency（歷史累積頻率，結果檔鍵值沿用 `rolling_frequency`）、Shuffled History（打亂歷史順序）三組比較基準。超參數先於開發期驗證輪次中搭配 `full` 特徵集選定，再固定參數跨四種特徵組合進行公平比較。主要選型指標為各輪平均命中數（Mean Average Hits），若遇同分則依序以較低的跨年標準差（Fold SD）與固定設定檔 ID 決定。

## 封存盲測驗收（Locked Holdout）

開發期交叉驗證最終選出：第一區採用 Random Forest 搭配 `frequency_gap` 特徵集，第二區採用 Random Forest 搭配 `full` 特徵集。這項決定連同開發期結果檔的 SHA-256 指紋一併鎖入 `selection-v1.json` 後，才針對 2024 年後共 265 期封存資料執行三組隨機起點（Seeds 17／42／2026）的集成評估。

在 `holdout-v1.1` 中（修正了 v1.0 因同分排序導致固定選號的取樣偏差，改採解析數學期望值 $\mu_0 = k^2 / M$）：
- 第一區模型平均命中數為 0.970 顆（隨機期望值為 0.947 顆、歷史累積頻率基準為 0.992 顆），模型相對隨機期望值的 95% Paired Bootstrap 信賴區間為 `[-0.109, 0.155]`。
- 第二區模型平均命中數為 0.132 顆（隨機期望值為 0.125 顆、歷史累積頻率基準為 0.143 顆），模型相對隨機期望值的 95% Paired Bootstrap 信賴區間為 `[-0.049, 0.064]`。
- 兩區的 95% 信賴區間皆跨越 0，且樸素的歷史累積頻率基準在兩區皆微幅高於模型，顯示在現有資料與設計下，無法支持模型具備穩定超越隨機的預測優勢。
- （註：v1.0 固定選號之歷史數值為第一區 Uniform 0.872、CI `[-0.042, 0.238]`；第二區 Uniform 0.106、CI `[-0.030, 0.083]`；完整說明請見 `docs/specs/holdout-v1.1-erratum.md`）。

## 前瞻盲測（Forward Test Ledger）

為了在封存盲測之外進一步排除任何「事後諸葛」（Hindsight Bias）與資料洩漏的疑慮，專案建立了自動化前瞻盲測機制：
1. **開獎前鎖定**：每逢開獎日台灣時間 20:00 前，排程會以截至當下全部已驗證的歷史資料重新訓練模型，產出下一期選號，並以只增不減（Append-only）的方式寫入公開帳本 `artifacts/forward/ledger.jsonl`。
2. **開獎後自動結算**：待新開獎結果匯入後，系統會依據帳本與實際開獎號碼自動推導出 `artifacts/forward/summary.json`，結算命中成績並更新至網站 `/forward` 頁面。
3. **防竄改保護**：除了程式層級禁止修改或刪除既有帳本紀錄外，CI 工作流亦透過 `git diff --numstat` 嚴格把關，確保任何歷史預測都不會在開獎後被悄悄塗改。

## 評估指標

系統完整記錄 Average Hits、Precision@k、Recall@k、Lift over Uniform、Brier Score 與 Log Loss。前段指標檢驗選號排序的命中表現；Brier Score 與 Log Loss 則檢驗模型輸出的機率校準品質（Calibration）。每一輪驗證均完整保留各年明細、平均數與標準差。
