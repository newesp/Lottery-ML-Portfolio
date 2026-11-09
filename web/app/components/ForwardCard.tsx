import Link from "next/link";
import { NumberBall } from "./NumberBall";
import { getForwardSummary } from "../lib/forward";
import { num } from "../lib/format";
import { ArrowRightIcon } from "./Icons";

export function ForwardCard() {
  const summary = getForwardSummary();
  if (!summary || !summary.latest_pending) {
    return null;
  }

  const { latest_pending, expected_hits_uniform, aggregate } = summary;
  const modelPicksA1 = latest_pending.predictions.model.area1.picks;
  const modelPickA2 = latest_pending.predictions.model.area2.picks[0];

  return (
    <section className="section-shell" aria-labelledby="forward-card-title">
      <div className="forward-card">
        <div className="forward-card-badge-row">
          <span className="live-pill">
            <span className="live-pill-dot" />
            FORWARD TEST LEDGER
          </span>
          <span className="forward-card-cutoff">
            資料基準期數：<code>{latest_pending.cutoff_draw_id}</code>
          </span>
        </div>

        <h3 id="forward-card-title" className="forward-card-title">
          下一期目標開獎日：<span>{latest_pending.assumed_target_date}</span>
        </h3>

        <p className="forward-card-desc">
          為杜絕事後諸葛與資料洩漏，以下為模型在開獎日前預先寫入公開帳本的 6+1 推薦號碼：
        </p>

        <div className="balls-section" role="group" aria-label="模型推薦號碼組合">
          <div className="ball-group-wrap">
            <div className="ball-zone-label">
              <span>第 1 區</span>
              <small>38 選 6</small>
            </div>
            <div className="ball-group" aria-label="第一區選號">
              {modelPicksA1.map((n) => (
                <NumberBall key={n} number={n} area="area1" size="lg" />
              ))}
            </div>
          </div>

          <div className="ball-plus-divider" aria-hidden="true">+</div>

          <div className="ball-group-wrap">
            <div className="ball-zone-label special">
              <span>第 2 區</span>
              <small>8 選 1</small>
            </div>
            <div className="ball-group" aria-label="第二區特別號">
              <NumberBall number={modelPickA2} area="area2" size="lg" />
            </div>
          </div>
        </div>

        <div className="forward-card-footer">
          <div className="forward-stat-pill">
            <span className="stat-label">隨機理論期望</span>
            <span className="stat-val">第 1 區 {num(expected_hits_uniform.area1, 3)} 顆 ｜ 第 2 區 {num(expected_hits_uniform.area2, 3)} 顆</span>
          </div>
          <div className="forward-stat-pill">
            <span className="stat-label">盲測已結算</span>
            <span className="stat-val">{aggregate.resolved_count} 期</span>
          </div>
        </div>

        <div className="button-row" style={{ marginTop: "24px" }}>
          <Link href="/forward" className="button forward-cta">
            <span>查看完整前瞻盲測歷史帳本與對獎紀錄</span>
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
