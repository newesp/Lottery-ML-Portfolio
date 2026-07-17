import { Callout, ExternalLink, Metric, PageIntro, RepoLink, Steps } from "../components/UI";
import { dev } from "../lib/results";

function NfdLink() {
  return <ExternalLink href="https://www.nfd.com.tw/lottery/lottyear/year.htm">NFD（開獎資料來源網站）</ExternalLink>;
}

export default function DataPage() { return <div className="section-shell page">
  <PageIntro eyebrow="DATA LINEAGE · 資料來龍去脈" title="資料不是下載完就算完成"><p>歷屆資料取自 <NfdLink/> 年度頁面。資料管線（pipeline）會先抓取 Big5 編碼的網頁、整理欄位並檢查是否完整，再產生<RepoLink path="data/processed/power-lottery.json">標準資料集（canonical dataset）</RepoLink>與不可任意改動的備份（immutable snapshot）。因此每個數字都能追查來源，而不是一份來歷不明的試算表。</p></PageIntro>
  <div className="metrics-grid compact"><Metric value={dev.draw_count.toLocaleString()} label="Verified draws｜已驗證期數" note="每一期都通過格式與範圍檢查"/><Metric value="2008-01-24" label="Date minimum｜最早日期"/><Metric value="2026-07-13" label="Date maximum｜最晚日期"/><Metric value="SHA-256" label="Content addressed｜內容指紋" note="資料一改，指紋就會不同"/></div>
  <section className="content-section"><h2><RepoLink path="docs/data-pipeline.md">Ingestion contract｜資料匯入規則</RepoLink></h2><Steps items={[
    ["01","Fetch source｜抓取來源",<>依年度抓取 <NfdLink/> 的 Big5 HTML，也就是先保存網站提供的原始內容。</>],
    ["02","Parse & normalize｜解析並統一格式","把民國與西元日期、第一區 6 個號碼、第二區 1 個號碼整理成一致欄位。"],
    ["03","Validate｜檢查資料","確認號碼範圍正確、沒有重複、日期依序增加，而且舊資料不會無故被改寫。"],
    ["04","Publish atomically｜一次完整發布","所有檢查通過才替換正式資料；任何一步失敗就保留舊版本，避免留下只更新一半的資料。"],
  ]}/></section>
  <Callout title="可追溯的來源修正"><p><NfdLink/> 的 2025-10-09 第二區原始頁面記為 28，但第二區只可能是 1–8。專案用<RepoLink path="configs/data/source-corrections.json">versioned correction（有版本紀錄的修正）</RepoLink>把它改為 08，並保存修正 ID、舊值、新值、理由與交叉來源；任何人都能知道哪一筆被改過、為什麼改。</p></Callout>
  <section className="content-section"><h2>Immutable snapshot｜不可任意改動的資料備份</h2><p className="body-copy"><RepoLink path=".github/workflows/update-data.yml">GitHub Actions（自動排程工具）</RepoLink>可在每週一、週四台灣時間 21:15 抓取資料。只有內容真的改變且驗證成功時，才建立新的<RepoLink path="data/raw/snapshots" directory>snapshot（當下完整備份）</RepoLink>、<RepoLink path="data/manifests" directory>manifest（檔案清單與資訊）</RepoLink>及<RepoLink path="data/processed/power-lottery.json">canonical dataset（正式標準資料）</RepoLink>。下方 SHA-256 是本次資料的數位指紋，可用來確認大家使用的是同一份內容。</p><code className="hash">{dev.data_sha256}</code></section>
</div>; }
