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
  regular: "每週二、週五台灣時間 09:17（12:17 複檢）",
  description: "每週二、週五台灣時間 09:17（並於 12:17 複檢）",
  crons: ["17 1 * * 2,5", "17 4 * * 2,5"],
} as const;

// Column counts defined in src/lottery_ml/features/schema.py
// GAP_COLUMNS (4), CONTEXT_COLUMNS (19), COOCCURRENCE_COLUMNS (3)
export const FIXED_FEATURE_GROUP_COUNTS = {
  gap: 4,
  context: 19,
  cooccurrence: 3,
} as const;
