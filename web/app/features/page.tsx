import { Callout, PageIntro } from "../components/UI";

const groups = [
  ["Frequency","Lifetime count/rate、rolling 3–200 draws、EWM half-life 5–50。"],
  ["Gap","距離上次出現、平均間隔、log gap 與 gap ratio。"],
  ["Temporal context","前一期統計、星期／月份週期編碼、hot/cold indicators。"],
  ["Co-occurrence","候選號碼與前一期號碼的歷史共同出現統計。"],
];
export default function FeaturesPage() { return <div className="section-shell page"><PageIntro eyebrow="FEATURE ENGINEERING" title="先定義時間，再定義特徵"><p>建模單位不是「一期一列」，而是每期展開 46 個候選：第一區 38 列、第二區 8 列。target 表示候選號碼是否在該期開出。</p></PageIntro>
  <Callout tone="good" title="Leakage-safe invariant"><p>建立第 t 期候選列時，state 只包含 draw date &lt; t 的資料；該期 target 全部輸出後才更新 state。測試會改寫當期與未來 target，並要求當期以前所有 features byte-for-byte 不變。</p></Callout>
  <section className="content-section"><h2>46 個 versioned features</h2><div className="card-grid">{groups.map(([title,copy],i)=><article className="feature-card" key={title}><span>0{i+1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
  <section className="content-section split"><div><h2>Feature sets</h2><ul className="clean-list"><li><b>frequency</b> — 純頻率訊號</li><li><b>frequency_gap</b> — 加入出現間隔</li><li><b>temporal_context</b> — 加入前期與日曆脈絡</li><li><b>full</b> — 全部特徵與共現資訊</li></ul></div><div><h2>Preprocessing</h2><p className="body-copy">Logistic Regression 的 StandardScaler 位於 sklearn Pipeline 內、每個 fold 只 fit training partition。Random Forest 與 LightGBM 不做 scaling，避免無意義的樹模型標準化。</p></div></section>
</div>; }
