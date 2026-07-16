"use client";

import { useMemo, useState } from "react";
import type { Run } from "../lib/results";
import { areaLabel, num } from "../lib/results";

const modelNames: Record<string,string> = {
  logistic_regression:"Logistic Regression｜邏輯斯迴歸",
  random_forest:"Random Forest｜隨機森林",
  lightgbm:"LightGBM｜梯度提升樹",
  uniform:"Uniform｜完全隨機選號",
  rolling_frequency:"Rolling Frequency｜近期頻率排序",
  shuffled_history:"Shuffled History｜打亂歷史關係",
};
const metricNames: Record<string,string> = {
  average_hits:"Average hits｜平均命中數",
  lift_over_uniform:"Lift over Uniform｜相對隨機命中倍率",
  brier_score:"Brier score｜機率誤差",
  log_loss:"Log loss｜信心錯誤代價",
};
const metricHelp: Record<string,string> = {
  average_hits:"每一期最後選出的號碼，平均有幾個真的開出；數值越高越好。",
  lift_over_uniform:"模型平均命中數 ÷ 隨機選號的預期平均命中數；1 代表兩者相同，1.05 代表模型約高 5%，數值越高越好。",
  brier_score:"把預測機率與實際結果的差距平方後取平均；數值越低，代表機率預測越準。",
  log_loss:"答錯又過度有信心時會被重罰；數值越低越好。",
};
const featureNames: Record<string,string> = {
  frequency:"frequency｜只看出現頻率",
  frequency_gap:"frequency_gap｜頻率＋出現間隔",
  temporal_context:"temporal_context｜頻率＋時間脈絡",
  full:"full｜使用全部線索",
};

export function ExperimentLab({ runs }: { runs: Run[] }) {
  const [area,setArea] = useState<"area1"|"area2">("area1");
  const [metric,setMetric] = useState("average_hits");
  const [feature,setFeature] = useState("all");
  const filtered = useMemo(() => runs.filter(run => run.area === area && (run.kind === "baseline" || feature === "all" || run.feature_set === feature)).sort((a,b) => metric === "brier_score" || metric === "log_loss" ? a.mean_metrics[metric]-b.mean_metrics[metric] : b.mean_metrics[metric]-a.mean_metrics[metric]),[runs,area,metric,feature]);
  const best = filtered[0];
  const values = filtered.map(run=>run.mean_metrics[metric]);
  const min = Math.min(...values), max = Math.max(...values);
  const width = (value:number) => `${22 + ((value-min)/(max-min || 1))*78}%`;
  return <section className="lab" aria-label="實驗矩陣互動篩選">
    <div className="lab-controls">
      <label>號碼區域<select value={area} onChange={e=>setArea(e.target.value as "area1"|"area2")}><option value="area1">第一區：38 選 6</option><option value="area2">第二區：8 選 1</option></select></label>
      <label>評估指標<select value={metric} onChange={e=>setMetric(e.target.value)}>{Object.entries(metricNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>Feature set｜線索組合<select value={feature} onChange={e=>setFeature(e.target.value)}><option value="all">全部模型與基準方法</option>{Object.entries(featureNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <div className="lab-summary"><span>目前數值最佳的實驗</span><strong>{modelNames[best.model] ?? best.model}</strong><small>{areaLabel(area)} · {best.feature_set ? featureNames[best.feature_set] : "baseline｜比較基準"} · {num(best.mean_metrics[metric],4)}</small></div>
    <p className="lab-help"><b>{metricNames[metric]}：</b>{metricHelp[metric]} 這裡的「最佳」只代表開發期平均數值最好，是否能用於未來仍要看 locked holdout 最終測試。</p>
    <div className="bar-chart" role="img" aria-label={`${metricNames[metric]} 模型比較長條圖`}>
      {filtered.map(run=><div className="bar-row" key={run.run_id}><div className="bar-label"><b>{modelNames[run.model] ?? run.model}</b><span>{run.feature_set ? featureNames[run.feature_set] : "baseline｜比較基準"}</span></div><div className="bar-track"><i style={{width:width(run.mean_metrics[metric])}} className={run.kind === "baseline" ? "baseline" : "model"}/></div><code>{num(run.mean_metrics[metric],4)}</code></div>)}
    </div>
    <details className="data-table"><summary>顯示完整數字表格與欄位說明</summary><p className="body-copy">Mean 是所有時間測試輪次的平均；Fold SD 是各輪結果的波動程度，越大代表不同年份表現越不穩定。</p><div className="table-scroll"><table><thead><tr><th>Model｜模型</th><th>Feature set｜線索組合</th><th>Mean｜平均</th><th>Fold SD｜各輪波動</th></tr></thead><tbody>{filtered.map(run=><tr key={run.run_id}><td>{modelNames[run.model] ?? run.model}</td><td>{run.feature_set ? featureNames[run.feature_set] : "baseline｜比較基準"}</td><td>{num(run.mean_metrics[metric],4)}</td><td>{num(run.std_metrics[metric],4)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
