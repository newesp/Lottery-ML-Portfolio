# Spec：Holdout v1.1 Erratum（Uniform Baseline 固定選號偏差勘誤）

> 狀態：Draft v1 · 2026-11-07
> 對象：實作此功能的 coding agent
> 前置或並行規格：[forward-test-ledger.md](file:///e:/Leo/Projects/Lottery-ML-Portfolio/docs/specs/forward-test-ledger.md)
> 範圍：Python evaluation / holdout、artifacts、Next.js 網站、文件

---

## 0. 一句話目標

在不重新訓練模型、不修改 `selection-v1.json`、且完整保留 `artifacts/experiments/holdout-v1.json` 原檔的前提下，修正 Uniform baseline 因同分排序（deterministic tie-break）退化成「每期固定買同一張票」的計算偏差，發布 **`artifacts/experiments/holdout-v1.1.json`** 並在網站與文件中公開勘誤說明。

---

## 1. 問題根因分析（Root Cause）

1. **`predict_uniform` 的同分與浮點尾差**：
   - `src/lottery_ml/models/baselines.py` 的 `predict_uniform` 給每個候選號碼相同分數 `1.0`，再經 `_normalize_to_pick_count` 正規化為 $k / M$（第一區 $6/38$、第二區 $1/8$）。
   - `_normalize_to_pick_count` 第 62 行 `probabilities[-1] += pick_count - probabilities.sum()` 把浮點捨入殘差（約 $+8.88 \times 10^{-16}$）加在最後一個號碼（第一區 38 號）。
2. **Top-$k$ 排序退化成單一固定彩券**：
   - `evaluate_predictions`（`metrics.py`）與 `_draw_hits`（`holdout.py`）皆以 `["draw_id", "probability", "number"]`、`ascending=[True, False, True]` 取前 $k$ 號。
   - 結果 `uniform` 在**每一期**都固定選出：
     - 第一區：`[1, 2, 3, 4, 5, 38]`
     - 第二區：`[1]`
3. **對 `holdout-v1.json` 造成的影響**：
   - **受影響欄位**：
     - `baselines.uniform` 的 `average_hits`（第一區 `0.8717`、第二區 `0.1057`）、`precision_at_k`、`recall_at_k`、`lift_over_uniform`（竟然不等於 `1.0`，而是 `0.9201` 與 `0.8453`）。
     - `paired_bootstrap_hits_vs_uniform`：模型是跟這張「剛好運氣偏背的固定彩券」做配對差值，導致點估計差值被高估（第一區 $\Delta = +0.0981$，實際對隨機期望值應為 $0.9698 - 0.9474 = +0.0224$；第二區 $\Delta = +0.0264$，實際應為 $0.1321 - 0.1250 = +0.0071$）。
   - **未受影響欄位**：
     - 模型本身的 `seed_results`、`ensemble_metrics`（含 `lift_over_uniform`，因為 `metrics.py` 第 77 行用的是解析期望值 `expected_uniform_hits = pick_count * pick_count / maximum`）。
     - `baselines.rolling_frequency` 的所有指標。
     - `baselines.uniform` 的 `brier_score` 與 `log_loss`（直接對 $p_i = k/M$ 計算，不經 Top-$k$ 排序）。

---

## 2. 統計與工程設計決策

| 議題 | 決策 | 理由 |
|---|---|---|
| 是否覆寫 `holdout-v1.json`？ | ❌ **不覆寫**，新增 `holdout-v1.1.json` | 專案核心原則是鎖定後的結果不可竄改；保留 `v1` 原檔並發布 `v1.1` 勘誤，最能展示研究誠信與稽核軌跡（audit trail）。 |
| 是否修改 `development-v1.json`？ | ❌ **不修改** | `selection-v1.json` 以 SHA-256 鎖定了 `development-v1.json`；且模型選擇只比對模型 runs，從未用 `uniform` baseline 參與選型，因此選型結果完全不受影響。 |
| 是否重新訓練模型？ | ⚠️ **重跑 deterministic pipeline 於原始 1,927 期資料**，驗證模型指標逐位元一致 | `holdout-v1` 的訓練與測試切分建立在前 1,927 期（`data_sha256 = 0d439e...`，截至 `2026-07-13`）。產生 `v1.1` 時必須使用前 1,927 期 draws，並斷言 `seed_results`、`ensemble_metrics`、`rolling_frequency` 與 `holdout-v1.json` 完全一致。 |
| Uniform Top-$k$ 指標怎麼算？ | ✅ **解析期望值（Analytical Expectation）** | 隨機無放回從 $M$ 號選 $k$ 號，對任意一期開獎結果，所有 $\binom{M}{k}$ 張彩券在該期的條件期望命中數恆為 $\mu_0 = k^2 / M$（第一區 $36/38 \approx 0.947368$，第二區 $1/8 = 0.125$），不依賴當期開出哪些號碼。因此：`average_hits = k*k/M`、`precision_at_k = recall_at_k = k/M`、`lift_over_uniform = 1.0`。 |
| Paired Bootstrap CI 怎麼算？ | ✅ **`paired_mean_difference(model_hits, np.full(T, k*k/M))`** | 在第 $t$ 期，隨機選號玩家的期望命中數就是常數 $\mu_0 = k^2/M$。配對差值 $d_t = H_t^{\text{model}} - \mu_0$ 不含單一抽樣彩券的雜訊，直接重用既有 `paired_mean_difference`（`resamples=10000, seed=2026`）。 |

---

## 3. 檔案與結構變更

```text
src/lottery_ml/
  evaluation/metrics.py          # 新增 evaluate_uniform_baseline()（解析期望值 + Brier/LogLoss）
  experiments/holdout.py         # 修改：run_holdout_evaluation 支援產出 v1.1，並保留 fixed_ticket 對照紀錄
  cli.py                         # 修改：`experiments holdout` 支援 --Through-date / --version，預設輸出 holdout-v1.1.json
artifacts/experiments/
  holdout-v1.json                # 保留不變（git diff 必須為空）
  holdout-v1.1.json              # 新增：勘誤後正式報告
tests/evaluation/
  test_metrics.py                # 新增 evaluate_uniform_baseline 測試
tests/experiments/
  test_holdout.py                # 新增 v1.1 期望值與 bootstrap 基準測試
web/app/lib/facts.ts             # 讀取 holdout-v1.1.json 作為主顯示，並附帶 v1 勘誤摘要
web/app/evaluation/page.tsx      # 新增「v1.1 勘誤說明（Erratum）」Callout
docs/ml-methodology.md           # 更新數據為 v1.1 並附勘誤說明
docs/model-card.md               # 更新數據為 v1.1 並附勘誤說明
README.md                        # 確認描述一致
```

---

## 4. Python 實作規格

### 4.1 `src/lottery_ml/evaluation/metrics.py`

新增函式（保留既有 `evaluate_predictions` 不變）：

```python
def expected_uniform_hits(area: AreaName) -> float:
    pick_count = 6 if area == "area1" else 1
    maximum = 38 if area == "area1" else 8
    return pick_count * pick_count / maximum


def evaluate_uniform_baseline(
    targets: pd.DataFrame,
    *,
    area: AreaName,
) -> MetricSummary:
    """Return analytical uniform baseline metrics over the given target frame."""
```

計算規則：
- 驗證 `targets` 欄位與 `area` 與 `evaluate_predictions` 相同。
- `pick_count = 6 if area == "area1" else 1`
- `maximum = 38 if area == "area1" else 8`
- `p = pick_count / maximum`
- `avg_hits = pick_count * pick_count / maximum`
- `precision_at_k = recall_at_k = pick_count / maximum`
- `lift_over_uniform = 1.0`
- `brier_score` 與 `log_loss`：以所有列固定機率 $p = k/M$ 對 `targets["target"]` 計算（與原本 `evaluate_predictions(targets, predict_uniform(targets))` 的 Brier / LogLoss 數值完全相同）。

### 4.2 `src/lottery_ml/experiments/holdout.py`

1. 在 `run_holdout_evaluation` 中：
   - `uniform_metric = evaluate_uniform_baseline(area_holdout, area=area)`
   - `expected_hits = np.full(int(area_holdout["draw_id"].nunique()), expected_uniform_hits(area), dtype=float)`
   - `interval = paired_mean_difference(_draw_hits(area_holdout, ensemble, area), expected_hits, resamples=selection.bootstrap_resamples, seed=selection.bootstrap_seed)`
2. 為了保持透明稽核，在每個 `area_results[area]` 新增 `legacy_v1_fixed_ticket_uniform` 欄位（記錄原本 `evaluate_predictions(area_holdout, uniform, area)` 與對固定彩券的 bootstrap CI），並在頂層設定：
   - `schema_version = "1.1.0"`
   - `experiment_id = "holdout-v1.1"`
   - `supersedes = "holdout-v1"`
3. **鎖定 1,927 期資料範圍**：
   - 在 `SelectionProtocol`（或 `holdout` CLI）支援擷取與 `holdout-v1` 相同的截止期別（`draw_date <= 2026-07-13`，共 1,927 期，`data_sha256 == "0d439e23aea086e2ed422da7aee1e4597a0a342b9a9e6e4d1762a2099b4d19fd"`），確保勘誤前後只在「Uniform 比較基準」有差異，測試期數（265 期）與模型預測分毫不差。

### 4.3 `artifacts/experiments/holdout-v1.1.json` 預期數值驗收

執行產出 `holdout-v1.1.json` 後，必須驗證以下數值：

| 欄位 | Area 1 (`area1`) | Area 2 (`area2`) |
|---|---|---|
| `ensemble_metrics.average_hits` | `0.969811320754717`（與 v1 相同） | `0.1320754716981132`（與 v1 相同） |
| `baselines.rolling_frequency.average_hits` | `0.9924528301886792`（與 v1 相同） | `0.14339622641509434`（與 v1 相同） |
| `baselines.uniform.average_hits` | `0.9473684210526315`（$36/38$，v1 為 `0.8717`） | `0.125`（$1/8$，v1 為 `0.1057`） |
| `baselines.uniform.lift_over_uniform` | `1.0` | `1.0` |
| `baselines.uniform.brier_score` | `0.13296398891966757`（與 v1 相同） | `0.109375`（與 v1 相同） |
| `paired_bootstrap_hits_vs_uniform.estimate` | `0.0224428997020854`（$257/265 - 36/38$） | `0.0070754716981132`（$35/265 - 1/8$） |
| `paired_bootstrap_hits_vs_uniform` 95% CI | 跨越 0（負結果結論不變，且差距更接近 0） | 跨越 0（負結果結論不變，且差距更接近 0） |

---

## 5. 網站與文件更新規格

### 5.1 網站讀取與呈現
- `web/app/lib/facts.ts`（或 `results.ts`）：改讀 `artifacts/experiments/holdout-v1.1.json`。
- 首頁 Hero Panel：
  - `Uniform 0.947`（原本顯示 `0.872`），小字：「隨機選號每期理論期望命中 0.947 個」。
- `/evaluation` 頁：
  - 兩區卡片的 `Uniform hits` 自動更新為 `0.947` 與 `0.125`，$\Delta$ 與 95% CI 自動更新為 v1.1 數值。
  - 新增一個 `Callout tone="neutral"`，標題：**「v1.1 勘誤紀錄：修正 Uniform 比較基準的同分排序偏差」**，內文簡述：
    > 在初版 `<RepoLink path="artifacts/experiments/holdout-v1.json">holdout-v1.json</RepoLink>` 中，`predict_uniform` 對所有號碼給出相同機率，經固定排序規則後退化為每期固定選擇同一組號碼（第一區 0.872、第二區 0.106），低於真正的隨機期望值（第一區 36/38 ≈ 0.947、第二區 1/8 = 0.125）。`<RepoLink path="artifacts/experiments/holdout-v1.1.json">holdout-v1.1.json</RepoLink>` 在不重訓模型的情況下改以解析期望值作為基準，模型與隨機選號的差距進一步縮小，95% CI 依然跨越 0。

### 5.2 文件更新
- `docs/ml-methodology.md` 第 30 行：更新 Uniform average hits 為 `0.947` / `0.125` 與新的 95% CI，並加註一句 v1 → v1.1 勘誤說明。
- `docs/model-card.md`：同步更新。

---

## 6. 測試與驗收條件

1. `test_evaluate_uniform_baseline_matches_analytical_expectation`：驗證第一區 `average_hits == 36 / 38`、第二區 `0.125`、`lift_over_uniform == 1.0`，且 `brier_score`、`log_loss` 與 `evaluate_predictions(..., predict_uniform(...))` 相等。
2. `test_holdout_v1_1_preserves_model_and_rolling_metrics`：驗證 `holdout-v1.1.json` 與 `holdout-v1.json` 的 `seed_results`、`ensemble_metrics`、`baselines.rolling_frequency` 逐欄相等。
3. `git diff --exit-code artifacts/experiments/holdout-v1.json` 必須為 0（原檔不可被改動）。
4. `pytest -q`、`ruff check .`、`mypy src/lottery_ml`、`pnpm typecheck && pnpm lint && pnpm build` 全部通過。
