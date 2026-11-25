import fs from "node:fs";
import path from "node:path";
import { ReplayPicker } from "./ReplayPicker";
import { areas, Grid, label, Tickets, zone } from "./RollingTables";
import type { Area, Draw, Prediction } from "./RollingTables";

type Interval = { estimate: number; lower: number; upper: number };
type Bin = { count: number; sum: number; wins: number; draw_count: number };
type AreaMetrics = {
  hits: Record<string, number>;
  uniform_hits: number;
  mixed_differences: Record<string, Interval>;
  probabilities: Record<string, { brier: number; bins: Bin[] }>;
};
type Replay = {
  as_of: string;
  start: string;
  data_through: string | null;
  eligible: number;
  insufficient_history: string[];
  not_requested: number;
  rows: { actual: Draw; predictions: Record<string, Prediction> }[];
  metrics: Partial<Record<Area, AreaMetrics>>;
};
type Comparison = {
  plan: {
    id: string;
    required: number;
    area: Area;
    incumbent: string;
    candidate: string;
    metric: "hits" | "brier";
    margin: number;
  };
  included: { target: string; incumbent: number; candidate: number }[];
  excluded: unknown[];
  status: string;
  exclusions_require_review?: boolean;
  environment_changes?: unknown[];
  interval: Interval | null;
  evidence_changed?: boolean;
};

function comparisonScores(c: Comparison) {
  const showRate = c.plan.metric === "hits" && c.plan.area === "area2";
  const rows = (["incumbent", "candidate"] as const).map((role) => {
    const sum = c.included.reduce((total, row) => total + row[role], 0);
    const average = sum / c.included.length;
    const score = showRate
      ? `${sum}／${c.included.length}（${(average * 100).toFixed(1)}%）`
      : average.toFixed(4);
    return [label(c.plan[role]), score];
  });
  const heading = showRate ? "命中期數／共同期數" : "平均每期命中";
  return (
    <Grid
      caption={zone[c.plan.area] + "共同期數的前瞻成績"}
      headings={["方案", c.plan.metric === "brier" ? "平均 Brier score" : heading]}
      rows={rows}
    />
  );
}

type Forward = {
  missed?: { target: string; version: string }[];
  published_methods: Record<Area, string | null>;
  last_publication: {
    target: string;
    methods: Record<Area, string>;
    picks: Record<Area, number[]>;
  } | null;
  entries: (Prediction & {
    version: string;
    target: string;
    actual: Draw | null;
    generated_at: string;
    input_data_changed?: boolean;
    status: string;
  })[];
  comparisons: Comparison[];
};

function readReport<T>(file: string): T | null {
  for (const base of [process.cwd(), path.dirname(process.cwd())]) {
    const source = path.join(base, "artifacts", file);
    if (fs.existsSync(source))
      return JSON.parse(fs.readFileSync(source, "utf8")) as T;
  }
  return null;
}

export function RollingReplay() {
  const report = readReport<Replay>("experiments/walk-forward-v2.json");
  return (
    <section className="content-section rolling-results">
      <h2>近一年逐期回測</h2>
      {!report ? (
        <p>尚無逐期回測報告。</p>
      ) : (
        <>
          <p>
            {report.start} 至 {report.as_of}，資料更新至{" "}
            {report.data_through ?? "尚無資料"}。 已比較 {report.rows.length}／
            {report.eligible} 期，訓練歷史不足{" "}
            {report.insufficient_history.length} 期。
            {report.not_requested > 0 &&
              `本次為部分回測，另有 ${report.not_requested} 期未執行。`}
          </p>
          {areas.map((a) => {
            const m = report.metrics[a];
            return (
              m && (
                <Grid
                  key={a}
                  caption={zone[a]}
                  headings={[
                    "方案",
                    a === "area1" ? "平均每期命中" : "命中期數／共同期數",
                    "相對 v1 模型",
                  ]}
                  rows={[
                    ...Object.entries(m.hits).map(([key, value]) => [
                      label(key),
                      a === "area1"
                        ? value.toFixed(3)
                        : `${Math.round(value * report.rows.length)}／${report.rows.length}（${(value * 100).toFixed(1)}%）`,
                      (value - m.hits["forward-v1/model"]).toFixed(3),
                    ]),
                    [
                      "隨機選號理論平均",
                      a === "area1"
                        ? m.uniform_hits.toFixed(3)
                        : `${100 * m.uniform_hits}%`,
                      "—",
                    ],
                  ]}
                />
              )
            );
          })}
          <ReplayPicker
            rows={[...report.rows].reverse().map((r) => ({
              actual: r.actual,
              predictions: Object.fromEntries(
                Object.entries(r.predictions).map(([version, p]) => [
                  version,
                  {
                    train_count: p.train_count,
                    train_first: p.train_first,
                    train_last: p.train_last,
                    areas: {
                      area1: { picks: p.areas.area1.picks },
                      area2: { picks: p.areas.area2.picks },
                    },
                  },
                ]),
              ),
            }))}
          />
        </>
      )}
    </section>
  );
}

