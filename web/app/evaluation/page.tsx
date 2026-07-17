import { Callout, Metric, PageIntro, RepoLink } from "../components/UI";
import { locked, num } from "../lib/results";

const modelNames: Record<string,string> = {
  random_forest: "Random Forest｜隨機森林",
  logistic_regression: "Logistic Regression｜邏輯斯迴歸",
  lightgbm: "LightGBM｜梯度提升樹",
};

const featureNames: Record<string,string> = {
  frequency: "frequency｜出現頻率",
  frequency_gap: "frequency_gap｜出現頻率＋距離上次出現的期數",
  temporal_context: "temporal_context｜頻率＋時間背景",
  full: "full｜全部線索",
};

function AreaResult({name, data}:{name:string;data:typeof locked.areas.area1}){
  const ci=data.paired_bootstrap_hits_vs_uniform;
  const modelHits=num(data.ensemble_metrics.average_hits);
  const uniformHits=num(data.baselines.uniform.average_hits);
  const rollingHits=num(data.baselines.rolling_frequency.average_hits);
  return <article className="result-card">
    <p className="eyebrow">{name}</p>
    <h2>{modelNames[data.selection.model] ?? data.selection.model.replace("_"," ")}</h2>
    <p className="muted">{featureNames[data.selection.feature_set] ?? data.selection.feature_set} feature set（使用的線索組合）· 3-seed ensemble（三次不同隨機起點的綜合結果）</p>
    <div className="result-metrics">
      <Metric value={modelHits} label="Model hits｜模型" note={`每期平均命中 ${modelHits} 個`}/>
      <Metric value={uniformHits} label="Uniform hits｜隨機選號" note={`每期平均命中 ${uniformHits} 個`}/>
      <Metric value={rollingHits} label="Rolling hits｜近期頻率" note={`每期平均命中 ${rollingHits} 個`}/>
    </div>
    <div className="ci">
      <span>Δ hits vs Uniform｜模型比隨機選號多中的數量</span>
      <strong>{ci.estimate>0?"+":""}{num(ci.estimate)}</strong>
      <div className="ci-line"><i/><b style={{left:`${Math.max(0,Math.min(100,(-ci.lower/(ci.upper-ci.lower))*100))}%`}}/></div>
      <small>95% CI（可能範圍）[{num(ci.lower)}, {num(ci.upper)}]</small>
      <p className="ci-explanation">區間跨過 0，表示真實差距可能是正、也可能是負；目前不能排除模型其實沒有勝過隨機選號。</p>
    </div>
  </article>
}

export default function EvaluationPage(){return <div className="section-shell page">
  <PageIntro eyebrow="LOCKED HOLDOUT · 2024+ · 最終保留測試" title="像正式考試一樣，只看一次的最終評估"><p>模型與 feature set（使用哪些線索）先在 development artifact（開發階段結果檔）中選定，再用<RepoLink path="configs/experiments/selection-v1.json">SHA-256 指紋鎖住</RepoLink>。2024 年後共 {locked.holdout_draw_count} 期是 locked holdout：它們完全不參與 fitting（訓練）、tuning（調整參數）或選型，直到所有決定完成後才一次打開驗收。</p></PageIntro>
  <div className="results-grid"><AreaResult name="第一區 · 從 38 號選 Top 6" data={locked.areas.area1}/><AreaResult name="第二區 · 從 8 號選 Top 1" data={locked.areas.area2}/></div>
  <Callout tone="warning" title="點估計比較高，不代表已證明有效"><p>兩區模型的單一平均值（point estimate）都比 Uniform 隨機選號高，但<RepoLink path="artifacts/experiments/holdout-v1.json">10,000 次 paired draw bootstrap 與完整 holdout 結果</RepoLink>顯示，95% CI 都跨越 0。同時，簡單的 Rolling Frequency baseline（近期常出現的號碼優先）在兩區還略高於模型。判讀規則是：整個區間高於 0 才有統計證據較好；整個區間低於 0 代表較差；跨過 0 則無法確認。即使區間都高於 0，也還要看提升幅度是否大到具有實際價值。</p></Callout>
  <section className="content-section"><h2><RepoLink path="src/lottery_ml/evaluation/metrics.py">為什麼還看 Brier score 與 Log loss？</RepoLink></h2><p className="body-copy">Average hits（平均命中數）只看最後選出的號碼有沒有中；Brier score 與 Log loss 則檢查模型給出的機率是否合理，而且兩者都是越低越好。舉例來說，模型若對錯誤號碼給出非常高的信心，就會受到更重的扣分。這能避免只因偶然多中幾個號碼，就誤以為模型的機率判斷可信。</p></section>
</div>}
