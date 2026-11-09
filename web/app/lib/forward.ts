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

export type LatestPending = {
  cutoff_draw_id: string;
  assumed_target_date: string;
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

  return parsed as ForwardSummary;
}
