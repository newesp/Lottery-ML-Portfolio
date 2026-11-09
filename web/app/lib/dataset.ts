import { getSiteFacts } from "./facts";

export interface DatasetSummary {
  draw_count: number;
  date_min: string;
  date_max: string;
  sha256: string;
  fetched_at?: string;
}

export function getLatestDatasetSummary(): DatasetSummary {
  return getSiteFacts().dataset;
}
