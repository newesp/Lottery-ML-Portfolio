import { Callout, PageIntro } from "../components/UI";
import { dev } from "../lib/results";
import { ExperimentLab } from "./ExperimentLab";

export default function ExperimentsPage(){return <div className="section-shell page wide"><PageIntro eyebrow="PRECOMPUTED EXPERIMENT MATRIX" title="完整比較，不讓訪客等模型重訓"><p>選擇區域、指標與 feature set，即時探索 30 個 runs、180 個 fold results。所有數字來自 versioned Python artifact，瀏覽器只負責篩選與呈現。</p></PageIntro><ExperimentLab runs={dev.runs}/><Callout title="計算預算如何分配"><p>超參數只在 full features 與 development folds 上選擇；選定參數再跨四個 feature sets 比較。探索矩陣固定一個 seed 以控制成本，最終 locked holdout 才以 17、42、2026 三個 seeds 評估穩定性。</p></Callout></div>}
