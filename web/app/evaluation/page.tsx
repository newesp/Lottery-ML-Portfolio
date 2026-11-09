import { Callout, Metric, PageIntro, RepoLink } from "../components/UI";
import { getSiteFacts, type AreaHoldoutData } from "../lib/facts";
import { featureLabel, modelLabel } from "../lib/labels";
import {
  buildEvaluationCallout,
  ciExplanation,
  ciVerdict,
} from "../lib/narrative";
import { num } from "../lib/results";

function AreaResult({
  name,
  data,
  seedCount,
}: {
  name: string;
  data: AreaHoldoutData;
  seedCount: number;
}) {
  const ci = data.paired_bootstrap_hits_vs_uniform;
  const modelHits = num(data.ensemble_metrics.average_hits);
  const uniformHits = num(data.baselines.uniform.average_hits);
  const rollingHits = num(data.baselines.rolling_frequency.average_hits);
  const verdict = ciVerdict(ci.lower, ci.upper);

  // Compute percentage positions for forest plot on scale [-0.25, 0.25]
  const domainMin = -0.25;
  const domainMax = 0.25;
  const toPct = (val: number) => {
    const clamped = Math.max(domainMin, Math.min(domainMax, val));
    return ((clamped - domainMin) / (domainMax - domainMin)) * 100;
  };

  const zeroPct = toPct(0);
  const lowerPct = toPct(ci.lower);
  const upperPct = toPct(ci.upper);
  const estimatePct = toPct(ci.estimate);

  return (
    <article className="result-card">
      <div className="result-card-header">
        <p className="eyebrow">{name}</p>
        <span className="seed-badge">{seedCount}-Seed Ensemble</span>
      </div>

      <h2 className="result-model-title">{modelLabel(data.selection.model)}</h2>
      <p className="muted result-feature-sub">
        特徵組合：<b>{featureLabel(data.selection.feature_set)}</b> · 多隨機起點集成
      </p>

      <div className="result-metrics">
        <Metric
          value={modelHits}
          label="模型平均命中"
          note={`每期平均挑中 ${modelHits} 顆`}
        />
        <Metric
          value={uniformHits}
          label="隨機選號期望值"
          note={`每期理論期望 ${uniformHits} 顆`}
        />
        <Metric
          value={rollingHits}
          label="歷史常開基準"
          note={`每期平均命中 ${rollingHits} 顆`}
        />
      </div>

      <div className="ci-block" role="region" aria-label="成對抽樣信賴區間檢驗">
        <div className="ci-header">
          <span className="ci-label">Δ hits vs Uniform（相對隨機選號差距）</span>
          <strong className="ci-diff-number">
            {ci.estimate > 0 ? "+" : ""}
            {num(ci.estimate, 3)} 顆
          </strong>
        </div>

        {/* Scientific Forest Plot Visualizer */}
        <div className="forest-plot-container">
          <div className="forest-plot-labels">
            <span>落後隨機 ({domainMin})</span>
            <span className="forest-zero-label">基準線 (0.00)</span>
            <span>領先隨機 (+{domainMax})</span>
          </div>

          <div className="forest-plot-track">
            {/* Zero vertical line */}
            <div
              className="forest-zero-line"
              style={{ left: `${zeroPct}%` }}
              title="隨機期望值基準線 (0.0)"
            />

            {/* Shaded confidence interval band */}
            <div
              className="forest-ci-band"
              style={{
                left: `${lowerPct}%`,
                width: `${Math.max(4, upperPct - lowerPct)}%`,
              }}
            />

            {/* Point estimate marker */}
            <div
              className="forest-estimate-dot"
              style={{ left: `${estimatePct}%` }}
              title={`點估計值：${ci.estimate > 0 ? "+" : ""}${num(ci.estimate, 3)}`}
            />
          </div>

          <div className="forest-ci-bounds">
            <span className="bound-tag">Lower: {num(ci.lower, 3)}</span>
            <span className="verdict-pill neutral">95% CI 跨越 0 · 無統計顯著優勢</span>
            <span className="bound-tag">Upper: +{num(ci.upper, 3)}</span>
          </div>
        </div>

        <p className="ci-explanation">{ciExplanation(verdict)}</p>
      </div>
    </article>
  );
}

