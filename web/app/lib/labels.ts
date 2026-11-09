export const MODEL_NAMES: Record<string, string> = {
  random_forest: "Random Forest｜隨機森林",
  logistic_regression: "Logistic Regression｜邏輯斯迴歸",
  lightgbm: "LightGBM｜梯度提升樹",
  uniform: "Uniform｜完全隨機選號",
  historical_frequency: "Historical Frequency｜歷史累積頻率",
  rolling_frequency: "Historical Frequency｜歷史累積頻率",
  shuffled_history: "Shuffled History｜打亂歷史順序",
};

export const MODEL_DESCRIPTIONS: Record<string, string> = {
  historical_frequency: "依過去所有期數的累積出現率排序",
  rolling_frequency: "依過去所有期數的累積出現率排序",
};

export const FEATURE_NAMES: Record<string, string> = {
  frequency: "frequency｜出現頻率",
  frequency_gap: "frequency_gap｜出現頻率＋未開出間隔",
  temporal_context: "temporal_context｜頻率＋時間脈絡",
  full: "full｜完整特徵組合",
};

export const METRIC_NAMES: Record<string, string> = {
  average_hits: "Average hits｜平均命中數",
  lift_over_uniform: "Lift over Uniform｜相對隨機命中倍率",
  brier_score: "Brier score｜機率均方誤差",
  log_loss: "Log loss｜過度自信懲罰（對數損失）",
};

export const METRIC_HELP: Record<string, string> = {
  average_hits:
    "每期選出的號碼中，平均有幾顆實際開出（數值越高越好）。注意這不是中獎率：0.88 代表平均每期對中 0.88 顆球，而非 88% 的中獎機率。",
  lift_over_uniform:
    "模型平均命中數除以隨機選號的理論期望值；1.0 代表與隨機相當，1.05 代表高出約 5%。",
  brier_score:
    "衡量預測機率與實際開獎結果的均方誤差；數值越低，代表模型對機率的拿捏越準確。",
  log_loss: "預測失準卻給出極高信心時會受到重罰；數值越低越好。",
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
