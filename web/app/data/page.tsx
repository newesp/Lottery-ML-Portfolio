import { Callout, ExternalLink, Metric, PageIntro, RepoLink, Steps } from "../components/UI";
import { getSiteFacts } from "../lib/facts";

function NfdLink() {
  return (
    <ExternalLink href="https://www.nfd.com.tw/lottery/lottyear/year.htm">
      NFD（開獎資料來源網站）
    </ExternalLink>
  );
}

export default function DataPage() {
  const facts = getSiteFacts();
  const dataset = facts.dataset;
  return (
    <div className="section-shell page">
      <PageIntro
        eyebrow="DATA LINEAGE ｜ 資料溯源與驗證"
        title={
          <>
            資料不是抓下來，<span className="inline-block">就能直接餵給模型</span>
          </>
        }
      >
        <p>
          歷年開獎紀錄取自 <NfdLink /> 年度頁面。資料管線會先解析早期的 Big5 編碼網頁、統一欄位格式並通過完整性檢查，最後才產出
          <RepoLink path="data/processed/power-lottery.json">標準資料集（Canonical Dataset）</RepoLink>
          與不可改動的原始快照（Immutable Snapshot）。場上的每一個數字都有跡可循，而不是一份來歷不明的試算表。
        </p>
      </PageIntro>
      <div className="metrics-grid compact">
        <Metric
          value={dataset.draw_count.toLocaleString()}
          label="Verified draws｜已驗證期數"
          note="全數通過格式、範圍與時序檢查"
        />
        <Metric value={dataset.date_min} label="Date minimum｜最早開獎日" />
        <Metric value={dataset.date_max} label="Date maximum｜最新開獎日" />
        <Metric
          value="SHA-256"
          label="Content addressed｜數位指紋"
          note="資料只要改動一個字元，雜湊值就會隨之改變"
        />
      </div>
      <section className="content-section">
        <h2>
          <RepoLink path="docs/data-pipeline.md">Ingestion contract｜資料匯入規範</RepoLink>
        </h2>
        <Steps
          items={[
            [
              "01",
              "Fetch source｜擷取原始網頁",
              <>依年度抓取 <NfdLink /> 的 Big5 編碼 HTML，原封不動保存來源網站當下提供的原始內容。</>,
            ],
            [
              "02",
              "Parse & normalize｜解析與格式標準化",
              "將夾雜民國與西元的日期、第一區 6 顆號碼與第二區 1 顆號碼，轉換為結構一致的標準欄位。",
            ],
            [
              "03",
              "Validate｜嚴格資料檢核",
              "確認球號落在合法範圍、同區無重複號碼、開獎日期嚴格遞增，並防止既有歷史紀錄被無故覆寫。",
            ],
            [
              "04",
              "Publish atomically｜原子化發布",
              "所有檢核全數過關才會更新正式資料集；只要任何一步異常就立即中止並保留舊版，絕不留下更新一半的半成品。",
            ],
          ]}
        />
      </section>
      <Callout title="可追溯的來源勘誤紀錄">
        {facts.sourceCorrections.map((correction) => (
          <p key={correction.correction_id}>
            <NfdLink /> 的 {correction.draw_id}{" "}
            {correction.field === "area2" ? "第二區" : "第一區"}在原始頁面被誤植為{" "}
            {String(correction.old)}，但第二區合法範圍僅限 1–{facts.game.area2.max}。管線透過
            <RepoLink path="configs/data/source-corrections.json">
              具版本紀錄的勘誤表（Versioned Correction）
            </RepoLink>
            將其修正為 {String(correction.new).padStart(2, "0")}，同時完整保留修正編號、原始值、修正值、理由與獨立交叉比對來源，讓每一筆人工介入都公開透明。
          </p>
        ))}
      </Callout>
      <section className="content-section">
        <h2>Immutable snapshot｜防竄改資料快照</h2>
        <p className="body-copy">
          透過
          <RepoLink path=".github/workflows/update-data.yml">
            GitHub Actions 自動排程
          </RepoLink>
          ，系統會在{facts.schedule.description}自動巡檢最新開獎結果。唯有當資料確實更新且全數通過檢核時，才會寫入新的
          <RepoLink path="data/raw/snapshots" directory>
            原始快照（Snapshot）
          </RepoLink>
          、
          <RepoLink path="data/manifests" directory>
            資料清單（Manifest）
          </RepoLink>
          及
          <RepoLink path="data/processed/power-lottery.json">
            標準資料集（Canonical Dataset）
          </RepoLink>
          。下方的 SHA-256 數位指紋可用來核對目前讀取的資料版本是否完全一致。
        </p>
        <code className="hash">{dataset.sha256}</code>
      </section>
    </div>
  );
}
