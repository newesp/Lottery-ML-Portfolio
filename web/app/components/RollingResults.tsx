import fs from "node:fs";
import path from "node:path";
import { NumberBall } from "./NumberBall";
import { ReplayPicker } from "./ReplayPicker";
import {
  areas,
  formatTimestamp,
  Grid,
  label,
  Tickets,
  versionLabel,
  zone,
} from "./RollingTables";
import type { Area, Draw, Prediction } from "./RollingTables";
import { Callout, Eyebrow } from "./UI";

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

function signedFixed(value: number, digits: number): string {
  const formatted = value.toFixed(digits);
  return value > 0 ? `+${formatted}` : formatted;
}

function signedPctPoints(value: number): string {
  const pct = value * 100;
  const formatted = `${pct.toFixed(1)}%`;
  return pct > 0 ? `+${formatted}` : formatted;
}

function VersionLegend() {
  return (
    <div className="rolling-legend" role="note" aria-label="版本對照說明">
      <span>
        <strong>v1（全部歷史）</strong>：以 2008 年至今全部開獎紀錄訓練，為目前現役正式版。
      </span>
      <span>
        <strong>v2（近 8 年）</strong>：僅取最近 8 年開獎紀錄每期重訓，為候選對照版。
      </span>
    </div>
  );
}

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
      headings={[
        "方案",
        c.plan.metric === "brier" ? "平均 Brier Score" : heading,
      ]}
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
      <div className="section-heading">
        <Eyebrow>WALK-FORWARD REPLAY ｜ 近一年逐期回測</Eyebrow>
        <h2>v1（全部歷史）與 v2（近 8 年）逐期重訓對照</h2>
      </div>
      <VersionLegend />
      {!report ? (
        <p className="muted">尚無逐期回測報告。</p>
      ) : (
        <>
          <p className="rolling-meta-line">
            統計區間：{report.start} 至 {report.as_of}（資料更新至{" "}
            {report.data_through ?? "尚無資料"}），共回測 {report.rows.length}／
            {report.eligible} 期。
            {report.insufficient_history.length > 0 &&
              `另有 ${report.insufficient_history.length} 期因訓練歷史不足未計入。`}
            {report.not_requested > 0 &&
              `本次為部分回測，另有 ${report.not_requested} 期未執行。`}
          </p>
          {areas.map((a) => {
            const m = report.metrics[a];
            const baselineHits = m?.hits["forward-v1/model"] ?? 0;
            return (
              m && (
                <Grid
                  key={a}
                  caption={zone[a]}
                  headings={[
                    "方案",
                    a === "area1" ? "平均每期命中" : "命中期數／共同期數",
                    a === "area1"
                      ? "相對 v1 模型（顆）"
                      : "相對 v1 模型（百分點）",
                  ]}
                  rows={[
                    ...Object.entries(m.hits).map(([key, value]) => {
                      const diff = value - baselineHits;
                      return [
                        label(key),
                        a === "area1"
                          ? value.toFixed(3)
                          : `${Math.round(value * report.rows.length)}／${report.rows.length}（${(value * 100).toFixed(1)}%）`,
                        key === "forward-v1/model"
                          ? "基準"
                          : a === "area1"
                            ? signedFixed(diff, 3)
                            : signedPctPoints(diff),
                      ];
                    }),
                    [
                      "隨機選號理論平均",
                      a === "area1"
                        ? m.uniform_hits.toFixed(3)
                        : `${(100 * m.uniform_hits).toFixed(1)}%`,
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
        <div className="rolling-subsection">
          <div className="section-heading">
            <Eyebrow>LATEST PUBLICATION ｜ 最近一期正式選號</Eyebrow>
            <h2>{published.target} 開獎前採用的選號</h2>
          </div>
          <Grid
            caption={`${published.target} 正式出號紀錄`}
            headings={["區域", "採用方案", "號碼"]}
            rows={areas.map((area) => [
              zone[area],
              label(published.methods[area]),
              <div className="ball-group" key={area}>
                {published.picks[area].map((n) => (
                  <NumberBall key={n} number={n} area={area} size="sm" />
                ))}
              </div>,
            ])}
          />
        </div>
      )}

      <div className="section-heading">
        <Eyebrow>ROLLING CANDIDATE ｜ v2 候選追蹤</Eyebrow>
        <h2>v2 候選方案（近 8 年資料）開獎前登記</h2>
      </div>
      <p className="body-copy">
        v2 只用最近 8 年開獎紀錄重新訓練，與現役的 v1（全部歷史）同步在開獎前登記，開獎後再一起對照成績。
      </p>
      <VersionLegend />

      {!!forward?.missed?.length && (
        <details className="rolling-details">
          <summary>錯過登記期限 {forward.missed.length} 筆</summary>
          <Grid
            caption="逾時未登記的方案"
            headings={["目標開獎日", "版本"]}
            rows={forward.missed.map((row) => [
              row.target,
              versionLabel(row.version),
            ])}
          />
        </details>
      )}

      {entries.length === 0 ? (
        <Callout tone="neutral" title="尚未累積 v2 事前登記">
          <p>
            目前還沒有事前登記紀錄。下一次在開獎前完成選號時，近 8 年的模型、歷史頻率與混合選號三組結果會一起顯示在這裡。
          </p>
        </Callout>
      ) : (
        <p className="rolling-meta-line">
          共 {entries.length} 筆登記，其中{" "}
          {entries.filter((e) => e.status === "resolved").length} 筆已結算、
          {entries.filter((e) => e.status === "pending").length} 筆待開獎。
        </p>
      )}

      {[...entries]
        .sort((a, b) => b.target.localeCompare(a.target))
        .map((e, i) => (
          <details
            key={e.version + e.target}
            className="rolling-details"
            open={i === 0}
          >
            <summary>
              {e.target} · {versionLabel(e.version)} · {label(e.status)}
            </summary>
            <p className="rolling-meta-line">
              登記時間：{formatTimestamp(e.generated_at)}（台灣時間）
            </p>
            {e.input_data_changed && (
              <p className="audit-warning-text">
                這期的訓練資料事後有勘誤，選號保留登記當時的內容。
              </p>
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
      <div className="section-heading">
        <Eyebrow>PROMOTION TRACKER ｜ 版本切換追蹤</Eyebrow>
        <h2>現役（v1）與候選（v2）換版進度</h2>
      </div>
      <VersionLegend />

      {forward?.published_methods && (
        <p className="rolling-meta-line">
          目前正式出號版本：
          {areas
            .map(
              (a) =>
                `${zone[a]} ${
                  forward.published_methods[a]
                    ? label(forward.published_methods[a]!)
                    : "尚無登記"
                }`,
            )
            .join(" ／ ")}
        </p>
      )}

      {!forward?.comparisons.length && (
        <Callout tone="neutral" title="尚未啟動正式比較">
          <p>
            等現役 v1 與候選 v2 在同一期開獎前都交出選號，才會開始累計換版依據。
          </p>
        </Callout>
      )}

      {forward?.comparisons.map((c) => (
        <details open key={c.plan.id} className="rolling-details">
          <summary>
            {zone[c.plan.area]} · {label(c.status)}
          </summary>
          <p className="rolling-meta-line">
            {label(c.plan.incumbent)} 與 {label(c.plan.candidate)}，共同結算{" "}
            {c.included.length}／{c.plan.required} 期，排除 {c.excluded.length}{" "}
            期。
          </p>
          {c.included.length > 0 && comparisonScores(c)}
          {c.interval && (
            <p className="rolling-meta-line">
              候選平均
              {c.plan.metric === "brier" ? "減少的預測誤差" : "增加的命中數"}為{" "}
              {signedFixed(c.interval.estimate, 4)}，95% 區間 [
              {c.interval.lower.toFixed(4)}, {c.interval.upper.toFixed(4)}]，
              登記的改善門檻為 {c.plan.margin}。
            </p>
          )}
          {c.exclusions_require_review && (
            <p className="audit-warning-text">
              部分期數被排除，採用結論前須核對缺漏原因。
            </p>
          )}
          {!!c.environment_changes?.length && (
            <p className="audit-warning-text">
              部分期數的執行環境與登記版本不同，請核對差異。
            </p>
          )}
          {c.evidence_changed && (
            <p className="audit-warning-text">資料有勘誤，請核對原決策。</p>
          )}
        </details>
      ))}

      <div className="rolling-subsection">
        <div className="section-heading">
          <Eyebrow>ROLLING CALIBRATION ｜ 近一年回測機率檢驗</Eyebrow>
          <h2>v2（近 8 年）近一年逐期回測：機率準確度與命中差</h2>
        </div>
        <p className="body-copy">
          近一年逐期回測共 {report?.rows.length ?? 0}{" "}
          期。第一區預測機率代表該號碼開出的機會；Brier Score 越低，代表機率估得越準。
        </p>
        {areas.map((a) => {
          const m = report?.metrics[a];
          return (
            m && (
              <div key={a} className="rolling-area-block">
                <Grid
                  caption={zone[a] + "機率評估"}
                  headings={["機率來源", "Brier Score"]}
                  rows={Object.entries(m.probabilities).map(([key, value]) => [
                    label(key),
                    value.brier.toFixed(5),
                  ])}
                />
                <details className="rolling-details">
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
                    caption="v2 混合選號減各對照方案"
                    headings={["對照方案", "平均差", "95% 描述性區間"]}
                    rows={Object.entries(m.mixed_differences).map(
                      ([key, v]) => [
                        label(key),
                        signedFixed(v.estimate, 3),
                        `[${v.lower.toFixed(3)}, ${v.upper.toFixed(3)}]`,
                      ],
                    )}
                  />
                  <p className="muted rolling-footnote">
                    相鄰兩期的訓練資料高度重疊，這裡的 95% 區間僅用來觀察波動範圍，不適合作為獨立樣本的顯著性檢定。
                  </p>
                </details>
              </div>
            )
          );
        })}
      </div>
    </section>
  );
}
