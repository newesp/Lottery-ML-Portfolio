# Lottery ML Portfolio

以台灣威力彩歷史資料為題材的 Machine Learning 作品集專案。

這不是「提高中獎率」服務。威力彩開獎近似隨機，本專案刻意選擇一個模型很難產生實用預測力的問題，展示如何建立可信、可重現，而且能誠實呈現 negative result 的 ML workflow。

## 展示內容

- NFD 歷史資料抓取、驗證與 immutable snapshots
- Leakage-safe 資料準備與 feature engineering
- Uniform／Rolling Frequency／Shuffled History baselines
- Logistic Regression、Random Forest 與 LightGBM
- Expanding-window Time Series Cross Validation
- 2024 年起的 locked temporal holdout
- Probability、ranking、stability 與 uncertainty evaluation
- 預先計算的 Experiment Playground
- 面向技術主管／ML 招募者的 RWD Web case study
- 供 ML 新手閱讀的繁體中文 learning path

## Python quick start

需求：Python 3.12 或以上版本。

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

執行品質檢查：

```powershell
python -m pytest -q
python -m ruff check src tests
python -m mypy src
```

從 NFD 抓取並驗證歷史資料：

```powershell
lottery-ml ingest --from-year 2008 --through-year 2026 --root .
```

只有所有 validation gates 通過時，指令才會建立新的 snapshot、manifest 並替換 canonical dataset。相同內容再次執行會回傳 `unchanged`，不會製造重複 snapshot。

## 文件

- [系統設計](docs/superpowers/specs/2026-07-15-lottery-ml-portfolio-design.md)
- [交付 roadmap](docs/superpowers/plans/2026-07-15-lottery-ml-portfolio-roadmap.md)
- [資料管線與操作方式](docs/data-pipeline.md)
- [文件導覽](docs/README.md)

## 設計原則

1. 不把 lottery prediction 包裝成有效的投資或投注工具。
2. Baseline 優先；模型必須證明自己是否真的優於隨機。
3. 所有時間特徵只使用預測時點以前的資料。
4. CV、holdout、調參與最終評估的責任清楚分離。
5. Web 顯示的每個實驗數字都來自版本化 artifact，不手動寫死。
6. v1 使用繁體中文並保留英文技術名詞；v2 再加入正式英文內容與語系切換。
7. v1 不使用 GSAP；motion 只用於必要的狀態回饋。

## Data source

歷史開獎資料來源：[NFD 威力彩歷年資料](https://www.nfd.com.tw/lottery/lottyear/year.htm)。Repository 只保存解析後的事實資料與最小 parser fixtures，不鏡像完整來源頁面。