export function RollingForward() {
  const forward = readReport<Forward>("forward/v2/summary.json");
  const entries = forward?.entries ?? [];
  const published = forward?.last_publication;
  return (
    <section className="content-section rolling-results">
      {published && (
        <>
          <h2>最近一期正式選號</h2>
          <Grid
            caption={published.target + " 開獎前採用的選號"}
            headings={["區域", "採用方案", "號碼"]}
            rows={areas.map((area) => [
              zone[area],
              label(published.methods[area]),
              published.picks[area].join("、"),
            ])}
          />
        </>
      )}
      <h2>八年方案的開獎前登記</h2>
      {!!forward?.missed?.length && (
        <details>
          <summary>錯過登記期限 {forward.missed.length} 筆</summary>
          <Grid
            caption="逾時未登記的方案"
            headings={["目標開獎日", "版本"]}
            rows={forward.missed.map((row) => [row.target, row.version])}
          />
        </details>
      )}
      {entries.length === 0 && (
        <p>
          目前有 0
          期事前登記。下一次在截止前完成選號時，三組號碼會一起出現在這裡。
        </p>
      )}
      {entries.length > 0 && (
        <p>
          共 {entries.length} 筆登記，其中{" "}
          {entries.filter((e) => e.status === "resolved").length} 筆已結算，
          {entries.filter((e) => e.status === "pending").length} 筆待開獎。
        </p>
      )}
      {[...entries]
        .sort((a, b) => b.target.localeCompare(a.target))
        .map((e, i) => (
          <details key={e.version + e.target} open={i === 0}>
            <summary>
              {e.target} · {e.version} · {label(e.status)}
            </summary>
            <p>登記時間 {e.generated_at}</p>
            {e.input_data_changed && (
              <p>這期的訓練資料事後有勘誤，選號保留登記當時的內容。</p>
            )}
            <Tickets prediction={e} actual={e.actual} />
          </details>
        ))}
    </section>
  );
}

export function RollingEvaluation() {
  const forward = readReport<Forward>("forward/v2/summary.json");
  const report = readReport<Replay>("experiments/walk-forward-v2.json");
  return (
    <section className="content-section rolling-results">
      <h2>換版進度</h2>
      {forward?.published_methods && (
        <p>
          最近實際出號版本　
          {areas
            .map(
              (a) =>
                zone[a] +
                " " +
                (forward.published_methods[a]
                  ? label(forward.published_methods[a]!)
                  : "尚無登記"),
            )
            .join(" ／ ")}
        </p>
      )}
      {!forward?.comparisons.length && (
        <p>
          尚未登記正式比較。等兩版在同一期開獎前都交出選號，才開始累積換版依據。
        </p>
      )}
      {forward?.comparisons.map((c) => (
        <details open key={c.plan.id}>
          <summary>
            {zone[c.plan.area]} · {label(c.status)}
          </summary>
          <p>
            {label(c.plan.incumbent)} 與 {label(c.plan.candidate)}，共同結算{" "}
            {c.included.length}／{c.plan.required} 期，排除 {c.excluded.length}{" "}
            期。
          </p>
          {c.included.length > 0 && comparisonScores(c)}
          {c.interval && (
            <p>
              候選平均
              {c.plan.metric === "brier" ? "減少的預測誤差" : "增加的命中數"}為{" "}
              {c.interval.estimate.toFixed(4)}，95% 區間 [
              {c.interval.lower.toFixed(4)}, {c.interval.upper.toFixed(4)}]，
              登記的改善門檻為 {c.plan.margin}。
            </p>
          )}
          {c.exclusions_require_review && (
            <p>部分期數被排除，採用結論前須核對缺漏原因。</p>
          )}
          {!!c.environment_changes?.length && (
            <p>部分期數的執行環境與登記版本不同，請核對差異。</p>
          )}
          {c.evidence_changed && <p>資料有勘誤，請核對原決策。</p>}
        </details>
      ))}
      <h2>八年方案的機率與命中差</h2>
      <p>
        歷史重播共 {report?.rows.length ?? 0}{" "}
        期。第一區的機率代表該號碼入選六顆球的機會。Brier score
        愈小，代表機率估得愈準。
      </p>
      {areas.map((a) => {
        const m = report?.metrics[a];
        return (
          m && (
            <div key={a}>
              <Grid
                caption={zone[a] + "機率評估"}
                headings={["機率來源", "Brier score"]}
                rows={Object.entries(m.probabilities).map(([key, value]) => [
                  label(key),
                  value.brier.toFixed(5),
                ])}
              />
              <details>
                <summary>{zone[a]}機率分組與混合選號命中差</summary>
                {Object.entries(m.probabilities).map(([key, value]) => (
                  <Grid
                    key={key}
                    caption={label(key)}
                    headings={[
                      "機率範圍",
                      "平均預測",
                      "實際開出",
                      "候選數／期數",
                    ]}
                    rows={value.bins.flatMap((b, i) =>
                      b.count
                        ? [
                            [
                              `${i * 10}–${(i + 1) * 10}%`,
                              (b.sum / b.count).toFixed(3),
                              (b.wins / b.count).toFixed(3),
                              `${b.count}／${b.draw_count}`,
                            ],
                          ]
                        : [],
                    )}
                  />
                ))}
                <Grid
                  caption="混合選號減各對照方案"
                  headings={["對照", "平均差", "95% 描述性區間"]}
                  rows={Object.entries(m.mixed_differences).map(([key, v]) => [
                    label(key),
                    v.estimate.toFixed(3),
                    `[${v.lower.toFixed(3)}, ${v.upper.toFixed(3)}]`,
                  ])}
                />
                <p>相鄰期共用大部分訓練資料，請連同期數解讀區間。</p>
              </details>
            </div>
          )
        );
      })}
    </section>
  );
}
