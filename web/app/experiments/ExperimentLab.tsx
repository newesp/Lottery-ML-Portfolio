"use client";

import { useMemo, useState } from "react";
import { GAME } from "../lib/constants";
import {
  FEATURE_NAMES,
  METRIC_HELP,
  METRIC_NAMES,
  MODEL_NAMES,
  areaLabel,
} from "../lib/labels";
import { num } from "../lib/format";
import type { Run } from "../lib/results";

export function ExperimentLab({ runs }: { runs: Run[] }) {
  const [area, setArea] = useState<"area1" | "area2">("area1");
  const [metric, setMetric] = useState("average_hits");
  const [feature, setFeature] = useState("all");

  const filtered = useMemo(
    () =>
      runs
        .filter(
          (run) =>
            run.area === area &&
            (run.kind === "baseline" || feature === "all" || run.feature_set === feature)
        )
        .sort((a, b) =>
          metric === "brier_score" || metric === "log_loss"
            ? a.mean_metrics[metric] - b.mean_metrics[metric]
            : b.mean_metrics[metric] - a.mean_metrics[metric]
        ),
    [runs, area, metric, feature]
  );

  const best = filtered[0];
  const values = filtered.map((run) => run.mean_metrics[metric]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (value: number) => `${22 + ((value - min) / (max - min || 1)) * 78}%`;

  return (
    <section className="lab" aria-label="實驗矩陣互動篩選">
      <div className="lab-controls">
        <label>
          號碼區域
          <select
            value={area}
            onChange={(e) => setArea(e.target.value as "area1" | "area2")}
          >
            <option value="area1">
              第一區：{GAME.area1.max} 選 {GAME.area1.pick}
            </option>
            <option value="area2">
              第二區：{GAME.area2.max} 選 {GAME.area2.pick}
            </option>
          </select>
        </label>
        <label>
          評估指標
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            {Object.entries(METRIC_NAMES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Feature set｜特徵組合
          <select value={feature} onChange={(e) => setFeature(e.target.value)}>
            <option value="all">全部模型與基準方法</option>
            {Object.entries(FEATURE_NAMES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="lab-summary">
        <span>開發期帳面表現最佳</span>
        <strong>{MODEL_NAMES[best.model] ?? best.model}</strong>
        <small>
          {areaLabel(area)} ·{" "}
          {best.feature_set ? FEATURE_NAMES[best.feature_set] : "baseline｜比較基準"} ·{" "}
          {num(best.mean_metrics[metric], 4)}
        </small>
      </div>
      <p className="lab-help">
        <b>{METRIC_NAMES[metric]}：</b>
        {METRIC_HELP[metric]} 這裡的「最佳」僅代表開發期時間驗證的平均分數最高；能否通過真實考驗，仍須視最終封存盲測（Locked Holdout）的表現而定。
      </p>
      <div
        className="bar-chart"
        role="img"
        aria-label={`${METRIC_NAMES[metric]} 模型比較長條圖`}
      >
        {filtered.map((run) => (
          <div className="bar-row" key={run.run_id}>
            <div className="bar-label">
              <b>{MODEL_NAMES[run.model] ?? run.model}</b>
              <span>
                {run.feature_set ? FEATURE_NAMES[run.feature_set] : "baseline｜比較基準"}
              </span>
            </div>
            <div className="bar-track">
              <i
                style={{ width: width(run.mean_metrics[metric]) }}
                className={run.kind === "baseline" ? "baseline" : "model"}
              />
            </div>
            <code>{num(run.mean_metrics[metric], 4)}</code>
          </div>
        ))}
      </div>
      <details className="data-table">
        <summary>展開完整數據表格與欄位說明</summary>
        <p className="body-copy">
          Mean 代表各年度驗證輪次的平均成績；Fold SD（標準差）則反映不同年份之間的表現波動，數值越大代表跨年度表現越不穩定。
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Model｜模型與基準</th>
                <th>Feature set｜特徵組合</th>
                <th>Mean｜各輪平均</th>
                <th>Fold SD｜跨年波動</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((run) => (
                <tr key={run.run_id}>
                  <td>{MODEL_NAMES[run.model] ?? run.model}</td>
                  <td>
                    {run.feature_set
                      ? FEATURE_NAMES[run.feature_set]
                      : "baseline｜比較基準"}
                  </td>
                  <td>{num(run.mean_metrics[metric], 4)}</td>
                  <td>{num(run.std_metrics[metric], 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
