# Lottery ML Portfolio 系統設計

## 設計目的

這是一份面向技術團隊與工程審閱者的機器學習工程案例研究。台灣威力彩本質上近乎純隨機，幾乎不存在可預測的訊號；因此本系統的成功標準不在於「猜中下期號碼」，而在於展示資料可溯源、特徵不洩漏、實驗可重現，以及面對負結果時不誇大、不硬凹的工程紀律。

## 系統架構

```text
NFD 年度 Big5 HTML
  -> fetch / parse / source-correction audit
  -> dataset validation
  -> immutable raw snapshot + manifest + canonical JSON
  -> candidate-row feature builder (38 + 8 rows/draw)
  -> 2018–2023 expanding-window CV
  -> frozen selection-v1.json (development artifact SHA)
  -> 2024+ locked holdout + paired bootstrap (v1.1 analytical expectation)
  -> versioned JSON artifacts
  -> forward predict -> append-only ledger.jsonl -> derived summary.json
  -> Next.js static export -> GitHub Pages
```

資料檢核與模型運算皆由 Python 在本機或 GitHub Actions 環境執行；GitHub Pages 僅託管靜態 HTML、CSS、JavaScript 與預先算好的 JSON 結果檔。這種離線預先運算的架構免除了常駐伺服器成本，也讓訪客不必在網頁前乾等十多分鐘的模型訓練。

## 自動更新與防護策略

- GitHub Actions 於每週一、週四台灣時間 21:15 自動執行資料匯入（Ingestion），並於週二、週五 09:00 進行補抓，以應對來源網站較晚更新的狀況。
- 只要任何一項資料檢核未通過，管線便立即中止，不會覆寫現有正式資料集，絕不留下更新一半的半成品。
- 若來源資料內容未變，系統不會建立重複快照，也不會產生無意義的 Git commit。
- 資料更新通過後，排程會自動執行 `lottery-ml forward predict`，在下一期開獎前將模型選號寫入 `artifacts/forward/ledger.jsonl`，並推導出 `summary.json`；CI 流程透過 `git diff --numstat` 嚴格把關，確保帳本只能新增紀錄、無法刪改過往內容。
- 例行資料更新不會自動覆寫已鎖定的盲測結果（Locked Holdout）或選型設定（Selection）；完整的實驗重算須透過明確的手動指令觸發。
- 當更新推送至 `main` 分支後，Pages 工作流會自動重新建置並發布靜態網站。

## 核心工程契約

- 標準資料集（Canonical Dataset）、原始快照（Snapshot）、資料清單（Manifest）與實驗結果檔皆採用 Schema Version `1.0.0`。
- `selection-v1.json` 記錄了開發期結果檔的 SHA-256 指紋；若驗收時指紋不符，系統將立即中止（Fail Closed）。
- 預測目標與模型輸出統一以 `(draw_id, area, number)` 複合鍵進行一對一對齊。
- JSON 寫入器嚴格拒絕 `NaN` 與 `Infinity`，並固定鍵值排序、採用 UTF-8 編碼、確保檔尾換行與原子化替換（Atomic Replace）。

## 語系規劃

v1 以繁體中文與台灣慣用技術語彙撰寫，同時保留關鍵英文術語以便對照檢索。v2 規劃透過 Next.js 語系字典提供中英切換，確保專業統計與機器學習術語的精確性。
