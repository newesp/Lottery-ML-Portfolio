import { RollingReplay } from "../components/RollingResults";
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
          在下方切換分區、評估指標與特徵組合，就能直接比對{" "}
          {facts.devRunCount} 組開發期實驗在 {facts.devFoldCount} 輪時間驗證上的成績。所有數字都來自
          <RepoLink path="artifacts/experiments/development-v1.json">
            預先算好並進版控的 Python 結果檔
          </RepoLink>
          ，網頁只負責篩選和畫圖，不會在瀏覽器裡現場重訓。
        </p>
      </PageIntro>
      <ExperimentLab runs={dev.runs} />
      <Callout title="為什麼不無止境地嘗試所有參數組合？">
        <p>
          資料隨機性高時，試越多組參數，越容易碰巧挑到一組「在歷史資料上看起來很準」的假象（多重比較偏誤）。因此
          <RepoLink path="configs/experiments/development-v1.json">
            超參數
          </RepoLink>
          只在開發期搭配完整特徵集選好，之後就固定不動，用來公平比較四種特徵組合。開發期先用單一隨機種子控制運算量；等到最後的封存盲測，才用{" "}
          {facts.selectionSeeds.join("、")} 共 {facts.ensembleSeedCount} 組種子做集成評估，避免結果只是單次運氣。
        </p>
      </Callout>
      <RollingReplay />
    </div>
  );
}
