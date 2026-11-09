import Link from "next/link";
import { NumberBall } from "./NumberBall";
import { getForwardSummary } from "../lib/forward";
import { num } from "../lib/format";

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
        <p className="eyebrow" style={{ color: "var(--lime)" }}>FORWARD TEST · 前瞻盲測下一期</p>
        <h3 id="forward-card-title">
          下一期目標開獎日：{latest_pending.assumed_target_date}
        </h3>
        <p style={{ color: "#b9c5ca", margin: "8px 0 20px" }}>
          依據截至 {latest_pending.cutoff_draw_id} 的全部已驗證開獎資料，模型在開獎前鎖定的 6+1 推薦選號：
        </p>

        <div className="balls-section">
          <div className="ball-group" aria-label="模型推薦號碼">
            {modelPicksA1.map((n) => (
              <NumberBall key={n} number={n} area="area1" size="lg" />
            ))}
            <span style={{ marginInline: "6px", color: "var(--muted)", fontWeight: 900 }}>+</span>
            <NumberBall number={modelPickA2} area="area2" size="lg" />
          </div>
        </div>

        <p style={{ fontSize: "0.85rem", color: "#9dafb7", margin: "16px 0 24px" }}>
          隨機選號期望命中：第一區 {num(expected_hits_uniform.area1, 3)} 顆／第二區 {num(expected_hits_uniform.area2, 3)} 顆 ｜ 累積已盲測結算 {aggregate.resolved_count} 期
        </p>

        <div className="button-row">
          <Link href="/forward" className="button" style={{ background: "var(--lime)", color: "var(--navy)", borderColor: "var(--lime)" }}>
            查看前瞻盲測完整紀錄與 Baseline 對比 →
          </Link>
        </div>
      </div>
    </section>
  );
}
