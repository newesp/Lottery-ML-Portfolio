import type { ReactNode } from "react";
import { NumberBall } from "./NumberBall";

export type Area = "area1" | "area2";
export type Prediction = {
  train_first: string;
  train_last: string;
  train_count: number;
  areas: Record<Area, { picks: Record<string, number[]> }>;
};
export type Draw = { draw_date: string; area1: number[]; area2: number };
export const areas: Area[] = ["area1", "area2"];
export const zone: Record<Area, string> = { area1: "第一區", area2: "第二區" };

const VERSION_LABELS: Record<string, string> = {
  "forward-v1": "v1（全部歷史）",
  "rolling-v2": "v2（近 8 年）",
};

const METHOD_LABELS: Record<string, string> = {
  "forward-v1/model": "v1 模型（全部歷史・現役）",
  "forward-v1/historical_frequency": "v1 歷史頻率（全部歷史）",
  "rolling-v2/model": "v2 模型（近 8 年）",
  "rolling-v2/historical_frequency": "v2 歷史頻率（近 8 年）",
  "rolling-v2/mixed": "v2 混合選號（近 8 年）",
};

const names: Record<string, string> = {
  model: "模型",
  historical_frequency: "歷史頻率",
  mixed: "混合選號",
  adjusted: "校準後機率",
  raw: "模型原始機率",
  uniform: "隨機選號（均勻機率）",
  resolved: "已結算",
  pending: "待開獎",
  late: "逾時",
  mismatch: "目標期別不符",
  collecting: "收集中",
  promote: "選定候選",
  retain: "留用現役",
  archive: "封存候選",
  review_exclusions: "待核對排除期數",
};

export function versionLabel(version: string): string {
  return VERSION_LABELS[version] ?? version;
}

export function label(key: string): string {
  if (METHOD_LABELS[key]) return METHOD_LABELS[key];
  const [version, method] = key.split("/");
  if (method) {
    return `${versionLabel(version)} ${names[method] ?? method}`;
  }
  return names[key] ?? key;
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function Grid({
  caption,
  headings,
  rows,
  alignRight = [],
  colWidths,
}: {
  caption: string;
  headings: string[];
  rows: ReactNode[][];
  alignRight?: number[];
  colWidths?: string[];
}) {
  const rightSet = new Set(alignRight);
  return (
    <div className="rolling-grid-wrap">
      <div className="rolling-grid-caption">{caption}</div>
      <div
        className="table-scroll"
        role="region"
        aria-label={caption}
        tabIndex={0}
      >
        <table className="lab-table rolling-table">
          {colWidths && (
            <colgroup>
              {colWidths.map((w, idx) => (
                <col key={idx} style={{ width: w }} />
              ))}
            </colgroup>
          )}
          <thead>
            <tr>
              {headings.map((h, idx) => (
                <th
                  key={h}
                  scope="col"
                  className={rightSet.has(idx) ? "num-col" : undefined}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([first, ...rest], i) => (
              <tr key={i}>
                <th
                  scope="row"
                  className={`rolling-row-head${rightSet.has(0) ? " num-col" : ""}`}
                >
                  {first}
                </th>
                {rest.map((cell, j) => (
                  <td
                    key={j}
                    className={rightSet.has(j + 1) ? "num-col" : undefined}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Tickets({
  prediction,
  actual,
}: {
  prediction: Prediction;
  actual: Draw | null;
}) {
  const methodKeys = Array.from(
    new Set([
      ...Object.keys(prediction.areas.area1.picks),
      ...Object.keys(prediction.areas.area2.picks),
    ]),
  );

  return (
    <div className="rolling-tickets">
      <div className="rolling-ticket-meta">
        <span>
          訓練資料：{prediction.train_first} 至 {prediction.train_last}（共{" "}
          {prediction.train_count} 期）
        </span>
        {actual && (
          <div className="rolling-actual-line">
            <span className="rolling-actual-label">實際開獎：</span>
            <div className="ball-group">
              {actual.area1.map((n) => (
                <NumberBall key={n} number={n} area="area1" size="sm" />
              ))}
              <span className="ball-sep" aria-hidden="true">
                +
              </span>
              <NumberBall number={actual.area2} area="area2" size="sm" />
            </div>
          </div>
        )}
      </div>

      <Grid
        caption="各方案選號與命中對照"
        headings={["方案", "選號（第一區 + 第二區）", "命中"]}
        alignRight={[2]}
        colWidths={["24%", "50%", "26%"]}
        rows={methodKeys.map((key) => {
          const picks1 = prediction.areas.area1.picks[key] ?? [];
          const picks2 = prediction.areas.area2.picks[key] ?? [];
          const wins1 = actual ? actual.area1 : [];
          const win2 = actual ? actual.area2 : null;
          const hit1 = picks1.filter((n) => wins1.includes(n)).length;
          const hit2 = picks2.filter((n) => win2 !== null && n === win2).length;

          return [
            label(key),
            <div className="ball-group" key={key}>
              {picks1.map((n) => (
                <NumberBall
                  key={`a1-${n}`}
                  number={n}
                  area="area1"
                  size="sm"
                  isHit={wins1.includes(n)}
                />
              ))}
              {picks1.length > 0 && picks2.length > 0 && (
                <span className="ball-sep" aria-hidden="true">
                  +
                </span>
              )}
              {picks2.map((n) => (
                <NumberBall
                  key={`a2-${n}`}
                  number={n}
                  area="area2"
                  size="sm"
                  isHit={win2 !== null && n === win2}
                />
              ))}
            </div>,
            actual ? (
              <span className="hits-tag">
                第一區 <b>{hit1}</b> 顆／第二區 <b>{hit2}</b> 顆
              </span>
            ) : (
              <span className="status-pill pending">待開獎</span>
            ),
          ];
        })}
      />
    </div>
  );
}
