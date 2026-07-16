import { Callout, PageIntro } from "../components/UI";

const groups = [
  ["Frequency｜出現頻率","計算號碼從過去到現在出現幾次，也觀察最近 3–200 期的 rolling frequency（移動頻率）與 EWM（越近期權重越高的平均）。"],
  ["Gap｜出現間隔","計算距離上次出現隔了多少期、平均間隔，以及 log gap、gap ratio 等不同尺度的間隔表示法。"],
  ["Temporal context｜時間脈絡","加入前一期統計、星期與月份等資訊，以及 hot/cold indicators（近期較常出現或較少出現的標記）。"],
  ["Co-occurrence｜共同出現","計算某個候選號碼，過去是否常和前一期開出的號碼一起出現。"],
];
export default function FeaturesPage() { return <div className="section-shell page"><PageIntro eyebrow="FEATURE ENGINEERING · 特徵工程" title="把歷史資料整理成模型看得懂的線索"><p>Feature Engineering（特徵工程）就是把原始開獎紀錄轉成模型可比較的數字。這裡不是「一期一列」，而是每期把所有可能號碼展開成 46 列：第一區 38 列、第二區 8 列。target（答案欄位）表示該候選號碼當期是否真的開出。</p></PageIntro>
  <Callout tone="good" title="Leakage-safe invariant｜不偷看答案的固定規則"><p>建立第 t 期資料時，state（累積的歷史狀態）只包含 t 期以前的開獎。等當期所有 features（模型線索）與 target（答案）都輸出後，才把當期結果加入歷史。測試甚至會故意改掉當期與未來答案，確認較早特徵仍逐位元完全相同；這就是避免 data leakage（未來資訊洩漏）。</p></Callout>
  <section className="content-section"><h2>46 個 versioned features｜有版本紀錄的模型線索</h2><div className="card-grid">{groups.map(([title,copy],i)=><article className="feature-card" key={title}><span>0{i+1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
  <section className="content-section split"><div><h2>Feature sets｜線索組合</h2><ul className="clean-list"><li><b>frequency</b> — 只使用號碼過去出現頻率</li><li><b>frequency_gap</b> — 在頻率之外，加入距離上次出現的間隔</li><li><b>temporal_context</b> — 加入前一期結果與日期脈絡</li><li><b>full</b> — 使用全部特徵，包括號碼共同出現資訊</li></ul></div><div><h2>Preprocessing｜建模前處理</h2><p className="body-copy">Logistic Regression（邏輯斯迴歸）會用 StandardScaler 把不同單位的數值縮放到相近尺度。它被放在 sklearn Pipeline 中，確保每一輪 fold（時間測試輪次）只用訓練資料計算縮放方式，不偷看測試資料。Random Forest 與 LightGBM 都是樹模型，通常不需要 scaling（數值縮放），因此保持原值。</p></div></section>
</div>; }
