import Link from "next/link";
import { Callout, Eyebrow, Metric, RepoLink, Steps } from "./components/UI";
import { ForwardCard } from "./components/ForwardCard";
import { getSiteFacts } from "./lib/facts";
import { buildHomeConclusion, ciVerdict, heroCiTag } from "./lib/narrative";
import { num } from "./lib/results";

export default function Home() {
  const facts = getSiteFacts();
  const dataset = facts.dataset;
  const area1 = facts.holdout.areas.area1;
  const area2 = facts.holdout.areas.area2;

  const area1CiVerdict = ciVerdict(
    area1.paired_bootstrap_hits_vs_uniform.lower,
    area1.paired_bootstrap_hits_vs_uniform.upper
  );
  const heroTag = heroCiTag(area1CiVerdict);

  const conclusion = buildHomeConclusion(
    {
      modelHits: area1.ensemble_metrics.average_hits,
      uniformHits: area1.baselines.uniform.average_hits,
      frequencyHits: area1.baselines.rolling_frequency.average_hits,
      ciLower: area1.paired_bootstrap_hits_vs_uniform.lower,
      ciUpper: area1.paired_bootstrap_hits_vs_uniform.upper,
    },
    {
      modelHits: area2.ensemble_metrics.average_hits,
      uniformHits: area2.baselines.uniform.average_hits,
      frequencyHits: area2.baselines.rolling_frequency.average_hits,
      ciLower: area2.paired_bootstrap_hits_vs_uniform.lower,
      ciUpper: area2.paired_bootstrap_hits_vs_uniform.upper,
    }
  );

  return (
    <>
      <section className="hero section-shell">
        <div>
          <Eyebrow>REPRODUCIBLE ML CASE STUDY ｜ 經得起檢驗的機器學習實測</Eyebrow>
          <h1>
            威力彩幾乎純屬隨機，<br />
            <em>那這套機器學習系統究竟在測什麼？</em>
          </h1>
          <p className="hero-copy">
            彩券開獎是標準的隨機事件，指望靠演算法算出下期頭獎並不切實際。但正因為結果難以預測，它反而成了檢驗機器學習工程紀律的最佳試金石：這套
            <RepoLink path="docs/system-design.md">端到端驗證管線</RepoLink>
            從源頭為歷史資料打上 SHA-256 數位指紋防竄改、嚴格切齊時間軸杜絕偷看未來答案（Data
            Leakage）、依年份向前滾動回測，最後將 {facts.holdoutStartYear}{" "}
            年後的資料封存為只測一次的盲測集（Locked
            Holdout）。重點不在報明牌，而在示範一套連面對隨機世界都不作弊、不硬凹的實驗流程。
          </p>
          <div className="button-row">
            <Link className="button primary" href="/experiments">
              進入互動實驗室
            </Link>
            <Link className="button secondary" href="/reproducibility">
              查看本機重現步驟
            </Link>
          </div>
        </div>
        <div className="hero-panel" aria-label="專案關鍵結果">
          <span className="status">
            <i /> PIPELINE VERIFIED ｜ 端到端流程驗證通過
          </span>
          <div className="hero-number">{num(area1.ensemble_metrics.average_hits)}</div>
          <p>
            模型在盲測封存期中，每期第一區挑 {facts.game.area1.pick} 顆平均對中{" "}
            {num(area1.ensemble_metrics.average_hits)} 顆號碼
          </p>
          <small className="hero-meaning">
            白話來說，每期選 {facts.game.area1.pick} 顆球，平均對中不到 1
            顆。這只是單純的號碼命中統計，既非中獎率，更與頭獎機率無關。
          </small>
          <div className="mini-compare">
            <span>
              <b>隨機期望值 {num(area1.baselines.uniform.average_hits)}</b>
              <small>
                隨機選號每期理論期望命中 {num(area1.baselines.uniform.average_hits)} 顆
              </small>
            </span>
            <span>
              <b>{heroTag.title}</b>
              <small>{heroTag.subtitle}</small>
            </span>
          </div>
        </div>
      </section>
      <section className="metrics-band">
        <div className="section-shell metrics-grid">
          <Metric
            value={dataset.draw_count.toLocaleString()}
            label="完整歷史開獎期數"
            note={`涵蓋 ${dataset.date_min_year}–${dataset.date_max_year} 年，期期皆有雜湊存證`}
          />
          <Metric
            value={String(facts.game.totalCandidates)}
            label="每期獨立評分候選碼"
            note={`第一區 ${facts.game.area1.max} 碼＋第二區 ${facts.game.area2.max} 碼分開建模`}
          />
          <Metric
            value={String(facts.cv.roundCount)}
            label="時間序列回測輪次"
            note={`${facts.cv.rangeText} 年逐年向前滾動驗證`}
          />
          <Metric
            value={String(facts.holdout.holdout_draw_count)}
            label="封存盲測驗收期數"
            note={`${facts.holdoutStartYear} 年後資料完全隔離，定案後一次開箱`}
          />
        </div>
      </section>
      <section className="section-shell content-section">
        <div className="section-heading">
          <Eyebrow>ENGINEERING DISCIPLINE ｜ 四道防作弊工程防線</Eyebrow>
          <h2>把每個環節攤在陽光下，讓數據自己說話</h2>
        </div>
        <Steps
          items={[
            [
              "01",
              "Fetch & Snapshot｜爬蟲與原始存證",
              "抓取早期 Big5 編碼的歷史網頁時，同步寫入不可改動的原始快照（Immutable Snapshot）並計算 SHA-256 數位指紋，確保歷史開獎紀錄無法在事後被悄悄修改。",
            ],
            [
              "02",
              "Feature Engineering｜嚴防偷看答案的特徵工程",
              "將每期候選號碼拆為獨立資料列，並嚴格限制模型只能讀取當期開獎前的歷史統計，從架構上杜絕未來資訊洩漏（Data Leakage）。",
            ],
            [
              "03",
              "Temporal Evaluation｜按時間軸向前滾動回測",
              `彩券資料具有時間順序，隨機打散切分只會造成資訊外溢。實驗採用 Expanding-window CV 逐年模擬「拿過去預測未來」，並將 ${facts.holdoutStartYear} 年後的資料鎖進盲測區，調參完畢才開箱驗收。`,
            ],
            [
              "04",
              "Communicate Honestly｜誠實面對負結果",
              "同時擺出隨機選號與歷史累積頻率作為對照基準，並透過 Paired Bootstrap 檢驗信賴區間。既然差距未達統計顯著，就坦然呈現這份負結果，不把巧合包裝成預測神話。",
            ],
          ]}
        />
      </section>
      <section className="section-shell content-section">
        <Callout tone="warning" title="實驗總結：當複雜模型遇上簡單統計">
          <p>
            {conclusion.comparison}
            {conclusion.ciSummary} {conclusion.baselineComparison} {conclusion.verdict}
            完整實驗數據與方法限制，皆可於
            <RepoLink path="docs/model-card.md">模型卡</RepoLink>
            交叉核對。
          </p>
        </Callout>
      </section>
      <ForwardCard />
    </>
  );
}
