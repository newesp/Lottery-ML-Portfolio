import { PageIntro, RepoLink, Steps } from "../components/UI";
import { getSiteFacts } from "../lib/facts";
import { dev } from "../lib/results";

export default function ReproPage() {
  const facts = getSiteFacts();
  return (
    <div className="section-shell page">
      <PageIntro
        eyebrow="REPRODUCIBILITY ｜ 可重現性與環境驗證"
        title={
          <>
            網站上的每一個數字，<span className="inline-block">都能在本機重新算出來</span>
          </>
        }
      >
        <p>
          可重現性（Reproducibility）意味著任何人只要照著相同步驟執行，就能得到分毫不差的結果。本專案由 Python
          執行資料檢核與模型運算，並透過 GitHub Actions 自動化排程；GitHub Pages 則單純託管 Next.js
          預先編譯好的靜態網頁與已驗證 JSON 結果檔，不會在訪客開啟網頁時動態重算。
        </p>
      </PageIntro>
      <section className="content-section">
        <h2>本機重現｜從頭跑完一次完整實驗</h2>
        <p className="body-copy">
          以下指令會建立獨立虛擬環境、安裝相依套件、重跑開發期交叉驗證與封存盲測，最後建置前端靜態網站。網站呈現的所有指標與圖表，皆由這套固定流程自動產出，無任何手動填表。
        </p>
        <div className="code-block">
          <code>python -m venv .venv</code>
          <code>.venv/Scripts/pip install -e &quot;.[dev]&quot;</code>
          <code>lottery-ml experiments development --root .</code>
          <code>lottery-ml experiments holdout --root .</code>
          <code>cd web &amp;&amp; pnpm install &amp;&amp; pnpm build</code>
        </div>
      </section>
      <section className="content-section">
        <h2>Lineage checks｜確保每個環節版本一致</h2>
        <Steps
          items={[
            [
              "01",
              "Dataset hash｜資料集數位指紋",
              <>
                目前最新資料指紋（{facts.dataset.draw_count.toLocaleString()} 期）：
                <code>{facts.dataset.sha256}</code>
                <br />
                開發與盲測實驗凍結時資料指紋（
                {facts.frozenDataset.draw_count.toLocaleString()} 期）：
                <code>{facts.frozenDataset.sha256}</code>
                <br />
                透過 SHA-256 雜湊值，可立即確認本機讀取的資料集與實驗鎖定時是否逐位元相同。
              </>,
            ],
            [
              "02",
              "Feature schema｜特徵規格鎖定",
              `目前採用 Feature version ${dev.feature_version}，統一規範滾動視窗長度與欄位順序，避免同名特徵在不同實驗版本中代表不同算法。`,
            ],
            [
              "03",
              "Environment｜執行環境與套件版本",
              `${Object.entries(dev.package_versions)
                .map(([k, v]) => `${k} ${v}`)
                .join(" · ")}。明確記錄核心運算套件版本，將底層函式庫改版帶來的數值漂移風險降至最低。`,
            ],
            [
              "04",
              "Selection freeze｜先鎖定選型再驗收",
              <>
                <RepoLink path="configs/experiments/selection-v1.json">
                  selection-v1.json
                </RepoLink>{" "}
                記錄了開發期結果檔的 SHA-256 指紋；執行最終盲測前若發現指紋不符，程式會立即中止（Fail
                Closed），從制度上杜絕「看完考題才回頭改答案」的後見之明。
              </>,
            ],
          ]}
        />
      </section>
      <section className="content-section">
        <h2>文件索引｜深入了解系統細節</h2>
        <ul className="clean-list">
          <li>
            <RepoLink path="docs/system-design.md">
              <code>docs/system-design.md</code>
            </RepoLink>{" "}
            — 系統架構、資料流與前後端分工邊界
          </li>
          <li>
            <RepoLink path="docs/ml-methodology.md">
              <code>docs/ml-methodology.md</code>
            </RepoLink>{" "}
            — 特徵設計、時間序列交叉驗證與評估指標
          </li>
          <li>
            <RepoLink path="docs/model-card.md">
              <code>docs/model-card.md</code>
            </RepoLink>{" "}
            — 模型設計目的、實驗結果與使用限制
          </li>
          <li>
            <RepoLink path="docs/data-pipeline.md">
              <code>docs/data-pipeline.md</code>
            </RepoLink>{" "}
            — 歷史網頁擷取、檢核規則與快照存證機制
          </li>
        </ul>
      </section>
    </div>
  );
}
