import type { ReactNode } from "react";
import { Callout, PageIntro, RepoLink } from "../components/UI";

const findings: Array<[string, string, ReactNode]> = [
  [
    "01",
    "資料怎麼切，比模型有多複雜更重要",
    "如果把所有歷史期數隨機打散再切分訓練與測試集，模型很容易從跨期特徵中偷看到未來的分布。採用 Expanding-window（逐年向外擴展的訓練視窗）堅持只拿過去預測下一年，才能真實反映模型面對未知未來的表現。",
  ],
  [
    "02",
    "簡單基準（Baseline）是最好的試金石",
    <>
      <RepoLink path="src/lottery_ml/models/baselines.py">
        Uniform、Historical Frequency 與 Shuffled History
      </RepoLink>
      分別代表完全隨機選號、依歷史累積出現率排序，以及將歷史時間順序打亂。當複雜的機器學習模型連這些樸素的統計基準都無法穩定超越時，最合理的解釋就是資料裡並不存在可供模型發揮的複雜規律。
    </>,
  ],
  [
    "03",
    "「沒有發現預測優勢」也是完整的工程交付",
    "實驗得出負結果，不等於工程失敗。從資料溯源（Lineage）、防洩漏測試（Leakage Tests）、選型鎖定（Selection Freeze）、成對抽樣信賴區間（Paired Bootstrap）到完全可重現的自動化管線，每個環節都在確保最後的結論——無論正負——都站得住腳。",
  ],
  [
    "04",
    "為什麼刻意選擇「威力彩」這個反例？",
    "多數作品集喜歡挑選容易刷出高分的公開資料集；本專案反其道而行，選擇理論上近乎純隨機的威力彩。面對沒有穩定訊號（Signal）的題目，考驗的正是能否克制「不斷調參直到湊出漂亮數字」的誘惑，誠實讓數據說話。",
  ],
];

export default function FindingsPage() {
  return (
    <div className="section-shell page">
      <PageIntro
        eyebrow="FINDINGS & LIMITATIONS ｜ 結論與方法限制"
        title="負結果的價值，在於誠實劃出能力的邊界"
      >
        <p>
          這份案例研究不打算把隨機波動包裝成可持續的預測優勢（Alpha）。相反地，它透過嚴格的實驗設計來挑戰、甚至推翻模型自己的假設——在隨機性主導的題目裡，能夠清楚證明「模型沒有學到特殊規律」，本身就是工程嚴謹度的最佳展現。
        </p>
      </PageIntro>
      <div className="finding-list">
        {findings.map(([id, title, copy]) => (
          <article key={id}>
            <span>{id}</span>
            <div>
              <h2>{title}</h2>
              <p>{copy}</p>
            </div>
          </article>
        ))}
      </div>
      <Callout tone="warning" title="使用邊界與研究限制">
        <p>
          本專案純粹為機器學習工程與統計驗證之技術展示，不提供任何投注建議，亦不估算期望報酬，更不宣稱「近期常開號碼」會提高下期中獎率。每期彩券開獎均應視為獨立隨機事件。此外，歷史資料取自民間整理之公開網頁而非官方
          API，因此管線內建了嚴格的格式驗證、雜湊存證與人工勘誤紀錄，確保資料品質透明可查。
        </p>
      </Callout>
    </div>
  );
}
