# Lottery ML Portfolio

以台灣威力彩為題的可重現 ML case study。專案刻意選擇幾乎隨機、難以預測的問題，展示從資料 lineage 到誠實負結果的完整工程能力，而不是提供投注號碼。

## 展示內容

- NFD Big5 歷史頁面擷取、驗證、versioned correction 與 immutable raw snapshot
- 1,927 期 canonical draws，SHA-256 content addressing
- 每期 38 + 8 candidate rows、46 個 leakage-safe features
- 2018–2023 expanding-window Time Series Cross Validation
- Logistic Regression、Random Forest、LightGBM 與三個 baselines
- Frozen selection protocol、2024+ locked holdout、三 seeds ensemble
- 10,000-resample paired draw bootstrap confidence intervals
- Next.js static case study 與互動 Experiment Lab，部署到 GitHub Pages

最終結果沒有證明可泛化的預測優勢：兩區模型相對 Uniform 的 95% bootstrap CI 均跨越 0，Rolling Frequency baseline 也略優。這正是專案希望展示的判斷力。

## 快速開始

需要 Python 3.12+、Node.js 22 與 pnpm 11。

```powershell
python -m venv .venv
.venv\Scripts\pip install -e ".[dev]"
.venv\Scripts\pytest -q
.venv\Scripts\lottery-ml ingest --root .
.venv\Scripts\lottery-ml experiments development --root .
.venv\Scripts\lottery-ml experiments holdout --root .

cd web
pnpm install --frozen-lockfile
pnpm dev
```

完整 development reference matrix 在目前資料約需 12 分鐘；網站讀取已提交的 versioned artifacts，不會讓訪客即時重訓。

## 專案結構

```text
configs/       feature、experiment、selection 與 correction registries
data/          canonical dataset、immutable snapshots、manifests
artifacts/     development 與 locked holdout 結果
src/           ingestion、features、models、evaluation、experiment runners
tests/         contracts、leakage、key safety、determinism 與 CLI tests
web/           Next.js static portfolio 與 Experiment Lab
docs/          系統設計、ML 方法、model card 與詳細 plans
```

## 文件

- [系統設計](docs/system-design.md)
- [ML 方法與評估](docs/ml-methodology.md)
- [Model Card](docs/model-card.md)
- [資料管線](docs/data-pipeline.md)

v1 為繁體中文，英文技術名稱保留以方便延伸查詢。v2 規劃加入人工校對的中英語系切換。

## 自動化

- `CI`：Python tests / Ruff / mypy 與 web typecheck / ESLint / static build
- `Deploy GitHub Pages`：`main` push 後部署 `web/out`
- `Update verified lottery data`：每週一、週四台灣時間 21:15 ingestion；只有驗證成功且內容改變才 commit snapshot

## Disclaimer

本專案不是投注建議。Lottery draws 應視為隨機事件；歷史 pattern 不代表未來機率改變。
