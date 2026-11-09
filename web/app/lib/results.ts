import { getSiteFacts, type FoldData, type RunData } from "./facts";
import { areaLabel } from "./labels";

export type Fold = FoldData;
export type Run = RunData;

const facts = getSiteFacts();

export const dev = facts.dev;
export const locked = facts.holdout;

export { areaLabel };
export { num, pct } from "./format";
