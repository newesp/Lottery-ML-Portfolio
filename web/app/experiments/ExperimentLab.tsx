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
import { TrophyIcon } from "../components/Icons";

export function ExperimentLab({ runs }: { runs: Run[] }) {
  const [area, setArea] = useState<"area1" | "area2">("area1");
  const [metric, setMetric] = useState("average_hits");
  const [feature, setFeature] = useState("all");
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

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
  const width = (value: number) => `${20 + ((value - min) / (max - min || 1)) * 80}%`;

  // Find baseline uniform score for reference if exists
  const baselineUniform = runs.find(
    (r) => r.area === area && r.kind === "baseline" && r.model === "uniform"
  );
  const baselineScore = baselineUniform?.mean_metrics[metric];

  return (
    <section className="lab" aria-label="實驗矩陣互動篩選">
      {/* 區域切換 Segmented Tabs */}
      <div className="lab-header-row">
        <div className="lab-segmented-group" role="tablist" aria-label="選擇號碼分區">
          <button
            type="button"
            role="tab"
            aria-selected={area === "area1"}
            className={`lab-tab ${area === "area1" ? "active" : ""}`}
            onClick={() => setArea("area1")}
          >
            <span className="tab-badge zone1">第 1 區</span>
            <span className="tab-title">{GAME.area1.max} 選 {GAME.area1.pick}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={area === "area2"}
            className={`lab-tab ${area === "area2" ? "active" : ""}`}
            onClick={() => setArea("area2")}
          >
            <span className="tab-badge zone2">第 2 區</span>
            <span className="tab-title">{GAME.area2.max} 選 {GAME.area2.pick}</span>
          </button>
        </div>

        <div className="lab-view-toggle" role="group" aria-label="檢視模式切換">
          <button
            type="button"
            className={`view-btn ${viewMode === "chart" ? "active" : ""}`}
            onClick={() => setViewMode("chart")}
            aria-label="長條圖比較"
          >
            長條圖
          </button>
          <button
            type="button"
            className={`view-btn ${viewMode === "table" ? "active" : ""}`}
            onClick={() => setViewMode("table")}
            aria-label="完整數據表格"
          >
            數據表
          </button>
        </div>
      </div>

      {/* 控制選單 Controls */}
      <div className="lab-controls">
        <label className="lab-control-field">
          <span className="control-label">評估指標（Metric）</span>
          <select
            className="lab-select"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            {Object.entries(METRIC_NAMES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="lab-control-field">
          <span className="control-label">特徵組合（Feature Set）</span>
          <select
            className="lab-select"
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
          >
            <option value="all">全部模型與基準（含 Baseline）</option>
            {Object.entries(FEATURE_NAMES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* 最佳表現 Highlight Banner */}
      {best && (
        <div className="lab-summary">
          <div className="lab-summary-lead">
            <span className="lab-trophy-badge">
              <TrophyIcon size={14} />
              開發期驗證最佳
            </span>
            <strong>{MODEL_NAMES[best.model] ?? best.model}</strong>
          </div>
          <div className="lab-summary-details">
            <span className="summary-meta">
              {areaLabel(area)} ·{" "}
              {best.feature_set ? FEATURE_NAMES[best.feature_set] : "baseline 比較基準"}
            </span>
            <span className="summary-score">
              {METRIC_NAMES[metric]}：<b>{num(best.mean_metrics[metric], 4)}</b>
            </span>
          </div>
        </div>
      )}

      {/* 指標說明提示 */}
      <p className="lab-help">
        <b>{METRIC_NAMES[metric]}：</b>
        {METRIC_HELP[metric]} 
        {baselineScore !== undefined && (
          <span className="lab-baseline-hint">
            （隨機選號基準值：<code>{num(baselineScore, 4)}</code>）
          </span>
        )}
      </p>

      {/* 長條圖檢視 Chart View */}
      {viewMode === "chart" ? (
        <div
          className="bar-chart"
          role="region"
          aria-label={`${METRIC_NAMES[metric]} 模型比較長條圖`}
        >
          {filtered.map((run, idx) => {
            const isBaseline = run.kind === "baseline";
            const val = run.mean_metrics[metric];
            const isTop = idx === 0;

            return (
              <div
                className={`bar-row ${isTop ? "is-top" : ""} ${isBaseline ? "is-baseline" : ""}`}
                key={run.run_id}
              >
                <div className="bar-label">
                  <div className="bar-title-line">
                    <span className="bar-rank">{String(idx + 1).padStart(2, "0")}</span>
                    <b>{MODEL_NAMES[run.model] ?? run.model}</b>
                    <span className={`bar-kind-tag ${isBaseline ? "baseline" : "model"}`}>
                      {isBaseline ? "Baseline" : "ML"}
                    </span>
                  </div>
                  <span className="bar-feature-sub">
                    {run.feature_set ? FEATURE_NAMES[run.feature_set] : "統計基準"}
                  </span>
                </div>

                <div className="bar-track-wrap">
                  <div className="bar-track">
                    <i
                      className={`${isBaseline ? "baseline" : ""} ${isTop ? "top" : ""}`}
                      style={{ width: width(val) }}
                    />
                  </div>
                </div>

                <div className="bar-val-col">
                  <code>{num(val, 4)}</code>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 表格檢視 Table View */
        <div className="table-scroll">
          <table className="lab-table">
            <thead>
              <tr>
                <th scope="col">排名</th>
                <th scope="col">模型名稱</th>
                <th scope="col">類別</th>
                <th scope="col">特徵集</th>
                <th scope="col" style={{ textAlign: "right" }}>{METRIC_NAMES[metric]}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((run, idx) => {
                const isBaseline = run.kind === "baseline";
                return (
                  <tr key={run.run_id} className={idx === 0 ? "top-row" : ""}>
                    <td className="rank-cell">{idx + 1}</td>
                    <td><b>{MODEL_NAMES[run.model] ?? run.model}</b></td>
                    <td>
                      <span className={`bar-kind-tag ${isBaseline ? "baseline" : "model"}`}>
                        {isBaseline ? "Baseline" : "ML Model"}
                      </span>
                    </td>
                    <td>{run.feature_set ? FEATURE_NAMES[run.feature_set] : "統計比較基準"}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      <b>{num(run.mean_metrics[metric], 4)}</b>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
