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
          <Eyebrow>REPRODUCIBLE ML CASE STUDY · 可重現的機器學習案例</Eyebrow>
          <h1>
            當預測目標是隨機的，<br />
            <em>ML 工程還能證明什麼？</em>
          </h1>
          <p className="hero-copy">
            這個專案用台灣威力彩示範一套
            <RepoLink path="docs/system-design.md">完整的機器學習流程</RepoLink>
            ：保存不可任意改動的原始資料備份（immutable snapshot）、確保模型偷看不到未來答案（leakage-safe
            features）、依時間順序反覆測試（Time Series Cross Validation），最後才打開保留資料做總驗收（locked
            holdout）。重點不是提供明牌，而是證明實驗過程經得起檢查。
          </p>
          <div className="button-row">
            <Link className="button primary" href="/experiments">
              進入 Experiment Lab 實驗室
            </Link>
            <Link className="button secondary" href="/reproducibility">
              查看如何重現結果
            </Link>
          </div>
        </div>
        <div className="hero-panel" aria-label="專案關鍵結果">
          <span className="status">
            <i /> PIPELINE VERIFIED · 流程已驗證
          </span>
          <div className="hero-number">{num(area1.ensemble_metrics.average_hits)}</div>
          <p>
            模型在最終測試中，每期第一區平均命中 {num(area1.ensemble_metrics.average_hits)} 個號碼
          </p>
          <small className="hero-meaning">
            「平均命中」是選出的 {facts.game.area1.pick} 個號碼中，平均有幾個與開獎號碼相同；不是中獎率，也不是頭獎機率。
          </small>
          <div className="mini-compare">
            <span>
              <b>Uniform {num(area1.baselines.uniform.average_hits)}</b>
              <small>
                隨機選號每期理論期望命中 {num(area1.baselines.uniform.average_hits)} 個
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
            label="歷史開獎期數"
            note={`涵蓋 ${dataset.date_min_year}–${dataset.date_max_year} 年`}
          />
          <Metric
            value={String(facts.game.totalCandidates)}
            label="每期要評分的候選號碼"
            note={`第一區 ${facts.game.area1.max} 個＋第二區 ${facts.game.area2.max} 個`}
          />
          <Metric
            value={String(facts.cv.roundCount)}
            label="Time Series CV 時間測試輪次"
            note={`逐年模擬 ${facts.cv.rangeText}`}
          />
          <Metric
            value={String(facts.holdout.holdout_draw_count)}
            label="Locked holdout 最終測試期數"
            note={`${facts.holdoutStartYear} 年後才一次驗收`}
          />
        </div>
      </section>
      <section className="section-shell content-section">
        <div className="section-heading">
          <Eyebrow>END-TO-END WORKFLOW · 完整工作流程</Eyebrow>
          <h2>從來源網頁到一般人也能檢查的結論</h2>
        </div>
        <Steps
          items={[
            [
              "01",
              "Fetch & Snapshot｜抓取並保存",
              "讀取來源 Big5 HTML，留下 SHA-256 數位指紋與 immutable snapshot；也就是保存一份可核對、不能悄悄竄改的原始資料。",
            ],
            [
              "02",
              "Feature Engineering｜整理模型線索",
              "把每個候選號碼各做成一列資料，而且只使用當期開獎前已經知道的歷史資訊。",
            ],
            [
              "03",
              "Temporal Evaluation｜按時間測試",
              `用 Expanding-window CV 逐年模擬「拿過去預測未來」，並把 ${facts.holdoutStartYear} 年後資料鎖成最後才看的 holdout。`,
            ],
            [
              "04",
              "Communicate Honestly｜誠實解讀",
              "同時呈現 baseline（簡單比較基準）、bootstrap CI（不確定範圍）與負結果，不把偶然命中包裝成投注能力。",
            ],
          ]}
        />
      </section>
      <section className="section-shell content-section">
        <Callout tone="warning" title="最重要的研究結論">
          <p>
            {conclusion.comparison}
            {conclusion.ciSummary} {conclusion.baselineComparison} {conclusion.verdict}
            完整結果與限制可在
            <RepoLink path="docs/model-card.md">模型卡</RepoLink>
            交叉核對。
          </p>
        </Callout>
      </section>
      <ForwardCard />
    </>
  );
}
