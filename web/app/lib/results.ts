import development from "../../public/artifacts/development-v1.json";
import holdout from "../../public/artifacts/holdout-v1.json";

export type Fold = { validation_year: number; metrics: Record<string, number> };
export type Run = {
  run_id: string; kind: "model" | "baseline"; area: "area1" | "area2";
  model: string; feature_set: string | null; config_id: string;
  mean_metrics: Record<string, number>; std_metrics: Record<string, number>; folds: Fold[];
};

export const dev = development as typeof development & { runs: Run[] };
export const locked = holdout;
export const areaLabel = (area: string) => area === "area1" ? "第一區（選 6 / 38）" : "第二區（選 1 / 8）";
export const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
export const num = (value: number, digits = 3) => value.toFixed(digits);
