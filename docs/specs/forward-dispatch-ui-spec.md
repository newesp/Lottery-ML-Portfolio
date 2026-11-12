# 前瞻盲測（Forward Test）雙卡看板與號碼排版統一實作指南

本文件記錄前瞻盲測頁面（`forward/`）雙卡對照看板與各列排版視覺統一的完整實作規格，方便在其他專案（如 `Lottery-AutoML`）進行同步調整與交接。

---

## 1. 調整概述與設計原則

1. **職責分離（雙卡片架構）**：
   - **左卡【基準期歷史開獎】**：呈現模型推論所依據的最新歷史開獎（已開出號碼；若在滾動盲測中有前期鎖定紀錄，則同步顯示命中標記與選號）。
   - **右卡【下一期盲測預測】**：呈現開獎前預先鎖定的選號（開獎號碼為「待開獎」狀態、模型選號、歷史累積頻率）。
2. **UI 視覺節奏與尺寸統一**：
   - **球號尺寸全面統一為 `size="md"`（36px）**：不再讓模型選號使用 `size="lg"`，消除球體過寬折行掉到標籤下方的問題。
   - **水平相對位置統一**：左側標籤固定寬度（`width: 140px; flex-shrink: 0;`），右側球號或狀態膠囊在同一橫排（不折行），起始垂直線完全一致。
   - **分隔線與留白統一**：三列之間皆使用統一的虛線（`1px dashed var(--line)`）與均勻上下留白。

---

## 2. 後端資料層調整（Python）

### 檔案：`src/lottery_ml/forward/ledger.py`

在 `build_summary()` 函式中，當產生 `latest_pending` 時，自動從 `draws_by_id` 字典取得基準期的開獎球號並寫入 summary：

```python
        if target_draw is None:
            status = "pending"
            target_draw_id: str | None = None
            target_date_matched = True
            actual: dict[str, Any] | None = None
            hits: dict[str, Any] | None = None
            cutoff_draw = draws_by_id.get(str(entry["cutoff_draw_id"]))
            cutoff_actual = (
                {
                    "area1": list(cutoff_draw.area1),
                    "area2": cutoff_draw.area2,
                }
                if cutoff_draw
                else None
            )
            latest_pending = {
                "cutoff_draw_id": str(entry["cutoff_draw_id"]),
                "cutoff_actual": cutoff_actual,  # <-- 新增基準期開獎號碼
                "assumed_target_date": assumed_target_date,
                "predictions": entry["predictions"],
            }
```

---

## 3. 前端型別與容錯讀取（TypeScript）

### 檔案：`web/app/lib/forward.ts`

1. **擴充 TypeScript 型別**：
```typescript
export type CutoffActual = {
  area1: number[];
  area2: number;
};

export type LatestPending = {
  cutoff_draw_id: string;
  assumed_target_date: string;
  cutoff_actual?: CutoffActual | null;  // <-- 新增選用欄位
  predictions: {
    // ... 原有結構維持不變
  };
};
```

2. **新增容錯回退讀取函式**（確保即使 `summary.json` 未即時更新，也能自動從歷史資料庫補齊）：
```typescript
function getCutoffActualFromDataset(drawId: string): CutoffActual | null {
  const candidatePaths = [
    path.join(process.cwd(), "..", "data", "processed", "power-lottery.json"),
    path.join(process.cwd(), "data", "processed", "power-lottery.json"),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      try {
        const raw = JSON.parse(fs.readFileSync(candidate, "utf-8"));
        if (Array.isArray(raw?.draws)) {
          const found = raw.draws.find(
            (d: { draw_id?: string; draw_date?: string }) =>
              d.draw_id === drawId || d.draw_date === drawId
          );
          if (
            found &&
            Array.isArray(found.area1) &&
            typeof found.area2 === "number"
          ) {
            return {
              area1: found.area1,
              area2: found.area2,
            };
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
  }
  return null;
}
```

3. **在 `getForwardSummary()` 內套用補齊邏輯**：
```typescript
  const result = parsed as ForwardSummary;
  if (result.latest_pending && !result.latest_pending.cutoff_actual) {
    result.latest_pending.cutoff_actual = getCutoffActualFromDataset(
      result.latest_pending.cutoff_draw_id
    );
  }

  return result;
```

---

## 4. 頁面元件調整（React / Next.js）

### 檔案：`web/app/forward/page.tsx`

在元件內計算前期預測紀錄（`cutoffEntry`）與真實開獎號碼（`cutoffActual`），並使用左右雙卡與一致的列結構：

