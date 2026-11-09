export interface GameAreaConfig {
  max: number;
  pick: number;
}

export const GAME = {
  area1: { max: 38, pick: 6 },
  area2: { max: 8, pick: 1 },
  get totalCandidates(): number {
    return this.area1.max + this.area2.max;
  },
} as const;

export const SCHEDULE = {
  regular: "每週一、週四台灣時間 21:15",
  catchup: "每週二、週五台灣時間 09:00",
  description:
    "每週一、週四台灣時間 21:15（開獎當晚）與每週二、週五 09:00（補抓來源延遲）",
  crons: ["15 13 * * 1,4", "0 1 * * 2,5"],
} as const;

// Column counts defined in src/lottery_ml/features/schema.py
// GAP_COLUMNS (4), CONTEXT_COLUMNS (19), COOCCURRENCE_COLUMNS (3)
export const FIXED_FEATURE_GROUP_COUNTS = {
  gap: 4,
  context: 19,
  cooccurrence: 3,
} as const;
