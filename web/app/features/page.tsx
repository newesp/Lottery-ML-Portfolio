import { Callout, PageIntro, RepoLink } from "../components/UI";
import { getSiteFacts } from "../lib/facts";

export default function FeaturesPage() {
  const facts = getSiteFacts();
  const groups = [
    [
      "Frequency｜出現頻率",
      `統計各號碼從古至今的累積出現次數，同時觀察最近 ${facts.features.rolling_windows_min}–${facts.features.rolling_windows_max} 期的移動平均頻率（Rolling Frequency）與指數加權移動平均（EWM，越近期權重越高，半衰期設為 ${facts.features.ewm_halflives.join("、")} 期）。半衰期越短代表越看重近期走勢，但就算某顆球近期常開，也不代表下一期更容易出現。`,
    ],
    [
      "Gap｜未開出間隔",
      "記錄某個號碼距離上次開出已經隔了幾期、歷史平均間隔，以及對數間隔（Log Gap）與間隔比值等不同尺度的統計量。",
    ],
    [
      "Temporal context｜時間脈絡",
      "納入前一期的開獎統計、開獎日對應的星期與月份，以及近期屬於熱門號或冷門號的指標（Hot/Cold Indicators）。",
    ],
    [
      "Co-occurrence｜號碼共現關係",
      "統計某個候選號碼在歷史上與「前一期開出號碼」接連出現的頻率。",
    ],
  ];

  return (
    <div className="section-shell page">
      <PageIntro
        eyebrow="FEATURE ENGINEERING ｜ 特徵工程"
        title="把歷史開獎紀錄整理成不偷看答案的特徵"
      >
        <p>
          特徵工程負責將原始開獎紀錄轉換為模型能計算的數值指標。這裡不採用「一期一列」的做法，而是將每期所有候選號碼展開為{" "}
          {facts.game.totalCandidates} 列獨立樣本：第一區 {facts.game.area1.max} 列、第二區{" "}
          {facts.game.area2.max} 列，並以該號碼當期是否實際開出作為預測目標（Target）。
        </p>
      </PageIntro>
      <Callout tone="good" title="Leakage-safe invariant｜杜絕偷看未來的鐵則">
        <p>
          計算第 t 期的特徵時，歷史狀態（State）只涵蓋 t 期之前的開獎結果。必須等當期所有候選號碼的特徵與目標值都輸出完畢後，系統才會將當期結果併入歷史統計。
          <RepoLink path="tests/features/test_leakage.py">自動化防洩漏測試</RepoLink>
          甚至會故意篡改當期與未來的開獎結果，驗證過往每一期的特徵數值依然分毫不差，從根源阻絕未來資訊洩漏（Data Leakage）。
        </p>
      </Callout>
      <section className="content-section">
        <h2>
          <RepoLink path="configs/features/v1.json">
            {facts.features.total_count} 個 Versioned Features｜納入版本控制的特徵指標
          </RepoLink>
        </h2>
        <div className="card-grid">
          {groups.map(([title, copy], i) => (
            <article className="feature-card" key={title}>
              <span>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="content-section split">
        <div>
          <h2>Feature sets｜特徵組合</h2>
          <ul className="clean-list">
            <li>
              <b>frequency</b> — 僅使用歷史與近期出現頻率
            </li>
            <li>
              <b>frequency_gap</b> — 頻率加上距離上次開出的間隔指標
            </li>
            <li>
              <b>temporal_context</b> — 結合頻率、前一期開獎統計與日曆脈絡
            </li>
            <li>
              <b>full</b> — 納入全部特徵（含號碼共現關係）
            </li>
          </ul>
        </div>
        <div>
          <h2>
            <RepoLink path="src/lottery_ml/models/pipelines.py">
              Preprocessing｜建模前處理
            </RepoLink>
          </h2>
          <p className="body-copy">
            Logistic Regression 會透過 StandardScaler 將不同尺度的特徵標準化。這道步驟被封裝在
            scikit-learn Pipeline 內部，確保每一輪時間驗證（Fold）只根據當輪的訓練集計算平均數與標準差，絕不偷看測試集分布。Random
            Forest 與 LightGBM 屬於樹模型，本身不受數值尺度影響，因此直接保留原始特徵值。
          </p>
        </div>
      </section>
    </div>
  );
}
