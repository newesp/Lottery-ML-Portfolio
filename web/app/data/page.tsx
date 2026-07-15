import { Callout, Metric, PageIntro, Steps } from "../components/UI";
import { dev } from "../lib/results";

export default function DataPage() { return <div className="section-shell page">
  <PageIntro eyebrow="DATA LINEAGE" title="資料不是下載完就算完成"><p>歷屆資料取自 NFD 年度頁面。pipeline 先擷取 Big5 HTML、解析欄位、驗證完整性，再發布 canonical dataset 與 immutable snapshot。</p></PageIntro>
  <div className="metrics-grid compact"><Metric value={dev.draw_count.toLocaleString()} label="Verified draws"/><Metric value="2008-01-24" label="Date minimum"/><Metric value="2026-07-13" label="Date maximum"/><Metric value="SHA-256" label="Content addressed"/></div>
  <section className="content-section"><h2>Ingestion contract</h2><Steps items={[["01","Fetch source","依年度抓取 https://www.nfd.com.tw/lottery/lottyear/year.htm 的 Big5 HTML。"],["02","Parse & normalize","解析民國／西元日期、第一區 6 號與第二區 1 號。"],["03","Validate","檢查範圍、重複、日期遞增、舊資料不可無故改寫。"],["04","Publish atomically","驗證全過才一次替換 canonical；失敗不留下半成品。"]]}/></section>
  <Callout title="可追溯的來源修正"><p>NFD 的 2025-10-09 第二區原始頁面記為 28（超出 1–8）。專案以具 ID、舊值、新值、理由與交叉來源的 versioned correction 修正為 08；每次 ingestion 必須實際套用且不得重複。</p></Callout>
  <section className="content-section"><h2>Immutable snapshot 策略</h2><p className="body-copy">每週一、週四台灣時間 21:15 可由 GitHub Actions 抓取。只有資料內容改變且驗證成功時才建立新 snapshot、manifest 與 canonical；GitHub Pages 隨 repository artifact 重新部署，不需要 Vercel 或常駐 Python server。</p><code className="hash">{dev.data_sha256}</code></section>
</div>; }