```tsx
export default function ForwardPage() {
  const summary = getForwardSummary();
  if (!summary) return /* ... */;

  const { latest_pending, expected_hits_uniform, aggregate, entries } = summary;

  // 取得基準期對應的前期預測記錄（若有）與開獎號碼
  const cutoffDrawId = latest_pending?.cutoff_draw_id;
  const cutoffEntry = cutoffDrawId
    ? entries.find(
        (e) =>
          (e.target_draw_id && e.target_draw_id === cutoffDrawId) ||
          e.assumed_target_date === cutoffDrawId
      )
    : undefined;
  const cutoffActual = latest_pending?.cutoff_actual || cutoffEntry?.actual || null;

  return (
    <div className="page section-shell">
      {/* ... PageIntro ... */}

      {/* 前瞻盲測看板 */}
      <section className="content-section">
        <div className="section-heading">
          <Eyebrow>FORWARD DISPATCH ｜ 前瞻盲測看板</Eyebrow>
          <h2>
            {latest_pending
              ? `基準期 ${latest_pending.cutoff_draw_id} ➜ 目標開獎日 ${latest_pending.assumed_target_date}`
              : "目前尚無待開獎的預測"}
          </h2>
        </div>

        {latest_pending ? (
          <div className="forward-dispatch-grid">
            {/* 1. 基準期歷史開獎卡片 */}
            <div className="forward-dispatch-box cutoff-box">
              <div className="dispatch-header">
                <div className="dispatch-title-group">
                  <span className="dispatch-subhead">基準期歷史開獎</span>
                  <h3 className="dispatch-title">{cutoffDrawId} 期</h3>
                </div>
                <span className="status-pill resolved">歷史基準資料</span>
              </div>

              <p className="dispatch-desc">
                模型推論下一期選號時所依據的最新歷史開獎資料：
              </p>

              {/* 第一列：開獎號碼 */}
              <div className="forward-row">
                <span className="forward-row-label">
                  <b>開獎號碼</b>
                  <small>本期實際開出結果</small>
                </span>
                {cutoffActual ? (
                  <div className="ball-group">
                    {cutoffActual.area1.map((n) => (
                      <NumberBall key={n} number={n} area="area1" size="md" />
                    ))}
                    <span className="ball-sep" aria-hidden="true">+</span>
                    <NumberBall number={cutoffActual.area2} area="area2" size="md" />
                  </div>
                ) : (
                  <span className="muted">—</span>
                )}
              </div>

              {/* 第二列：模型選號 */}
              <div className="forward-row">
                <span className="forward-row-label">
                  <b>模型選號</b>
                  <small>
                    {cutoffEntry && cutoffEntry.hits
                      ? `命中第一區 ${cutoffEntry.hits.model.area1} 顆 / 第二區 ${cutoffEntry.hits.model.area2} 顆`
                      : "selection-v1 RF Ensemble"}
                  </small>
                </span>
                {cutoffEntry ? (
                  <div className="ball-group">
                    {cutoffEntry.picks.model.area1.map((n) => (
                      <NumberBall
                        key={n}
                        number={n}
                        area="area1"
                        size="md"
                        isHit={cutoffActual ? cutoffActual.area1.includes(n) : false}
                      />
                    ))}
                    <span className="ball-sep" aria-hidden="true">+</span>
                    <NumberBall
                      number={cutoffEntry.picks.model.area2[0]}
                      area="area2"
                      size="md"
                      isHit={cutoffActual ? cutoffActual.area2 === cutoffEntry.picks.model.area2[0] : false}
                    />
                  </div>
                ) : (
                  <div>
                    <span className="status-pill neutral">盲測起始基準期（開獎前未預先鎖定預測）</span>
                  </div>
                )}
              </div>

              {/* 第三列：歷史累積頻率 */}
              <div className="forward-row">
                <span className="forward-row-label">
                  <b>歷史累積頻率</b>
                  <small>
                    {cutoffEntry && cutoffEntry.hits
                      ? `命中第一區 ${cutoffEntry.hits.historical_frequency.area1} 顆 / 第二區 ${cutoffEntry.hits.historical_frequency.area2} 顆`
                      : "Historical Frequency"}
                  </small>
                </span>
                {cutoffEntry ? (
                  <div className="ball-group">
                    {cutoffEntry.picks.historical_frequency.area1.map((n) => (
                      <NumberBall
                        key={n}
                        number={n}
                        area="area1"
                        size="md"
                        isHit={cutoffActual ? cutoffActual.area1.includes(n) : false}
                      />
                    ))}
                    <span className="ball-sep" aria-hidden="true">+</span>
                    <NumberBall
                      number={cutoffEntry.picks.historical_frequency.area2[0]}
                      area="area2"
                      size="md"
                      isHit={cutoffActual ? cutoffActual.area2 === cutoffEntry.picks.historical_frequency.area2[0] : false}
                    />
                  </div>
                ) : (
                  <div>
                    <span className="status-pill neutral">盲測起始基準期</span>
                  </div>
                )}
              </div>

              <div className="dispatch-footer">
                {cutoffEntry && cutoffEntry.hits ? (
                  <>
                    本期結算命中：模型第一區 <b>{cutoffEntry.hits.model.area1}</b> 顆／第二區 <b>{cutoffEntry.hits.model.area2}</b> 顆
                  </>
                ) : (
                  <>
                    此期為盲測系統歷史基準截斷點，特徵工程截至本期已驗證開獎資料。
                  </>
                )}
              </div>
            </div>

            {/* 2. 下一期盲測預測卡片 */}
            <div className="forward-dispatch-box predict-box">
              <div className="dispatch-header">
                <div className="dispatch-title-group">
                  <span className="dispatch-subhead">下一期盲測預測</span>
                  <h3 className="dispatch-title">目標開獎日：{latest_pending.assumed_target_date}</h3>
                </div>
                <span className="live-pill">
                  <span className="live-pill-dot" />
                  LOCKED PENDING DRAW
                </span>
              </div>

              <p className="dispatch-desc">
                依據截至 {latest_pending.cutoff_draw_id} 的已驗證歷史資料，模型在開獎前預先鎖定的選號組合：
              </p>

              {/* 第一列：開獎號碼 */}
              <div className="forward-row">
                <span className="forward-row-label">
                  <b>開獎號碼</b>
                  <small>開獎後自動結算</small>
                </span>
                <div>
                  <span className="status-pill pending">待開獎（開獎後自動對獎結算）</span>
                </div>
              </div>

              {/* 第二列：模型選號（統一使用 size="md"） */}
              <div className="forward-row">
                <span className="forward-row-label">
                  <b>模型選號</b>
                  <small>selection-v1 RF Ensemble</small>
                </span>
                <div className="ball-group">
                  {latest_pending.predictions.model.area1.picks.map((n) => (
                    <NumberBall key={n} number={n} area="area1" size="md" />
                  ))}
                  <span className="ball-sep" aria-hidden="true">+</span>
                  <NumberBall number={latest_pending.predictions.model.area2.picks[0]} area="area2" size="md" />
                </div>
              </div>

              {/* 第三列：歷史累積頻率（統一使用 size="md"） */}
              <div className="forward-row">
                <span className="forward-row-label">
                  <b>歷史累積頻率</b>
                  <small>Historical Frequency</small>
                </span>
                <div className="ball-group">
                  {latest_pending.predictions.historical_frequency.area1.picks.map((n) => (
                    <NumberBall key={n} number={n} area="area1" size="md" />
                  ))}
                  <span className="ball-sep" aria-hidden="true">+</span>
                  <NumberBall number={latest_pending.predictions.historical_frequency.area2.picks[0]} area="area2" size="md" />
                </div>
              </div>

              <div className="dispatch-footer">
                隨機選號理論期望命中：第一區 <b>{num(expected_hits_uniform.area1, 3)}</b> 顆／第二區 <b>{num(expected_hits_uniform.area2, 3)}</b> 顆
              </div>
            </div>
          </div>
        ) : (
          <p className="muted">
            上一期預測已完成對獎結算，下一期預測將於開獎資料更新時自動產生並寫入帳本。
          </p>
        )}
      </section>
    </div>
  );
}
```

