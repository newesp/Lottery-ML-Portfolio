export type CIVerdict = "above_zero" | "below_zero" | "crosses_zero";

export function ciVerdict(lower: number, upper: number): CIVerdict {
  if (lower > 0) return "above_zero";
  if (upper < 0) return "below_zero";
  return "crosses_zero";
}

export function ciExplanation(verdict: CIVerdict): string {
  switch (verdict) {
    case "above_zero":
      return "整個區間高於 0，有統計證據顯示表現優於隨機選號；但仍須檢驗提升幅度是否具有實際價值。";
    case "below_zero":
      return "整個區間低於 0，有統計證據顯示表現劣於隨機選號。";
    case "crosses_zero":
      return "區間跨過 0，表示真實差距可能是正、也可能是負；目前不能排除模型其實沒有勝過隨機選號。";
  }
}

export function compareLabel(a: number, b: number, eps = 1e-6): "高於" | "低於" | "等於" {
  if (Math.abs(a - b) <= eps) return "等於";
  return a > b ? "高於" : "低於";
}

export function heroCiTag(verdict: CIVerdict): { title: string; subtitle: string } {
  switch (verdict) {
    case "above_zero":
      return { title: "95% CI 高於 0", subtitle: "統計顯著優於隨機期望值" };
    case "below_zero":
      return { title: "95% CI 低於 0", subtitle: "表現統計顯著劣於隨機期望值" };
    case "crosses_zero":
      return { title: "95% CI 跨越 0", subtitle: "模型與隨機選號的差距，可能只是運氣" };
  }
}

export interface AreaNarrativeInput {
  modelHits: number;
  uniformHits: number;
  frequencyHits: number;
  ciLower: number;
  ciUpper: number;
}

export function buildHomeConclusion(
  area1: AreaNarrativeInput,
  area2: AreaNarrativeInput
): {
  comparison: string;
  ciSummary: string;
  baselineComparison: string;
  verdict: string;
} {
  const c1 = compareLabel(area1.modelHits, area1.uniformHits);
  const c2 = compareLabel(area2.modelHits, area2.uniformHits);

  let comparison = "";
  if (c1 === "高於" && c2 === "高於") {
    comparison = "在最後才打開的 holdout 測試中，模型的平均命中數看起來比 Uniform（完全隨機選號）高；";
  } else if (c1 === "高於") {
    comparison = `在最後才打開的 holdout 測試中，第一區模型平均命中數高於 Uniform（完全隨機選號），第二區${c2} Uniform；`;
  } else {
    comparison = `在最後才打開的 holdout 測試中，模型在第一區${c1}、第二區${c2} Uniform（完全隨機選號）；`;
  }

  const v1 = ciVerdict(area1.ciLower, area1.ciUpper);
  const v2 = ciVerdict(area2.ciLower, area2.ciUpper);

  let ciSummary = "";
  if (v1 === "crosses_zero" && v2 === "crosses_zero") {
    ciSummary = "但 paired bootstrap 95% CI 跨越 0，代表這個差距仍可能只是抽樣運氣。";
  } else if (v1 === "above_zero" && v2 === "above_zero") {
    ciSummary = "且 paired bootstrap 95% CI 兩區皆高於 0，具有統計顯著優勢。";
  } else {
    const textV1 = v1 === "crosses_zero" ? "跨越 0" : v1 === "above_zero" ? "高於 0" : "低於 0";
    const textV2 = v2 === "crosses_zero" ? "跨越 0" : v2 === "above_zero" ? "高於 0" : "低於 0";
    ciSummary = `但 paired bootstrap 95% CI 顯示第一區${textV1}、第二區${textV2}。`;
  }

  const freq1 = area1.frequencyHits > area1.modelHits;
  const freq2 = area2.frequencyHits > area2.modelHits;

  let baselineComparison = "";
  if (freq1 && freq2) {
    baselineComparison = "更簡單的 Historical Frequency（依過去所有期數的累積出現率排序）甚至略高於模型。";
  } else if (freq1) {
    baselineComparison = "更簡單的 Historical Frequency（依過去所有期數的累積出現率排序）在第一區甚至略高於模型。";
  } else if (freq2) {
    baselineComparison = "更簡單的 Historical Frequency（依過去所有期數的累積出現率排序）在第二區甚至略高於模型。";
  } else {
    baselineComparison = "Historical Frequency（依過去所有期數的累積出現率排序）表現與模型相近。";
  }

  const verdict =
    v1 === "crosses_zero" || v2 === "crosses_zero" || v1 === "below_zero" || v2 === "below_zero"
      ? "因此目前沒有證據能說模型穩定勝過隨機選號；"
      : "模型在統計檢驗中展現預測優勢；";

  return { comparison, ciSummary, baselineComparison, verdict };
}

export function buildEvaluationCallout(
  area1: AreaNarrativeInput,
  area2: AreaNarrativeInput
): {
  pointComparison: string;
  ciSummary: string;
  baselineComparison: string;
  decisionRule: string;
} {
  const c1 = compareLabel(area1.modelHits, area1.uniformHits);
  const c2 = compareLabel(area2.modelHits, area2.uniformHits);

  let pointComparison = "";
  if (c1 === "高於" && c2 === "高於") {
    pointComparison = "兩區模型的單一平均值（point estimate）都比 Uniform 隨機選號高，";
  } else if (c1 === "高於") {
    pointComparison = `第一區模型的單一平均值（point estimate）高於 Uniform 隨機選號，第二區${c2} Uniform，`;
  } else {
    pointComparison = `第一區模型單一平均值${c1}、第二區${c2} Uniform 隨機選號，`;
  }

  const v1 = ciVerdict(area1.ciLower, area1.ciUpper);
  const v2 = ciVerdict(area2.ciLower, area2.ciUpper);

  let ciSummary = "";
  if (v1 === "crosses_zero" && v2 === "crosses_zero") {
    ciSummary = "顯示 95% CI 都跨越 0。";
  } else if (v1 === "above_zero" && v2 === "above_zero") {
    ciSummary = "顯示 95% CI 都高於 0。";
  } else {
    const textV1 = v1 === "crosses_zero" ? "跨越 0" : v1 === "above_zero" ? "高於 0" : "低於 0";
    const textV2 = v2 === "crosses_zero" ? "跨越 0" : v2 === "above_zero" ? "高於 0" : "低於 0";
    ciSummary = `顯示第一區 95% CI ${textV1}、第二區 ${textV2}。`;
  }

  const freq1 = area1.frequencyHits > area1.modelHits;
  const freq2 = area2.frequencyHits > area2.modelHits;

  let baselineComparison = "";
  if (freq1 && freq2) {
    baselineComparison =
      "同時，簡單的 Historical Frequency baseline（依過去所有期數的累積出現率排序）在兩區還略高於模型。";
  } else if (freq1) {
    baselineComparison =
      "同時，簡單的 Historical Frequency baseline（依過去所有期數的累積出現率排序）在第一區還略高於模型。";
  } else if (freq2) {
    baselineComparison =
      "同時，簡單的 Historical Frequency baseline（依過去所有期數的累積出現率排序）在第二區還略高於模型。";
  } else {
    baselineComparison =
      "同時，簡單的 Historical Frequency baseline（依過去所有期數的累積出現率排序）表現與模型相當。";
  }

  const decisionRule =
    "判讀規則是：整個區間高於 0 才有統計證據較好；整個區間低於 0 代表較差；跨過 0 則無法確認。即使區間都高於 0，也還要看提升幅度是否大到具有實際價值。";

  return { pointComparison, ciSummary, baselineComparison, decisionRule };
}
