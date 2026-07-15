# Lottery ML Portfolio 系統設計

## 目的

這是一個面向技術主管與 ML 招募者的繁體中文 case study。台灣威力彩幾乎沒有可預測訊號，因此成功標準不是「猜中」，而是資料可追溯、實驗不洩漏、結果可重現、結論不誇大。

## 架構

```text
NFD 年度 Big5 HTML
  -> fetch / parse / source-correction audit
  -> dataset validation
  -> immutable raw snapshot + manifest + canonical JSON
  -> candidate-row feature builder (38 + 8 rows/draw)
  -> 2018–2023 expanding-window CV
  -> frozen selection-v1.json (development artifact SHA)
  -> 2024+ locked holdout + paired bootstrap
  -> versioned JSON artifacts
  -> Next.js static export -> GitHub Pages
```

Python 在本機或 GitHub Actions 執行。GitHub Pages 只提供靜態 HTML、CSS、JavaScript 與預先計算的 JSON，不執行 Python。這讓網站沒有常駐 server 成本，也避免訪客等待約 12 分鐘的 reference experiment。

## 更新策略

- GitHub Actions 每週一、週四台灣時間 21:15 執行 ingestion。
- 驗證失敗時不發布 canonical，不留下半成品。
- 內容未改變時不建立 snapshot，也不產生無意義 commit。
- 資料更新不自動改寫 locked holdout 或 selection；完整 reference experiment 由明確手動命令執行。
- push 到 `main` 後 Pages workflow 重新建立 static export。

## 主要契約

- Canonical dataset、snapshot、manifest 與 artifact 都使用 schema version `1.0.0`。
- `selection-v1.json` 記錄 development artifact 的 SHA-256；不符即 fail closed。
- target / prediction 一律以 `(draw_id, area, number)` 一對一 join。
- JSON writer 拒絕 NaN 與 Infinity，排序 keys、UTF-8、newline terminated、atomic replace。

## v2 國際化

v1 先以繁體中文撰寫，保留英文技術關鍵字方便查詢。v2 建議使用 Next.js locale dictionaries 做中英切換；瀏覽器全頁翻譯可作 fallback，但不應取代經人工校對的 ML 術語與結論。