---

## 5. 樣式調整（CSS）

### 檔案：`web/app/globals.css`

確認加入以下 CSS 樣式：

```css
/* 雙卡看板 Grid */
.forward-dispatch-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  margin-top: 18px;
}

@media (max-width: 992px) {
  .forward-dispatch-grid {
    grid-template-columns: 1fr;
  }
}

.forward-dispatch-box {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 28px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
}

.forward-dispatch-box.predict-box {
  border-color: var(--navy-border);
  box-shadow: var(--shadow-md);
}

.dispatch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.dispatch-title-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dispatch-subhead {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.dispatch-title {
  font-size: 1.18rem;
  font-weight: 800;
  color: var(--navy);
  margin: 0;
}

.dispatch-desc {
  color: var(--muted);
  margin: 0 0 20px;
  font-size: 0.92rem;
  line-height: 1.5;
}

/* 核心：統一水平排列與虛線分隔 */
.forward-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px dashed var(--line);
}

.forward-row:first-of-type {
  padding-top: 0;
}

.forward-row:last-of-type {
  border-bottom: none;
  padding-bottom: 0;
}

/* 統一固定標籤欄寬度，確保右側球號/膠囊起點垂直對齊 */
.forward-row-label {
  width: 140px;
  min-width: 140px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.forward-row-label b {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--navy);
  line-height: 1.25;
}

.forward-row-label small {
  font-size: 0.74rem;
  color: var(--muted);
  line-height: 1.25;
}

.dispatch-footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  font-size: 0.84rem;
  color: var(--muted);
}

/* 狀態膠囊中性樣式 */
.status-pill.neutral {
  background: #f8fafc;
  color: var(--muted);
  border: 1px solid var(--line);
}

/* 行動版 RWD：小於 680px 時轉為垂直堆疊以防球號溢出 */
@media (max-width: 680px) {
  .forward-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .forward-row-label {
    width: 100%;
    min-width: 0;
  }
}
```

---

## 6. 驗證步驟

完成上述程式碼移植後，請於目標專案終端機執行下列驗證：

```bash
# 1. Python 盲測模組測試
pytest tests/forward/

# 2. 前端型別檢查
npm --prefix web run typecheck

# 3. Next.js 靜態建置測試
npm --prefix web run build

# 4. 程式碼 Lint 檢查
npm --prefix web run lint
```
