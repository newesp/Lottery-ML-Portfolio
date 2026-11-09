export type CIVerdict = "above_zero" | "below_zero" | "crosses_zero";

export function ciVerdict(lower: number, upper: number): CIVerdict {
  if (lower > 0) return "above_zero";
  if (upper < 0) return "below_zero";
  return "crosses_zero";
}

export function ciExplanation(verdict: CIVerdict): string {
  switch (verdict) {
    case "above_zero":
      return "信賴區間完整落在 0 以上，具備優於隨機選號的統計證據；至於這點差距是否具備實質應用價值，仍須視提升幅度而定。";
    case "below_zero":
      return "信賴區間完整落在 0 以下，顯示模型表現反而不如隨機選號。";
    case "crosses_zero":
      return "信賴區間跨越 0，代表真實差距可能是正、也可能是負；在統計上無法排除只是單純的抽樣波動。";
  }
}

export function compareLabel(a: number, b: number, eps = 1e-6): "高於" | "低於" | "等於" {
  if (Math.abs(a - b) <= eps) return "等於";
  return a > b ? "高於" : "低於";
}

export function heroCiTag(verdict: CIVerdict): { title: string; subtitle: string } {
  switch (verdict) {
    case "above_zero":
      return { title: "95% CI 高於 0", subtitle: "具備優於隨機期望值的統計證據" };
    case "below_zero":
      return { title: "95% CI 低於 0", subtitle: "表現顯著低於隨機期望值" };
    case "crosses_zero":
      return { title: "95% CI 跨越 0", subtitle: "與隨機選號的微幅差距，統計上可能純屬巧合" };
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
    comparison = "在封存至最後才開箱的盲測（Holdout）中，模型的帳面平均命中數雖然略高於隨機選號的理論期望值；";
  } else if (c1 === "高於") {
    comparison = `在封存盲測（Holdout）中，第一區模型的平均命中數略高於隨機期望值，第二區則${c2}隨機期望值；`;
  } else {
    comparison = `在封存盲測（Holdout）中，模型在第一區${c1}、第二區${c2}隨機選號的理論期望值；`;
  }

  const v1 = ciVerdict(area1.ciLower, area1.ciUpper);
  const v2 = ciVerdict(area2.ciLower, area2.ciUpper);

  let ciSummary = "";
  if (v1 === "crosses_zero" && v2 === "crosses_zero") {
    ciSummary = "但經過 Paired Bootstrap 抽樣檢驗，兩區的 95% 信賴區間皆跨越 0，意味著這點微幅領先很可能只是抽樣波動帶來的巧合。";
  } else if (v1 === "above_zero" && v2 === "above_zero") {
    ciSummary = "且 Paired Bootstrap 95% 信賴區間於兩區皆高於 0，顯示出統計上的正向差距。";
  } else {
    const textV1 = v1 === "crosses_zero" ? "跨越 0" : v1 === "above_zero" ? "高於 0" : "低於 0";
    const textV2 = v2 === "crosses_zero" ? "跨越 0" : v2 === "above_zero" ? "高於 0" : "低於 0";
    ciSummary = `但 Paired Bootstrap 95% 信賴區間在第一區${textV1}、第二區${textV2}。`;
  }

  const freq1 = area1.frequencyHits > area1.modelHits;
  const freq2 = area2.frequencyHits > area2.modelHits;

  let baselineComparison = "";
  if (freq1 && freq2) {
    baselineComparison = "更耐人尋味的是，完全不靠機器學習、單純挑歷史常開號碼的基準方法（Historical Frequency），表現反而還微幅領先模型。";
  } else if (freq1) {
    baselineComparison = "更耐人尋味的是，單純挑歷史常開號碼的基準方法（Historical Frequency），在第一區反而微幅領先模型。";
  } else if (freq2) {
    baselineComparison = "更耐人尋味的是，單純挑歷史常開號碼的基準方法（Historical Frequency），在第二區反而微幅領先模型。";
  } else {
    baselineComparison = "單純挑歷史常開號碼的基準方法（Historical Frequency）表現亦與模型相去不遠。";
  }

  const verdict =
    v1 === "crosses_zero" || v2 === "crosses_zero" || v1 === "below_zero" || v2 === "below_zero"
      ? "在現有資料與實驗設計下，沒有證據顯示模型能穩定超越隨機選號；"
      : "模型在本次實驗設定中呈現統計差異；";

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
    pointComparison = "單看帳面上的點估計（Point Estimate），兩區模型的平均命中數都比隨機選號高出一點點，";
  } else if (c1 === "高於") {
    pointComparison = `單看帳面上的點估計，第一區模型略高於隨機選號，第二區則${c2}隨機選號，`;
  } else {
    pointComparison = `單看帳面上的點估計，第一區模型${c1}、第二區${c2}隨機選號，`;
  }

  const v1 = ciVerdict(area1.ciLower, area1.ciUpper);
  const v2 = ciVerdict(area2.ciLower, area2.ciUpper);

  let ciSummary = "";
  if (v1 === "crosses_zero" && v2 === "crosses_zero") {
    ciSummary = "顯示兩區的 95% 信賴區間皆跨越 0。";
  } else if (v1 === "above_zero" && v2 === "above_zero") {
    ciSummary = "顯示兩區的 95% 信賴區間皆高於 0。";
  } else {
    const textV1 = v1 === "crosses_zero" ? "跨越 0" : v1 === "above_zero" ? "高於 0" : "低於 0";
    const textV2 = v2 === "crosses_zero" ? "跨越 0" : v2 === "above_zero" ? "高於 0" : "低於 0";
    ciSummary = `顯示第一區 95% 信賴區間${textV1}、第二區${textV2}。`;
  }

  const freq1 = area1.frequencyHits > area1.modelHits;
  const freq2 = area2.frequencyHits > area2.modelHits;

  let baselineComparison = "";
  if (freq1 && freq2) {
    baselineComparison =
      "與此同時，只按歷史累積出現率排序的簡單基準（Historical Frequency），在兩區的命中表現甚至還略勝一籌。";
  } else if (freq1) {
    baselineComparison =
      "與此同時，只按歷史累積出現率排序的簡單基準（Historical Frequency），在第一區甚至略勝一籌。";
  } else if (freq2) {
    baselineComparison =
      "與此同時，只按歷史累積出現率排序的簡單基準（Historical Frequency），在第二區甚至略勝一籌。";
  } else {
    baselineComparison =
      "與此同時，只按歷史累積出現率排序的簡單基準（Historical Frequency）表現也與模型相當。";
  }

  const decisionRule =
    "統計判讀的原則很單純：信賴區間必須完整落在 0 以上，才能支持模型表現優於隨機；若跨越 0，就代表現有證據不足以排除運氣成分。";

  return { pointComparison, ciSummary, baselineComparison, decisionRule };
}
