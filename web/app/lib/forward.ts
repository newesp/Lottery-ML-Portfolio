import fs from "node:fs";
import path from "node:path";

export type ForwardEntry = {
  cutoff_draw_id: string;
  assumed_target_date: string;
  status: "pending" | "resolved";
  target_draw_id: string | null;
  target_date_matched: boolean;
  input_data_changed: boolean;
  actual: {
    area1: number[];
    area2: number;
  } | null;
  picks: {
    model: {
      area1: number[];
      area2: number[];
    };
    historical_frequency: {
      area1: number[];
      area2: number[];
    };
  };
  hits: {
    model: {
      area1: number;
      area2: number;
    };
    historical_frequency: {
      area1: number;
      area2: number;
    };
  } | null;
};

export type CutoffActual = {
  area1: number[];
  area2: number;
};

export type LatestPending = {
  cutoff_draw_id: string;
  assumed_target_date: string;
  cutoff_actual?: CutoffActual | null;
  predictions: {
    model: {
      area1: {
        picks: number[];
        top_scores: [number, number][];
      };
      area2: {
        picks: number[];
        top_scores: [number, number][];
      };
    };
    historical_frequency: {
      area1: {
        picks: number[];
      };
      area2: {
        picks: number[];
      };
    };
  };
};

export type ForwardSummary = {
  schema_version: string;
  protocol_id: string;
  selection_id: string;
  expected_hits_uniform: {
    area1: number;
    area2: number;
  };
  latest_pending: LatestPending | null;
  entries: ForwardEntry[];
  aggregate: {
    resolved_count: number;
    mean_hits: {
      model: {
        area1: number;
        area2: number;
      };
      historical_frequency: {
        area1: number;
        area2: number;
      };
    };
    unpredicted_draws_since_start: number;
  };
};

function getCutoffActualFromDataset(drawId: string): CutoffActual | null {
  const candidatePaths = [
    path.join(process.cwd(), "..", "data", "processed", "power-lottery.json"),
    path.join(process.cwd(), "data", "processed", "power-lottery.json"),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      try {
        const raw = JSON.parse(fs.readFileSync(candidate, "utf-8"));
        if (Array.isArray(raw?.draws)) {
          const found = raw.draws.find(
            (d: { draw_id?: string; draw_date?: string }) =>
              d.draw_id === drawId || d.draw_date === drawId
          );
          if (
            found &&
            Array.isArray(found.area1) &&
            typeof found.area2 === "number"
          ) {
            return {
              area1: found.area1,
              area2: found.area2,
            };
          }
        }
      } catch {
        // Fallback gracefully
      }
    }
  }
  return null;
}

export function getForwardSummary(): ForwardSummary | null {
  const candidatePaths = [
    path.join(process.cwd(), "..", "artifacts", "forward", "summary.json"),
    path.join(process.cwd(), "artifacts", "forward", "summary.json"),
  ];

  let raw = "";
  let found = false;

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      raw = fs.readFileSync(candidate, "utf-8");
      found = true;
      break;
    }
  }

  if (!found) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse artifacts/forward/summary.json: ${error}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("artifacts/forward/summary.json must contain a JSON object");
  }

  const obj = parsed as Record<string, unknown>;
  const required = [
    "schema_version",
    "protocol_id",
    "selection_id",
    "expected_hits_uniform",
    "latest_pending",
    "entries",
    "aggregate",
  ];

  for (const key of required) {
    if (!(key in obj)) {
      throw new Error(`artifacts/forward/summary.json missing required key: ${key}`);
    }
  }

  if (obj.schema_version !== "1.0.0") {
    throw new Error(`Unsupported forward summary schema_version: ${obj.schema_version}`);
  }

  const result = parsed as ForwardSummary;
  if (result.latest_pending && !result.latest_pending.cutoff_actual) {
    result.latest_pending.cutoff_actual = getCutoffActualFromDataset(
      result.latest_pending.cutoff_draw_id
    );
  }

  return result;
}
