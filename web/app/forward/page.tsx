import { Callout, Eyebrow, Metric, PageIntro, RepoLink } from "../components/UI";
import { NumberBall } from "../components/NumberBall";
import { getForwardSummary } from "../lib/forward";
import { num } from "../lib/format";

export const metadata = {
  title: "前瞻盲測",
  description: "在開獎前記錄模型預測，開獎後依據不可改寫的帳本計算命中數。",
};

export default function ForwardPage() {
  const summary = getForwardSummary();

  if (!summary) {
    return (
      <div className="page section-shell">
        <PageIntro
          eyebrow="FORWARD TEST · 前瞻盲測"
          title="在開獎前寫下預測，開獎後才計分"
        >
          <p>
            本專案將機器學習模型在尚未開獎時的預測，鎖定於公開且只增不減的帳本（ledger.jsonl），並在開獎後自動結算真實盲測成績。
          </p>
        </PageIntro>
        <Callout tone="warning" title="前瞻盲測尚未啟動">
          <p>
            目前尚未偵測到前瞻盲測資料（<code>artifacts/forward/summary.json</code>）。當排程完成第一次預測後，此處將自動呈現最新預測號碼與盲測紀錄。
          </p>
        </Callout>
      </div>
    );
  }

  const { latest_pending, expected_hits_uniform, aggregate, entries } = summary;

  return (
    <div className="page section-shell">
      <PageIntro
        eyebrow="FORWARD TEST · 前瞻盲測"
        title="在開獎前寫下預測，開獎後才計分"
      >
        <p>
          為徹底消除後見之明與資料洩漏疑慮，本頁面所有預測均在開獎當天 20:00 前由自動化流程計算並鎖定至公開帳本，開獎後再依據同一份帳本結算命中成績。
        </p>
        <p style={{ marginTop: "12px", fontSize: "0.85rem", color: "var(--muted)" }}>
          原始預測紀錄請見 <RepoLink path="artifacts/forward/ledger.jsonl">artifacts/forward/ledger.jsonl</RepoLink>（不可修改的 append-only 帳本）。
        </p>
      </PageIntro>

      {/* 下一期預測 */}
      <section className="content-section">
        <div className="section-heading">
          <Eyebrow>NEXT DRAW PREDICTION · 下一期盲測號碼</Eyebrow>
          <h2>{latest_pending ? `目標開獎日：${latest_pending.assumed_target_date}` : "目前尚無待開獎的預測"}</h2>
        </div>

        {latest_pending ? (
          <div className="lab" style={{ background: "white", padding: "30px" }}>
            <p className="muted" style={{ margin: "0 0 20px" }}>
              依據截至 {latest_pending.cutoff_draw_id} 的全部已驗證歷史開獎資料，模型在開獎前鎖定的推薦組合：
            </p>

            <div className="forward-row">
              <span className="forward-row-label">模型推薦（selection-v1 RF ensemble）</span>
              <div className="ball-group">
                {latest_pending.predictions.model.area1.picks.map((n) => (
                  <NumberBall key={n} number={n} area="area1" size="lg" />
                ))}
                <span style={{ marginInline: "6px", color: "var(--muted)", fontWeight: 900 }}>+</span>
                <NumberBall number={latest_pending.predictions.model.area2.picks[0]} area="area2" size="lg" />
              </div>
            </div>

            <div className="forward-row" style={{ marginTop: "20px" }}>
              <span className="forward-row-label">歷史累積頻率 baseline</span>
              <div className="ball-group">
                {latest_pending.predictions.historical_frequency.area1.picks.map((n) => (
                  <NumberBall key={n} number={n} area="area1" size="md" />
                ))}
                <span style={{ marginInline: "6px", color: "var(--muted)", fontWeight: 900 }}>+</span>
                <NumberBall number={latest_pending.predictions.historical_frequency.area2.picks[0]} area="area2" size="md" />
              </div>
            </div>

            <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--line)", fontSize: "0.85rem", color: "var(--muted)" }}>
              隨機選號理論期望命中：第一區 {num(expected_hits_uniform.area1, 3)} 顆／第二區 {num(expected_hits_uniform.area2, 3)} 顆
            </div>
          </div>
        ) : (
          <p className="muted">
            上一期預測已開獎結算，下次預測將於開獎資料更新時自動建立並鎖定。
          </p>
        )}
      </section>

      {/* 累積成績 */}
      <section className="content-section">
        <div className="section-heading">
          <Eyebrow>CUMULATIVE PERFORMANCE · 累積盲測成績</Eyebrow>
          <h2>在全新未見資料上的真實表現</h2>
        </div>

        <div className="metrics-grid compact">
          <Metric
            value={String(aggregate.resolved_count)}
            label="已結算期數"
            note={aggregate.unpredicted_draws_since_start > 0 ? `期間漏測 ${aggregate.unpredicted_draws_since_start} 期` : "無漏測期數"}
          />
          <Metric
            value={aggregate.resolved_count > 0 ? num(aggregate.mean_hits.model.area1, 3) : "尚無資料"}
            label="模型第一區平均命中"
            note={`第二區 ${aggregate.resolved_count > 0 ? num(aggregate.mean_hits.model.area2, 3) : "尚無資料"}`}
          />
          <Metric
            value={aggregate.resolved_count > 0 ? num(aggregate.mean_hits.historical_frequency.area1, 3) : "尚無資料"}
            label="歷史累積頻率第一區"
            note={`第二區 ${aggregate.resolved_count > 0 ? num(aggregate.mean_hits.historical_frequency.area2, 3) : "尚無資料"}`}
          />
          <Metric
            value={num(expected_hits_uniform.area1, 3)}
            label="隨機理論期望值"
            note={`第二區 ${num(expected_hits_uniform.area2, 3)}`}
          />
        </div>

        {aggregate.resolved_count < 30 && (
          <Callout tone="warning" title="統計推論限制">
            <p>
              目前已結算期數為 {aggregate.resolved_count} 期（未滿 30 期）。在小樣本下，平均命中數受單次開獎隨機波動影響極大，暫不進行統計檢定或推論。
            </p>
          </Callout>
        )}
      </section>

      {/* 第一區模型分數 Top 10 */}
      {latest_pending && latest_pending.predictions.model.area1.top_scores.length > 0 && (
        <section className="content-section">
          <div className="section-heading">
            <Eyebrow>PROBABILITY RANKING · 第一區模型機率 Top 10</Eyebrow>
            <h2>當期評分最高的號碼</h2>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>名次</th>
                  <th>號碼</th>
                  <th>模型預測機率</th>
                  <th>選號狀態</th>
                </tr>
              </thead>
              <tbody>
                {latest_pending.predictions.model.area1.top_scores.map(([number, score], index) => {
                  const isPicked = latest_pending.predictions.model.area1.picks.includes(number);
                  return (
                    <tr key={number}>
                      <td>#{index + 1}</td>
                      <td>
                        <NumberBall number={number} area="area1" size="sm" />
                      </td>
                      <td><code>{num(score, 6)}</code></td>
                      <td>
                        {isPicked ? (
                          <span style={{ fontWeight: 800, color: "#168e8a" }}>★ 推薦選號 (Top 6)</span>
                        ) : (
                          <span className="muted">候選</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 歷史盲測紀錄表 */}
      <section className="content-section">
        <div className="section-heading">
          <Eyebrow>AUDIT LOG · 盲測審計紀錄表</Eyebrow>
          <h2>每期預測與實際開獎核對</h2>
        </div>

        {entries.length === 0 ? (
          <p className="muted">目前尚無歷史盲測紀錄。</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>目標開獎日</th>
                  <th>狀態</th>
                  <th>實際開獎號碼</th>
                  <th>模型預測選號</th>
                  <th>模型命中</th>
                  <th>歷史累積頻率選號</th>
                  <th>Baseline 命中</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const actualA1 = entry.actual ? entry.actual.area1 : [];
                  const actualA2 = entry.actual ? entry.actual.area2 : null;
                  const isResolved = entry.status === "resolved";

                  return (
                    <tr key={entry.cutoff_draw_id}>
                      <td>
                        <strong>{entry.assumed_target_date}</strong>
                        {!entry.target_date_matched && (
                          <span style={{ display: "block", fontSize: "0.7rem", color: "var(--orange)" }}>
                            (實際開獎日 {entry.target_draw_id})
                          </span>
                        )}
                        {entry.input_data_changed && (
                          <span style={{ display: "block", fontSize: "0.7rem", color: "var(--orange)" }}>
                            (歷史資料曾修正)
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          background: isResolved ? "#e2f7cf" : "#fff3e0",
                          color: isResolved ? "#2f5c11" : "#a35200"
                        }}>
                          {isResolved ? "已開獎結算" : "待開獎"}
                        </span>
                      </td>
                      <td>
                        {entry.actual ? (
                          <div className="ball-group">
                            {actualA1.map((n) => (
                              <NumberBall key={n} number={n} area="area1" size="sm" />
                            ))}
                            <span style={{ marginInline: "2px", fontWeight: 900 }}>+</span>
                            {actualA2 !== null && <NumberBall number={actualA2} area="area2" size="sm" />}
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="ball-group">
                          {entry.picks.model.area1.map((n) => (
                            <NumberBall
                              key={n}
                              number={n}
                              area="area1"
                              isHit={actualA1.includes(n)}
                              size="sm"
                            />
                          ))}
                          <span style={{ marginInline: "2px", fontWeight: 900 }}>+</span>
                          <NumberBall
                            number={entry.picks.model.area2[0]}
                            area="area2"
                            isHit={actualA2 === entry.picks.model.area2[0]}
                            size="sm"
                          />
                        </div>
                      </td>
                      <td>
                        {entry.hits ? (
                          <span>
                            第一區 <b>{entry.hits.model.area1}</b> 顆 / 第二區 <b>{entry.hits.model.area2}</b> 顆
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="ball-group">
                          {entry.picks.historical_frequency.area1.map((n) => (
                            <NumberBall
                              key={n}
                              number={n}
                              area="area1"
                              isHit={actualA1.includes(n)}
                              size="sm"
                            />
                          ))}
                          <span style={{ marginInline: "2px", fontWeight: 900 }}>+</span>
                          <NumberBall
                            number={entry.picks.historical_frequency.area2[0]}
                            area="area2"
                            isHit={actualA2 === entry.picks.historical_frequency.area2[0]}
                            size="sm"
                          />
                        </div>
                      </td>
                      <td>
                        {entry.hits ? (
                          <span>
                            第一區 <b>{entry.hits.historical_frequency.area1}</b> 顆 / 第二區 <b>{entry.hits.historical_frequency.area2}</b> 顆
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 免責聲明 */}
      <section className="content-section">
        <Callout tone="warning" title="免責聲明與研究定位">
          <p>
            彩券開獎為嚴格獨立隨機試驗，每次開獎均不受過去歷史出現頻率影響。本專案的前瞻盲測機制僅用於學術研究與驗證統計學習模型在面對真隨機序列時的行為邊界，絕非提供明牌，切勿將任何預測內容作為彩券投注之依據。
          </p>
        </Callout>
      </section>
    </div>
  );
}
