import Link from "next/link";
import { Callout, Eyebrow, Metric, Steps } from "./components/UI";
import { dev, locked, num } from "./lib/results";

export default function Home() {
  const area1 = locked.areas.area1;
  return <>
    <section className="hero section-shell">
      <div><Eyebrow>REPRODUCIBLE ML CASE STUDY · 可重現的機器學習案例</Eyebrow>
        <h1>當預測目標是隨機的，<br/><em>ML 工程還能證明什麼？</em></h1>
        <p className="hero-copy">這個專案用台灣威力彩示範一套完整的機器學習流程：保存不可任意改動的原始資料備份（immutable snapshot）、確保模型偷看不到未來答案（leakage-safe features）、依時間順序反覆測試（Time Series Cross Validation），最後才打開保留資料做總驗收（locked holdout）。重點不是提供明牌，而是證明實驗過程經得起檢查。</p>
        <div className="button-row"><Link className="button primary" href="/experiments">進入 Experiment Lab 實驗室</Link><Link className="button secondary" href="/reproducibility">查看如何重現結果</Link></div>
      </div>
      <div className="hero-panel" aria-label="專案關鍵結果">
        <span className="status"><i/> PIPELINE VERIFIED · 流程已驗證</span>
        <div className="hero-number">{num(area1.ensemble_metrics.average_hits)}</div>
        <p>模型在最終測試中，每期第一區平均命中 {num(area1.ensemble_metrics.average_hits)} 個號碼</p>
        <div className="mini-compare">
          <span><b>Uniform {num(area1.baselines.uniform.average_hits)}</b><small>隨機選號每期平均命中 {num(area1.baselines.uniform.average_hits)} 個</small></span>
          <span><b>95% CI 跨越 0</b><small>模型與隨機選號的差距，可能只是運氣</small></span>
        </div>
      </div>
    </section>
    <section className="metrics-band"><div className="section-shell metrics-grid">
      <Metric value={dev.draw_count.toLocaleString()} label="歷史開獎期數" note="涵蓋 2008–2026 年"/>
      <Metric value="46" label="每期要評分的候選號碼" note="第一區 38 個＋第二區 8 個"/>
      <Metric value="6" label="Time Series CV 時間測試輪次" note="逐年模擬 2018–2023"/>
      <Metric value={String(locked.holdout_draw_count)} label="Locked holdout 最終測試期數" note="2024 年後才一次驗收"/>
    </div></section>
    <section className="section-shell content-section"><div className="section-heading"><Eyebrow>END-TO-END WORKFLOW · 完整工作流程</Eyebrow><h2>從來源網頁到一般人也能檢查的結論</h2></div>
      <Steps items={[
        ["01","Fetch & Snapshot｜抓取並保存","讀取來源 Big5 HTML，留下 SHA-256 數位指紋與 immutable snapshot；也就是保存一份可核對、不能悄悄竄改的原始資料。"],
        ["02","Feature Engineering｜整理模型線索","把每個候選號碼各做成一列資料，而且只使用當期開獎前已經知道的歷史資訊。"],
        ["03","Temporal Evaluation｜按時間測試","用 Expanding-window CV 逐年模擬「拿過去預測未來」，並把 2024 年後資料鎖成最後才看的 holdout。"],
        ["04","Communicate Honestly｜誠實解讀","同時呈現 baseline（簡單比較基準）、bootstrap CI（不確定範圍）與負結果，不把偶然命中包裝成投注能力。"],
      ]}/>
    </section>
    <section className="section-shell content-section"><Callout tone="warning" title="最重要的研究結論"><p>在最後才打開的 holdout 測試中，模型的平均命中數看起來比 Uniform（完全隨機選號）高；但 paired bootstrap 95% CI 跨越 0，代表這個差距仍可能只是抽樣運氣。更簡單的 Rolling Frequency（依近期出現頻率排序）甚至略高於模型。因此目前沒有證據能說模型穩定勝過隨機選號。</p></Callout></section>
  </>;
}
