import { Callout, PageIntro, RepoLink } from "../components/UI";
import { getSiteFacts } from "../lib/facts";
import { dev } from "../lib/results";
import { ExperimentLab } from "./ExperimentLab";

export default function ExperimentsPage() {
  const facts = getSiteFacts();
  return (
    <div className="section-shell page wide">
      <PageIntro
        eyebrow="PRECOMPUTED EXPERIMENT MATRIX ｜ 預先算好的實驗矩陣"
        title={
          <>
            自由切換條件，<span className="inline-block">檢驗複雜模型是否真有優勢</span>
          </>
        }
      >
        <p>
          切換下方的號碼區域、評估指標與特徵組合，即可交叉比對{" "}
          {facts.devRunCount} 組完整實驗（Runs）與 {facts.devFoldCount} 筆時間驗證輪次（Folds）的成績。所有數據皆讀取自
          <RepoLink path="artifacts/experiments/development-v1.json">
            納入版本控制的 Python 實驗結果檔
          </RepoLink>
          ；網頁端只負責篩選與視覺化，不會為了湊出漂亮數字而在瀏覽器裡動態重訓模型。
        </p>
      </PageIntro>
      <ExperimentLab runs={dev.runs} />
      <Callout title="為什麼不無止境地嘗試所有參數組合？">
        <p>
          在隨機性極高的資料上，嘗試越多種參數組合，就越容易碰巧篩出一組「在歷史資料上看起來很準」的假象（多重比較偏誤）。因此，
          <RepoLink path="configs/experiments/development-v1.json">
            超參數（Hyperparameters）
          </RepoLink>
          只在開發期（Development Folds）搭配完整特徵集選定，接著便將設定固定，用來公平比較四種特徵組合。開發階段先以單一隨機起點（Seed）控制運算量；直到最後的盲測驗收（Locked Holdout），才採用{" "}
          {facts.selectionSeeds.join("、")} 共 {facts.ensembleSeedCount} 組 Seeds 進行集成評估（Ensemble），確認結果不是單一隨機起點帶來的僥倖。
        </p>
      </Callout>
    </div>
  );
}
