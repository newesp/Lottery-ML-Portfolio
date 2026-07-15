import Link from "next/link";
import { Callout, Eyebrow, Metric, Steps } from "./components/UI";
import { dev, locked, num } from "./lib/results";

export default function Home() {
  const area1 = locked.areas.area1;
  return <>
    <section className="hero section-shell">
      <div><Eyebrow>REPRODUCIBLE ML CASE STUDY · V1</Eyebrow>
        <h1>當預測目標是隨機的，<br/><em>ML 工程還能證明什麼？</em></h1>
        <p className="hero-copy">以台灣威力彩為題，完整展示資料擷取、immutable snapshot、leakage-safe features、Time Series Cross Validation、模型選擇與 locked holdout。重點不是猜中號碼，而是做出可稽核的實驗。</p>
        <div className="button-row"><Link className="button primary" href="/experiments">進入 Experiment Lab</Link><Link className="button secondary" href="/reproducibility">查看重現方法</Link></div>
      </div>
      <div className="hero-panel" aria-label="專案關鍵結果">
        <span className="status"><i/> PIPELINE VERIFIED</span>
        <div className="hero-number">{num(area1.ensemble_metrics.average_hits)}</div>
        <p>第一區 holdout 平均命中 / draw</p>
        <div className="mini-compare"><span>Uniform {num(area1.baselines.uniform.average_hits)}</span><span>95% CI 跨越 0</span></div>
      </div>
    </section>
    <section className="metrics-band"><div className="section-shell metrics-grid">
      <Metric value={dev.draw_count.toLocaleString()} label="歷史開獎期數" note="2008–2026"/>
      <Metric value="46" label="每期候選資料列" note="38 + 8 candidates"/>
      <Metric value="6" label="Time Series CV folds" note="2018–2023"/>
      <Metric value={String(locked.holdout_draw_count)} label="Locked holdout draws" note="2024+"/>
    </div></section>
    <section className="section-shell content-section"><div className="section-heading"><Eyebrow>END-TO-END WORKFLOW</Eyebrow><h2>從來源 HTML 到可檢查的結論</h2></div>
      <Steps items={[["01","Fetch & Snapshot","Big5 HTML 解析、來源修正稽核、SHA-256 與 immutable raw snapshot。"],["02","Feature Engineering","每個候選號碼一列；所有特徵只讀取該期以前的開獎。"],["03","Temporal Evaluation","Expanding-window CV 選型，2024+ 完全鎖定為 holdout。"],["04","Communicate Honestly","呈現波動、baseline、bootstrap CI 與負結果，不包裝成投注工具。"]]}/>
    </section>
    <section className="section-shell content-section"><Callout tone="warning" title="最重要的研究結論"><p>選定模型在 holdout 的點估計高於 Uniform，但兩區的 paired bootstrap 95% CI 都跨越 0，且簡單 Rolling Frequency 略優。沒有證據支持穩定預測能力；有證據支持這套評估能辨識不確定性。</p></Callout></section>
  </>;
}