export default function EvaluationPage() {
  const facts = getSiteFacts();
  const holdout = facts.holdout;
  const area1 = holdout.areas.area1;
  const area2 = holdout.areas.area2;
  const seedCount1 = facts.selection.areas.area1.seeds.length;
  const seedCount2 = facts.selection.areas.area2.seeds.length;

  const evalCallout = buildEvaluationCallout(
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
    <div className="section-shell page">
      <PageIntro
        eyebrow={`LOCKED HOLDOUT · ${facts.holdoutStartYear}+ ｜ 封存盲測驗收`}
        title="像正式大考一樣，定案後只開箱一次的總驗收"
      >
        <p>
          模型架構與特徵組合先在開發階段選定，並以
          <RepoLink path="configs/experiments/selection-v1.json">
            SHA-256 數位指紋寫入設定檔鎖死
          </RepoLink>
          。{facts.holdoutStartYear} 年後的 {holdout.holdout_draw_count} 期開獎資料屬於封存盲測集（Locked
          Holdout）：在特徵設計、調參與選型過程中完全隔離，直到所有決策定案後才一次開箱計分。
        </p>
      </PageIntro>

      <div className="results-grid">
        <AreaResult
          name={`第一區 · 從 ${facts.game.area1.max} 號選 Top ${facts.game.area1.pick}`}
          data={area1}
          seedCount={seedCount1}
        />
        <AreaResult
          name={`第二區 · 從 ${facts.game.area2.max} 號選 Top ${facts.game.area2.pick}`}
          data={area2}
          seedCount={seedCount2}
        />
      </div>

      <p className="muted" style={{ fontSize: "0.85rem", margin: "16px 0 32px" }}>
        註：結果檔中的基準欄位鍵值沿用 v1 命名 <code>rolling_frequency</code>，實際演算法為依歷史累積出現率排序（Historical Frequency）。
      </p>

      <Callout tone="warning" title="帳面平均值略高，不等於證明模型有效">
        <p>
          {evalCallout.pointComparison}但
          <RepoLink path="artifacts/experiments/holdout-v1.1.json">
            {facts.bootstrapResamples.toLocaleString()} 次 Paired Bootstrap 抽樣與完整盲測結果
          </RepoLink>
          {evalCallout.ciSummary} {evalCallout.baselineComparison} {evalCallout.decisionRule}
        </p>
      </Callout>

      <Callout tone="neutral" title="v1.1 勘誤紀錄：修正隨機選號基準的同分排序偏差">
        <p>
          在初版{" "}
          <RepoLink path="artifacts/experiments/holdout-v1.json">
            holdout-v1.json
          </RepoLink>{" "}
          中，<code>predict_uniform</code>{" "}
          對所有號碼給出相同機率，經固定同分排序規則後，退化為每期固定挑選前幾號（第一區平均對中 0.872 顆、第二區 0.106 顆），低於真正的隨機選號數學期望值（第一區 36/38 ≈ 0.947、第二區 1/8 = 0.125）。更新版{" "}
          <RepoLink path="artifacts/experiments/holdout-v1.1.json">
            holdout-v1.1.json
          </RepoLink>{" "}
          在不重訓模型的前提下，改以解析期望值作為比較基準；修正後模型與隨機選號的帳面差距進一步縮小，兩區 95% 信賴區間依然跨越 0。
        </p>
      </Callout>

      <section className="content-section">
        <h2>
          <RepoLink path="src/lottery_ml/evaluation/metrics.py">
            為什麼除了命中數，還要看 Brier Score 與 Log Loss？
          </RepoLink>
        </h2>
        <p className="body-copy">
          平均命中數（Average Hits）只看最後挑出的那幾顆球有沒有中；Brier Score 與 Log Loss
          則進一步檢驗模型輸出的「預測機率」是否誠實反映真實不確定性（兩者皆越低越好）。舉例來說，如果模型對某個號碼給出極高信心卻沒開出，就會在 Log Loss 上受到重罰。同時觀察這兩項指標，能避免模型只是碰巧押中幾顆球，機率估計卻完全失準。
        </p>
      </section>
    </div>
  );
}
