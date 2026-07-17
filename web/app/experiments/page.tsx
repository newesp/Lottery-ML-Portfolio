import { Callout, PageIntro, RepoLink } from "../components/UI";
import { dev } from "../lib/results";
import { ExperimentLab } from "./ExperimentLab";

export default function ExperimentsPage(){return <div className="section-shell page wide">
  <PageIntro eyebrow="PRECOMPUTED EXPERIMENT MATRIX · 預先算好的實驗比較" title="自己切換條件，看模型是否真的比較好"><p>選擇號碼區域、評估指標與 feature set（使用的線索組合），就能比較 30 次 runs（完整實驗）與 180 筆 fold results（各時間測試輪次的結果）。所有數字都由<RepoLink path="artifacts/experiments/development-v1.json">有版本紀錄的 Python 結果檔</RepoLink>產生；瀏覽器只負責篩選與畫圖，不會為了呈現好看的結果而重新訓練模型。</p></PageIntro>
  <ExperimentLab runs={dev.runs}/>
  <Callout title="為什麼不把所有組合都無限嘗試？"><p><RepoLink path="configs/experiments/development-v1.json">Hyperparameters（模型內部設定）</RepoLink>只在 full features 與 development folds（開發期時間測試）中挑選，再把固定設定拿去比較四種 feature sets。開發比較先使用一個 seed（隨機起點）控制計算量；真正的 locked holdout 最終驗收才使用 17、42、2026 三個 seeds 組成 ensemble（綜合多次結果），檢查結果是否太依賴一次隨機運氣。</p></Callout>
</div>}
