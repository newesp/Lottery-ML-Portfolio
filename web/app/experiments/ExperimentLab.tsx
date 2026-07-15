"use client";

import { useMemo, useState } from "react";
import type { Run } from "../lib/results";
import { areaLabel, num } from "../lib/results";

const modelNames: Record<string,string> = {logistic_regression:"Logistic Regression",random_forest:"Random Forest",lightgbm:"LightGBM",uniform:"Uniform",rolling_frequency:"Rolling Frequency",shuffled_history:"Shuffled History"};
const metricNames: Record<string,string> = {average_hits:"Average hits",lift_over_uniform:"Lift over uniform",brier_score:"Brier score",log_loss:"Log loss"};

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
      <label>號碼區域<select value={area} onChange={e=>setArea(e.target.value as "area1"|"area2")}><option value="area1">第一區 6 / 38</option><option value="area2">第二區 1 / 8</option></select></label>
      <label>評估指標<select value={metric} onChange={e=>setMetric(e.target.value)}>{Object.entries(metricNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>Feature set<select value={feature} onChange={e=>setFeature(e.target.value)}><option value="all">全部比較</option><option value="frequency">frequency</option><option value="frequency_gap">frequency_gap</option><option value="temporal_context">temporal_context</option><option value="full">full</option></select></label>
    </div>
    <div className="lab-summary"><span>目前最佳（依所選指標）</span><strong>{modelNames[best.model] ?? best.model}</strong><small>{areaLabel(area)} · {best.feature_set ?? "baseline"} · {num(best.mean_metrics[metric],4)}</small></div>
    <div className="bar-chart" role="img" aria-label={`${metricNames[metric]} 模型比較長條圖`}>
      {filtered.map(run=><div className="bar-row" key={run.run_id}><div className="bar-label"><b>{modelNames[run.model] ?? run.model}</b><span>{run.feature_set ?? "baseline"}</span></div><div className="bar-track"><i style={{width:width(run.mean_metrics[metric])}} className={run.kind === "baseline" ? "baseline" : "model"}/></div><code>{num(run.mean_metrics[metric],4)}</code></div>)}
    </div>
    <details className="data-table"><summary>顯示可存取的結果表格</summary><div className="table-scroll"><table><thead><tr><th>Model</th><th>Feature set</th><th>Mean</th><th>Fold SD</th></tr></thead><tbody>{filtered.map(run=><tr key={run.run_id}><td>{modelNames[run.model] ?? run.model}</td><td>{run.feature_set ?? "baseline"}</td><td>{num(run.mean_metrics[metric],4)}</td><td>{num(run.std_metrics[metric],4)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
