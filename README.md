# Lottery ML Portfolio

以台灣威力彩為題的可重現機器學習工程案例。專案刻意選擇近乎純隨機、難以預測的彩券開獎作為考場，展示從資料溯源（Data Lineage）、防洩漏特徵工程到誠實呈現負結果的完整工程紀律，而非提供投注建議。

## 展示重點

- NFD 歷年 Big5 編碼網頁擷取、格式檢核、具版本紀錄的來源勘誤（Versioned Correction）與不可竄改的原始快照（Immutable Raw Snapshot）
- 實驗凍結時涵蓋 1,927 期標準開獎紀錄（每週持續自動更新），全程以 SHA-256 數位指紋驗證內容一致性
- 每期展開為 38 + 8 列獨立候選樣本，提煉 46 項杜絕未來資訊洩漏（Leakage-safe）的特徵指標
- 2018–2023 逐年向前擴展的訓練視窗（Expanding-window Time Series Cross Validation）
- 比較 Logistic Regression、Random Forest、LightGBM 與三組統計比較基準（Baselines）
- 選型鎖定機制（Frozen Selection Protocol）、2024 年後封存盲測（Locked Holdout）與三組隨機起點集成（3-seed Ensemble）
- 10,000 次 Paired Draw Bootstrap 抽樣信賴區間檢驗
- 前瞻盲測（Forward Test Ledger）：開獎前自動將預測號碼寫入只增不減（Append-only）的公開帳本，開獎後自動對獎結算
- Next.js 靜態展示網站與互動式實驗室（Experiment Lab），部署於 GitHub Pages

最終盲測結果顯示，模型並未展現可泛化的預測優勢：兩區模型相對隨機期望值的 95% 信賴區間皆跨越 0，且單純依歷史累積出現率排序的簡單基準（Historical Frequency）表現甚至還略勝一籌。在隨機性面前坦然承認模型沒有學到特殊規律，正是本專案希望呈現的工程判斷力。

## 使用技術

- **Machine Learning & Data Processing**：Python 3.12+、scikit-learn (Logistic Regression, Random Forest)、LightGBM、NumPy、pandas、Paired Bootstrap 統計檢驗
- **Data Engineering & Lineage**：Requests、BeautifulSoup4（歷史 Big5 HTML 擷取與解析）、SHA-256 Content Addressing、Immutable Raw Snapshots
- **Frontend & Visualization**：Next.js 16 (App Router / Static Export)、React 19、TypeScript 5、互動實驗室 (Experiment Lab)
- **Quality & Verification**：pytest（資料契約、防洩漏、決定性重現測試）、mypy (Strict mode)、Ruff (Linter & Formatter)、ESLint
- **CI/CD & Infrastructure**：GitHub Actions（自動化 CI、定時排程資料更新與前瞻預測）、GitHub Pages 靜態託管

## 快速開始

需要 Python 3.12+、Node.js 22 與 pnpm 11。

```powershell
python -m venv .venv
.venv\Scripts\pip install -e ".[dev]"
.venv\Scripts\pytest -q
.venv\Scripts\lottery-ml ingest --root .
.venv\Scripts\lottery-ml experiments development --root .
.venv\Scripts\lottery-ml experiments holdout --root .

cd web
pnpm install --frozen-lockfile
pnpm dev
```

在本機完整重跑開發期實驗矩陣約需 12 分鐘；前端網站直接讀取納入版本控制的實驗結果檔（Artifacts），不會在訪客瀏覽時動態重訓模型。

## 專案結構

```text
configs/       特徵、實驗、選型鎖定與來源勘誤設定檔
data/          標準資料集、不可改動快照與資料清單（Manifests）
artifacts/     開發期驗證、封存盲測與前瞻盲測帳本結果
src/           資料匯入、特徵工程、模型管線、統計評估與實驗執行器
tests/         資料契約、防洩漏、鍵值對齊、決定性與 CLI 測試
web/           Next.js 靜態展示網站與互動實驗室
docs/          系統架構、機器學習方法論、模型卡與規格文件
```

## 文件導覽

- [系統設計](docs/system-design.md)
- [ML 方法與評估](docs/ml-methodology.md)
- [Model Card](docs/model-card.md)
- [資料管線](docs/data-pipeline.md)

v1 以繁體中文與台灣慣用技術詞彙撰寫，並保留關鍵英文術語方便對照查詢；v2 規劃加入人工校對的中英語系切換。

## 自動化流程

- `CI`：執行 Python 單元測試／Ruff／mypy，以及前端 TypeScript 型別檢查／ESLint／靜態建置
- `Deploy GitHub Pages`：`main` 分支更新後自動建置並部署 `web/out`
- `Update verified lottery data`：每週二、週五台灣時間 09:17（12:17 複檢）自動抓取最新開獎資料；驗證通過後執行 `forward predict`，將下期預測以 Append-only 規則寫入前瞻盲測帳本

## 免責聲明

本專案純屬機器學習工程與統計驗證展示，並非投注建議。彩券開獎應視為獨立隨機事件，過往的出現頻率不會改變未來的開獎機率。
