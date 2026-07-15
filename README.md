# Lottery ML Portfolio

以台灣威力彩歷史資料為題材的 Machine Learning 作品集專案。

本專案的目的不是宣稱可以預測隨機開獎結果，而是完整展示一條可信、可重現、能誠實呈現負面結果的 ML workflow：

- 歷史資料抓取、驗證與 immutable snapshots
- 資料準備、特徵工程與模型專屬 preprocessing
- Baseline、Logistic Regression、Random Forest 與 LightGBM
- Expanding-window Time Series Cross Validation
- Locked temporal holdout、機率指標與不確定性評估
- 預先計算的 Experiment Playground
- 面向技術主管／ML 招募者的 RWD Web case study
- 供 ML 新手閱讀的繁體中文學習文件

## 專案狀態

目前處於設計階段；功能實作尚未開始。

完整且已核准的系統設計請參閱：

- [Lottery ML Portfolio 系統設計](docs/superpowers/specs/2026-07-15-lottery-ml-portfolio-design.md)
- [文件導覽](docs/README.md)

## 設計原則

1. 不把 lottery prediction 包裝成有效的投資或投注工具。
2. Baseline 優先；模型必須證明自己是否真的優於隨機。
3. 所有時間特徵只使用預測時點以前的資料。
4. CV、holdout、調參與最終評估的責任清楚分離。
5. Web 顯示的每個實驗數字都來自版本化 artifact，不手動寫死。
6. v1 使用繁體中文並保留英文技術名詞；v2 再加入正式英文內容與中英切換。
7. v1 不使用 GSAP，動畫只保留有助於層級、回饋與狀態理解的最低限度效果。
