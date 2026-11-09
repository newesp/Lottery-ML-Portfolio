export const MODEL_NAMES: Record<string, string> = {
  random_forest: "Random Forest｜隨機森林",
  logistic_regression: "Logistic Regression｜邏輯斯迴歸",
  lightgbm: "LightGBM｜梯度提升樹",
  uniform: "Uniform｜完全隨機選號",
  historical_frequency: "Historical Frequency｜歷史累積頻率",
  rolling_frequency: "Historical Frequency｜歷史累積頻率",
  shuffled_history: "Shuffled History｜打亂歷史關係",
};

export const MODEL_DESCRIPTIONS: Record<string, string> = {
  historical_frequency: "依過去所有期數的累積出現率排序",
  rolling_frequency: "依過去所有期數的累積出現率排序",
};

export const FEATURE_NAMES: Record<string, string> = {
  frequency: "frequency｜出現頻率",
  frequency_gap: "frequency_gap｜出現頻率＋距離上次出現的期數",
  temporal_context: "temporal_context｜頻率＋時間背景",
  full: "full｜全部線索",
};

export const METRIC_NAMES: Record<string, string> = {
  average_hits: "Average hits｜平均命中數",
  lift_over_uniform: "Lift over Uniform｜相對隨機命中倍率",
  brier_score: "Brier score｜機率誤差",
  log_loss: "Log loss｜信心錯誤代價",
};

export const METRIC_HELP: Record<string, string> = {
  average_hits:
    "每一期最後選出的號碼，平均有幾個真的開出；數值越高越好。這不是中獎率：0.88 代表平均每期命中 0.88 個號碼，不是 88% 的中獎機率。",
  lift_over_uniform:
    "模型平均命中數 ÷ 隨機選號的預期平均命中數；1 代表兩者相同，1.05 代表模型約高 5%，數值越高越好。",
  brier_score:
    "把預測機率與實際結果的差距平方後取平均；數值越低，代表機率預測越準。",
  log_loss: "答錯又過度有信心時會被重罰；數值越低越好。",
};

export function modelLabel(key: string): string {
  return MODEL_NAMES[key] ?? key.replace(/_/g, " ");
}

export function featureLabel(key: string): string {
  return FEATURE_NAMES[key] ?? key;
}

export function metricLabel(key: string): string {
  return METRIC_NAMES[key] ?? key;
}

export function areaLabel(area: string): string {
  return area === "area1" ? "第一區（選 6 / 38）" : "第二區（選 1 / 8）";
}
