import type { ReactNode } from "react";

export type Area = "area1" | "area2";
export type Prediction = {
  train_first: string;
  train_last: string;
  train_count: number;
  areas: Record<Area, { picks: Record<string, number[]> }>;
};
export type Draw = { draw_date: string; area1: number[]; area2: number };
export const areas: Area[] = ["area1", "area2"];
export const zone = { area1: "第一區", area2: "第二區" };
const names: Record<string, string> = {
  model: "模型",
  historical_frequency: "歷史頻率",
  mixed: "混合選號",
  adjusted: "調整後機率",
  raw: "原始分數",
  uniform: "均勻機率",
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

export function label(key: string) {
  const [version, method] = key.split("/");
  return method
    ? (version === "forward-v1"
        ? "v1"
        : version === "rolling-v2"
          ? "v2"
          : version) +
        " " +
        names[method]
    : (names[key] ?? key);
}

export function Grid({
  caption,
  headings,
  rows,
}: {
  caption: string;
  headings: string[];
  rows: ReactNode[][];
}) {
  return (
    <div
      className="rolling-scroll"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headings.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([first, ...rest], i) => (
            <tr key={i}>
              <th scope="row">{first}</th>
              {rest.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
  return (
    <>
      <p>
        訓練紀錄 {prediction.train_first} 至 {prediction.train_last}，共{" "}
        {prediction.train_count} 期。
      </p>
      {actual && (
        <p>
          開獎號碼　{actual.area1.join("、")} ／ 第二區 {actual.area2}
        </p>
      )}
      {areas.map((area) => (
        <Grid
          key={area}
          caption={zone[area]}
          headings={["方案", "號碼", "命中"]}
          rows={Object.entries(prediction.areas[area].picks).map(
            ([key, picks]) => {
              const wins = actual
                ? area === "area1"
                  ? actual.area1
                  : [actual.area2]
                : [];
              return [
                label(key),
                picks.map((n, i) => (
                  <span key={n}>
                    {i > 0 && "、"}
                    {wins.includes(n) ? <strong>{n}</strong> : n}
                  </span>
                )),
                actual
                  ? picks.filter((n) => wins.includes(n)).length
                  : "待開獎",
              ];
            },
          )}
        />
      ))}
    </>
  );
}
