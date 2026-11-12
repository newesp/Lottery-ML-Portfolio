import { Callout, Eyebrow, Metric, PageIntro, RepoLink } from "../components/UI";
import { NumberBall } from "../components/NumberBall";
import { getForwardSummary } from "../lib/forward";
import { num } from "../lib/format";

export const metadata = {
  title: "前瞻盲測",
  description: "在開獎前預先寫入模型預測，開獎後依據不可竄改的帳本自動結算命中數。",
};

export default function ForwardPage() {
  const summary = getForwardSummary();

  if (!summary) {
    return (
      <div className="page section-shell">
        <PageIntro
          eyebrow="FORWARD TEST ｜ 前瞻盲測"
          title={
            <>
              開獎前鎖定預測，<span className="inline-block">開獎後才對答案</span>
            </>
          }
        >
          <p>
            這套機制會在尚未開獎前，將機器學習模型的選號寫入公開且只增不減的帳本（<code>ledger.jsonl</code>），待開獎結果公布後再自動結算真實盲測成績。
          </p>
        </PageIntro>
        <Callout tone="warning" title="前瞻盲測尚未產生紀錄">
          <p>
            目前尚未讀取到前瞻盲測彙整檔（<code>artifacts/forward/summary.json</code>）。待排程完成首次開獎前預測後，此頁面將自動呈現最新選號與核對紀錄。
          </p>
        </Callout>
      </div>
    );
  }

  const { latest_pending, expected_hits_uniform, aggregate, entries } = summary;

  const cutoffDrawId = latest_pending?.cutoff_draw_id;
  const cutoffEntry = cutoffDrawId
    ? entries.find(
        (e) =>
          (e.target_draw_id && e.target_draw_id === cutoffDrawId) ||
          e.assumed_target_date === cutoffDrawId
      )
    : undefined;
  const cutoffActual = latest_pending?.cutoff_actual || cutoffEntry?.actual || null;

  return (
    <div className="page section-shell">
      <PageIntro
        eyebrow="FORWARD TEST ｜ 前瞻盲測"
        title={
          <>
            開獎前鎖定預測，<span className="inline-block">開獎後才對答案</span>
          </>
        }
      >
        <p>
          為了徹底排除「事後諸葛」與資料洩漏的可能，此頁面的所有預測皆在開獎當晚 20:00 前由自動化排程算好並寫入公開帳本，開獎後再依據同一份帳本對獎結算。
        </p>
        <p className="sub-note" style={{ marginTop: "12px", fontSize: "0.88rem", color: "var(--muted)" }}>
          原始預測紀錄存放於 <RepoLink path="artifacts/forward/ledger.jsonl">artifacts/forward/ledger.jsonl</RepoLink>（只增不減的 Append-only 帳本）。
        </p>
      </PageIntro>

      {/* 前瞻盲測看板 */}
      <section className="content-section">
        <div className="section-heading">
          <Eyebrow>FORWARD DISPATCH ｜ 前瞻盲測看板</Eyebrow>
          <h2>
            {latest_pending
              ? `基準期 ${latest_pending.cutoff_draw_id} ➜ 目標開獎日 ${latest_pending.assumed_target_date}`
              : "目前尚無待開獎的預測"}
          </h2>
        </div>

        {latest_pending ? (
          <div className="forward-dispatch-grid">
            {/* 基準期歷史開獎 */}
            <div className="forward-dispatch-box cutoff-box">
              <div className="dispatch-header">
                <div className="dispatch-title-group">
                  <span className="dispatch-subhead">基準期歷史開獎</span>
                  <h3 className="dispatch-title">{cutoffDrawId} 期</h3>
                </div>
                <span className="status-pill resolved">歷史基準資料</span>
              </div>

              <p className="dispatch-desc">
                模型推論下一期選號時所依據的最新歷史開獎資料：
              </p>

              {/* 開獎號碼 */}
              <div className="forward-row">
                <span className="forward-row-label">
                  <b>開獎號碼</b>
                  <small>本期實際開出結果</small>
                </span>
                {cutoffActual ? (
                  <div className="ball-group">
                    {cutoffActual.area1.map((n) => (
                      <NumberBall key={n} number={n} area="area1" size="md" />
                    ))}
                    <span className="ball-sep" aria-hidden="true">+</span>
                    <NumberBall number={cutoffActual.area2} area="area2" size="md" />
                  </div>
                ) : (
                  <span className="muted">—</span>
                )}
              </div>

              {/* 模型選號 */}
              <div className="forward-row">
                <span className="forward-row-label">
                  <b>模型選號</b>
                  <small>
                    {cutoffEntry && cutoffEntry.hits
                      ? `命中第一區 ${cutoffEntry.hits.model.area1} 顆 / 第二區 ${cutoffEntry.hits.model.area2} 顆`
                      : "selection-v1 RF Ensemble"}
                  </small>
                </span>
                {cutoffEntry ? (
                  <div className="ball-group">
                    {cutoffEntry.picks.model.area1.map((n) => (
                      <NumberBall
                        key={n}
                        number={n}
                        area="area1"
                        size="md"
                        isHit={cutoffActual ? cutoffActual.area1.includes(n) : false}
                      />
                    ))}
                    <span className="ball-sep" aria-hidden="true">+</span>
                    <NumberBall
                      number={cutoffEntry.picks.model.area2[0]}
                      area="area2"
                      size="md"
                      isHit={cutoffActual ? cutoffActual.area2 === cutoffEntry.picks.model.area2[0] : false}
                    />
                  </div>
                ) : (
                  <div>
                    <span className="status-pill neutral">盲測起始基準期（開獎前未預先鎖定預測）</span>
                  </div>
                )}
              </div>

              {/* 歷史累積頻率 */}
              <div className="forward-row">
                <span className="forward-row-label">
                  <b>歷史累積頻率</b>
                  <small>
                    {cutoffEntry && cutoffEntry.hits
                      ? `命中第一區 ${cutoffEntry.hits.historical_frequency.area1} 顆 / 第二區 ${cutoffEntry.hits.historical_frequency.area2} 顆`
                      : "Historical Frequency"}
                  </small>
                </span>
                {cutoffEntry ? (
                  <div className="ball-group">
                    {cutoffEntry.picks.historical_frequency.area1.map((n) => (
                      <NumberBall
                        key={n}
                        number={n}
                        area="area1"
                        size="md"
                        isHit={cutoffActual ? cutoffActual.area1.includes(n) : false}
                      />
                    ))}
                    <span className="ball-sep" aria-hidden="true">+</span>
                    <NumberBall
                      number={cutoffEntry.picks.historical_frequency.area2[0]}
                      area="area2"
                      size="md"
                      isHit={cutoffActual ? cutoffActual.area2 === cutoffEntry.picks.historical_frequency.area2[0] : false}
                    />
                  </div>
                ) : (
                  <div>
                    <span className="status-pill neutral">盲測起始基準期</span>
                  </div>
                )}
              </div>

              <div className="dispatch-footer">
                {cutoffEntry && cutoffEntry.hits ? (
                  <>
                    本期結算命中：模型第一區 <b>{cutoffEntry.hits.model.area1}</b> 顆／第二區 <b>{cutoffEntry.hits.model.area2}</b> 顆
                  </>
                ) : (
                  <>
                    此期為盲測系統歷史基準截斷點，特徵工程截至本期已驗證開獎資料。
                  </>
                )}
              </div>
            </div>

            {/* 下一期盲測預測 */}
            <div className="forward-dispatch-box predict-box">
              <div className="dispatch-header">
                <div className="dispatch-title-group">
                  <span className="dispatch-subhead">下一期盲測預測</span>
                  <h3 className="dispatch-title">目標開獎日：{latest_pending.assumed_target_date}</h3>
                </div>
                <span className="live-pill">
                  <span className="live-pill-dot" />
                  LOCKED PENDING DRAW
                </span>
              </div>

              <p className="dispatch-desc">
                依據截至 {latest_pending.cutoff_draw_id} 的已驗證歷史資料，模型在開獎前預先鎖定的選號組合：
              </p>

              {/* 開獎號碼 */}
              <div className="forward-row">
                <span className="forward-row-label">
                  <b>開獎號碼</b>
                  <small>開獎後自動結算</small>
                </span>
                <div>
                  <span className="status-pill pending">待開獎（開獎後自動對獎結算）</span>
                </div>
              </div>

              {/* 模型選號 */}
              <div className="forward-row">
                <span className="forward-row-label">
                  <b>模型選號</b>
                  <small>selection-v1 RF Ensemble</small>
                </span>
                <div className="ball-group">
                  {latest_pending.predictions.model.area1.picks.map((n) => (
                    <NumberBall key={n} number={n} area="area1" size="md" />
                  ))}
                  <span className="ball-sep" aria-hidden="true">+</span>
                  <NumberBall number={latest_pending.predictions.model.area2.picks[0]} area="area2" size="md" />
                </div>
              </div>

              {/* 歷史累積頻率 */}
              <div className="forward-row">
                <span className="forward-row-label">
                  <b>歷史累積頻率</b>
                  <small>Historical Frequency</small>
                </span>
                <div className="ball-group">
                  {latest_pending.predictions.historical_frequency.area1.picks.map((n) => (
                    <NumberBall key={n} number={n} area="area1" size="md" />
                  ))}
                  <span className="ball-sep" aria-hidden="true">+</span>
                  <NumberBall number={latest_pending.predictions.historical_frequency.area2.picks[0]} area="area2" size="md" />
                </div>
              </div>

              <div className="dispatch-footer">
                隨機選號理論期望命中：第一區 <b>{num(expected_hits_uniform.area1, 3)}</b> 顆／第二區 <b>{num(expected_hits_uniform.area2, 3)}</b> 顆
              </div>
            </div>
          </div>
        ) : (
          <p className="muted">
            上一期預測已完成對獎結算，下一期預測將於開獎資料更新時自動產生並寫入帳本。
          </p>
        )}
      </section>

      {/* 累積成績 */}
      <section className="content-section">
        <div className="section-heading">
          <Eyebrow>CUMULATIVE PERFORMANCE ｜ 累積盲測表現</Eyebrow>
          <h2>面對未來未知期數的實際成績單</h2>
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
          <Callout tone="warning" title="小樣本統計提醒">
            <p>
              目前已結算期數為 {aggregate.resolved_count} 期（未滿 30 期）。在期數尚少時，平均命中數極易受單期手氣波動影響，暫不適合做統計顯著性推論。
            </p>
          </Callout>
        )}
      </section>

      {/* 第一區模型分數 Top 10 */}
      {latest_pending && latest_pending.predictions.model.area1.top_scores.length > 0 && (
        <section className="content-section">
          <div className="section-heading">
            <Eyebrow>PROBABILITY RANKING ｜ 第一區預測機率 Top 10</Eyebrow>
            <h2>模型當期評分最高的前十個號碼</h2>
          </div>
          <div className="table-scroll">
            <table className="lab-table">
              <thead>
                <tr>
                  <th scope="col">名次</th>
                  <th scope="col">號碼</th>
                  <th scope="col">模型預測機率</th>
                  <th scope="col">選號狀態</th>
                </tr>
              </thead>
              <tbody>
                {latest_pending.predictions.model.area1.top_scores.map(([number, score], index) => {
                  const isPicked = latest_pending.predictions.model.area1.picks.includes(number);
                  return (
                    <tr key={number} className={isPicked ? "picked-row" : ""}>
                      <td className="rank-cell">#{index + 1}</td>
                      <td>
                        <NumberBall number={number} area="area1" size="sm" />
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)" }}><code>{num(score, 6)}</code></td>
                      <td>
                        {isPicked ? (
                          <span className="picked-badge">★ 當期選號（Top 6）</span>
                        ) : (
                          <span className="muted">備選候選碼</span>
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
          <Eyebrow>AUDIT LOG ｜ 盲測對獎紀錄表</Eyebrow>
          <h2>逐期預測與實際開獎結果核對</h2>
        </div>

        {entries.length === 0 ? (
          <p className="muted">目前尚無歷史盲測紀錄。</p>
        ) : (
          <div className="table-scroll">
            <table className="lab-table audit-table">
              <thead>
                <tr>
                  <th scope="col">目標開獎日</th>
                  <th scope="col">狀態</th>
                  <th scope="col">實際開獎號碼</th>
                  <th scope="col">模型預測選號</th>
                  <th scope="col">模型命中</th>
                  <th scope="col">歷史頻率選號</th>
                  <th scope="col">Baseline 命中</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const actualA1 = entry.actual ? entry.actual.area1 : [];
                  const actualA2 = entry.actual ? entry.actual.area2 : null;
                  const isResolved = entry.status === "resolved";

                  return (
                    <tr key={entry.cutoff_draw_id} className={isResolved ? "resolved-row" : "pending-row"}>
                      <td>
                        <strong>{entry.assumed_target_date}</strong>
                        {!entry.target_date_matched && (
                          <span className="audit-warning-text">
                            (實際開獎日 {entry.target_draw_id})
                          </span>
                        )}
                        {entry.input_data_changed && (
                          <span className="audit-warning-text">
                            (歷史資料曾修正)
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${isResolved ? "resolved" : "pending"}`}>
                          {isResolved ? "已開獎結算" : "待開獎"}
                        </span>
                      </td>
                      <td>
                        {entry.actual ? (
                          <div className="ball-group">
                            {actualA1.map((n) => (
                              <NumberBall key={n} number={n} area="area1" size="sm" />
                            ))}
                            <span className="ball-sep" aria-hidden="true">+</span>
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
                          <span className="ball-sep" aria-hidden="true">+</span>
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
                          <span className="hits-tag">
                            第 1 區 <b>{entry.hits.model.area1}</b> 顆 / 第 2 區 <b>{entry.hits.model.area2}</b> 顆
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
                          <span className="ball-sep" aria-hidden="true">+</span>
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
                          <span className="hits-tag">
                            第 1 區 <b>{entry.hits.historical_frequency.area1}</b> 顆 / 第 2 區 <b>{entry.hits.historical_frequency.area2}</b> 顆
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
        <Callout tone="warning" title="研究定位與免責聲明">
          <p>
            彩券開獎為嚴格的獨立隨機事件，過往的出現頻率不會改變下一期的開獎機率。前瞻盲測機制僅用於觀察統計學習模型在面對真實隨機序列時的長期行為，絕非報明牌，請勿將任何預測內容作為投注依據。
          </p>
        </Callout>
      </section>
    </div>
  );
}
