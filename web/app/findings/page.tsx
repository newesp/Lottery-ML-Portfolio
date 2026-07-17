import type { ReactNode } from "react";
import { Callout, PageIntro, RepoLink } from "../components/UI";

const findings: Array<[string, string, ReactNode]> = [
  ["01","正確的 split（資料切法）比複雜模型更重要","如果隨機打散所有資料再分成訓練與測試，模型可能間接看到未來資訊。Expanding-window（逐年擴大的訓練窗口）則永遠只拿過去預測下一年，更接近真實使用情境。"],
  ["02","Baseline（簡單比較基準）也是結論的一部分",<><RepoLink path="src/lottery_ml/models/baselines.py">Uniform、Rolling Frequency 與 Shuffled History</RepoLink>分別代表完全隨機選號、依近期頻率排序，以及把歷史關係打亂。若複雜模型連這些簡單方法都無法穩定超越，就不能宣稱它學到可靠規律。</>],
  ["03","負結果也能展示 ML 能力","沒有預測優勢不等於專案失敗。資料 lineage（來源追蹤）、leakage tests（防偷看答案測試）、selection freeze（先鎖定選擇）、paired bootstrap（估計差距的不確定性）與 reproducibility（可重現性），都能證明實驗是否可信。"],
  ["04","Lottery（彩票）是有意識選擇的反例","開獎本來就應該接近隨機，因此這個專案的任務是辨認「沒有穩定 signal（可預測訊號）」，而不是一直調整模型，直到碰巧找到一個看起來漂亮的分數。"],
];
export default function FindingsPage(){return <div className="section-shell page"><PageIntro eyebrow="FINDINGS & LIMITATIONS · 結論與限制" title="最成熟的結論，是知道不能宣稱什麼"><p>這個 case study（案例研究）不把隨機波動包裝成 alpha（可持續的預測優勢）。相反地，它刻意設計成一個會挑戰、甚至反駁自己假設的 ML 實驗。</p></PageIntro><div className="finding-list">{findings.map(([id,title,copy])=><article key={id}><span>{id}</span><div><h2>{title}</h2><p>{copy}</p></div></article>)}</div><Callout tone="warning" title="不適用範圍"><p>本專案不是投注建議、不估算期望報酬，也不聲稱「最近常出現」會提高下一期機率。每期開獎應視為獨立的隨機事件。資料來源也不是台灣彩券官方 API（程式化資料服務），所以專案特別保留原始來源、修正原因與驗證紀錄。</p></Callout></div>}
