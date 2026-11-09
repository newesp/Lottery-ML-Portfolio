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

  return (
    <article className="result-card">
      <p className="eyebrow">{name}</p>
      <h2>{modelLabel(data.selection.model)}</h2>
      <p className="muted">
        {featureLabel(data.selection.feature_set)} feature set（使用的線索組合）·{" "}
        {seedCount}-seed ensemble（{seedCount} 次不同隨機起點的綜合結果）
      </p>
      <div className="result-metrics">
        <Metric
          value={modelHits}
          label="Model hits｜模型"
          note={`每期平均命中 ${modelHits} 個`}
        />
        <Metric
          value={uniformHits}
          label="Uniform hits｜隨機選號"
          note={`每期平均命中 ${uniformHits} 個`}
        />
        <Metric
          value={rollingHits}
          label="Historical hits｜歷史累積頻率"
          note={`每期平均命中 ${rollingHits} 個`}
        />
      </div>
      <div className="ci">
        <span>Δ hits vs Uniform｜模型比隨機選號多中的數量</span>
        <strong>
          {ci.estimate > 0 ? "+" : ""}
          {num(ci.estimate)}
        </strong>
        <div className="ci-line">
          <i />
          <b
            style={{
              left: `${Math.max(
                0,
                Math.min(100, (-ci.lower / (ci.upper - ci.lower)) * 100)
              )}%`,
            }}
          />
        </div>
        <small>
          95% CI（可能範圍）[{num(ci.lower)}, {num(ci.upper)}]
        </small>
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
        eyebrow={`LOCKED HOLDOUT · ${facts.holdoutStartYear}+ · 最終保留測試`}
        title="像正式考試一樣，只看一次的最終評估"
      >
        <p>
          模型與 feature set（使用哪些線索）先在 development artifact（開發階段結果檔）中選定，再用
          <RepoLink path="configs/experiments/selection-v1.json">
            SHA-256 指紋鎖住
          </RepoLink>
          。{facts.holdoutStartYear} 年後共 {holdout.holdout_draw_count} 期是 locked
          holdout：它們完全不參與 fitting（訓練）、tuning（調整參數）或選型，直到所有決定完成後才一次打開驗收。
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

      <p className="muted text-sm">
        註：artifact 中的 baseline key 為 <code>rolling_frequency</code>（v1 舊名），實際算法依歷史累積出現率排序。
      </p>

      <Callout tone="warning" title="點估計比較高，不代表已證明有效">
        <p>
          {evalCallout.pointComparison}但
          <RepoLink path="artifacts/experiments/holdout-v1.1.json">
            {facts.bootstrapResamples.toLocaleString()} 次 paired draw bootstrap 與完整 holdout 結果
          </RepoLink>
          {evalCallout.ciSummary} {evalCallout.baselineComparison} {evalCallout.decisionRule}
        </p>
      </Callout>

      <Callout tone="neutral" title="v1.1 勘誤紀錄：修正 Uniform 比較基準的同分排序偏差">
        <p>
          在初版{" "}
          <RepoLink path="artifacts/experiments/holdout-v1.json">
            holdout-v1.json
          </RepoLink>{" "}
          中，<code>predict_uniform</code>{" "}
          對所有號碼給出相同機率，經固定排序規則後退化為每期固定選擇同一組號碼（第一區 0.872、第二區 0.106），低於真正的隨機期望值（第一區 36/38 ≈ 0.947、第二區 1/8 = 0.125）。
          <RepoLink path="artifacts/experiments/holdout-v1.1.json">
            holdout-v1.1.json
          </RepoLink>{" "}
          在不重訓模型的情況下改以解析期望值作為基準，模型與隨機選號的差距進一步縮小，95% CI 依然跨越 0。
        </p>
      </Callout>

      <section className="content-section">
        <h2>
          <RepoLink path="src/lottery_ml/evaluation/metrics.py">
            為什麼還看 Brier score 與 Log loss？
          </RepoLink>
        </h2>
        <p className="body-copy">
          Average hits（平均命中數）只看最後選出的號碼有沒有中；Brier score 與 Log
          loss
          則檢查模型給出的機率是否合理，而且兩者都是越低越好。舉例來說，模型若對錯誤號碼給出非常高的信心，就會受到更重的扣分。這能避免只因偶然多中幾個號碼，就誤以為模型的機率判斷可信。
        </p>
      </section>
    </div>
  );
}
