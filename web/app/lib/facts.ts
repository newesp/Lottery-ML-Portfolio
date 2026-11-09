import fs from "node:fs";
import path from "node:path";
import {
  FIXED_FEATURE_GROUP_COUNTS,
  GAME,
  SCHEDULE,
  type GameAreaConfig,
} from "./constants";

export { FIXED_FEATURE_GROUP_COUNTS, GAME, SCHEDULE, type GameAreaConfig };

export interface SourceCorrection {
  correction_id: string;
  draw_id: string;
  field: string;
  old: number | string;
  new: number | string;
  reason: string;
  sources: string[];
}

export interface ManifestData {
  schema_version: string;
  fetched_at: string;
  source_urls: string[];
  sha256: string;
  draw_count: number;
  date_min: string;
  date_max: string;
  validation_status: string;
  corrections_applied: string[];
  git_commit: string;
}

export interface FoldData {
  validation_year: number;
  metrics: Record<string, number>;
}

export interface RunData {
  run_id: string;
  kind: "model" | "baseline";
  area: "area1" | "area2";
  model: string;
  feature_set: string | null;
  config_id: string;
  mean_metrics: Record<string, number>;
  std_metrics: Record<string, number>;
  folds: FoldData[];
}

export interface DevelopmentArtifact {
  schema_version: string;
  experiment_id: string;
  draw_count: number;
  data_sha256: string;
  holdout_start: string;
  feature_version: string;
  cv_validation_years: number[];
  package_versions: Record<string, string>;
  runs: RunData[];
}

export interface AreaMetricSummary {
  area: "area1" | "area2";
  draw_count: number;
  average_hits: number;
  precision_at_k: number;
  recall_at_k: number;
  lift_over_uniform: number;
  brier_score: number;
  log_loss: number;
}

export interface AreaCIPaired {
  confidence_level: number;
  estimate: number;
  lower: number;
  upper: number;
  resamples: number;
  seed: number;
}

export interface AreaHoldoutData {
  selection: {
    model: string;
    feature_set: string;
    config_id: string;
    parameters: Record<string, unknown>;
  };
  seed_results: Array<{ seed: number; metrics: AreaMetricSummary }>;
  ensemble_metrics: AreaMetricSummary;
  baselines: {
    uniform: AreaMetricSummary;
    rolling_frequency: AreaMetricSummary;
  };
  paired_bootstrap_hits_vs_uniform: AreaCIPaired;
  legacy_v1_fixed_ticket_uniform?: {
    metrics: AreaMetricSummary;
    paired_bootstrap_hits_vs_uniform: AreaCIPaired;
  };
}

export interface HoldoutArtifact {
  schema_version: string;
  experiment_id: string;
  supersedes?: string;
  selection_id: string;
  development_artifact_sha256: string;
  data_sha256: string;
  draw_count: number;
  holdout_start: string;
  holdout_draw_count: number;
  areas: {
    area1: AreaHoldoutData;
    area2: AreaHoldoutData;
  };
}

export interface SelectionAreaConfig {
  model: string;
  feature_set: string;
  config_id: string;
  parameters: Record<string, unknown>;
  seeds: number[];
}

export interface SelectionArtifact {
  schema_version: string;
  selection_id: string;
  development_artifact: string;
  development_artifact_sha256: string;
  holdout_start: string;
  selection_metric: string;
  bootstrap_resamples: number;
  bootstrap_seed: number;
  areas: {
    area1: SelectionAreaConfig;
    area2: SelectionAreaConfig;
  };
}

export interface FeatureConfigArtifact {
  schema_version: string;
  version: string;
  rolling_windows: number[];
  ewm_halflives: number[];
  feature_sets: Record<string, string[]>;
}

export interface SiteFacts {
  dataset: {
    draw_count: number;
    date_min: string;
    date_max: string;
    date_min_year: string;
    date_max_year: string;
    sha256: string;
    fetched_at?: string;
  };
  frozenDataset: {
    draw_count: number;
    sha256: string;
  };
  cv: {
    years: number[];
    roundCount: number;
    startYear: string;
    endYear: string;
    rangeText: string;
  };
  holdout: HoldoutArtifact;
  holdoutStartYear: string;
  selection: SelectionArtifact;
  selectionSeeds: number[];
  ensembleSeedCount: number;
  bootstrapResamples: number;
  dev: DevelopmentArtifact;
  devRunCount: number;
  devFoldCount: number;
  features: {
    config: FeatureConfigArtifact;
    rolling_windows: number[];
    rolling_windows_min: number;
    rolling_windows_max: number;
    ewm_halflives: number[];
    frequency_count: number;
    total_count: number;
  };
  sourceCorrections: SourceCorrection[];
  game: typeof GAME;
  schedule: typeof SCHEDULE;
}

function resolveRootFile(relativePath: string): string {
  const candidates = [
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), "..", relativePath),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      `[Fail Loud] Required file not found: "${relativePath}". Searched: ${candidates.join(
        ", "
      )}`
    );
  }
  return found;
}

function resolveRootDir(relativeDir: string): string {
  const candidates = [
    path.resolve(process.cwd(), relativeDir),
    path.resolve(process.cwd(), "..", relativeDir),
  ];
  const found = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).isDirectory());
  if (!found) {
    throw new Error(
      `[Fail Loud] Required directory not found: "${relativeDir}". Searched: ${candidates.join(
        ", "
      )}`
    );
  }
  return found;
}

function readJsonFile<T>(relativePath: string): T {
  const filePath = resolveRootFile(relativePath);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (err) {
    throw new Error(
      `[Fail Loud] Failed to parse JSON from file "${filePath}": ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

function loadLatestManifest(): ManifestData {
  const manifestDir = resolveRootDir("data/manifests");
  const files = fs
    .readdirSync(manifestDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (files.length === 0) {
    throw new Error(`[Fail Loud] No manifest files found in ${manifestDir}`);
  }
  const latestFile = path.join(manifestDir, files[files.length - 1]);
  try {
    const raw = JSON.parse(fs.readFileSync(latestFile, "utf-8")) as ManifestData;
    if (
      typeof raw.draw_count !== "number" ||
      typeof raw.date_min !== "string" ||
      typeof raw.date_max !== "string" ||
      typeof raw.sha256 !== "string"
    ) {
      throw new Error(`Manifest in "${latestFile}" missing required fields`);
    }
    return raw;
  } catch (err) {
    throw new Error(
      `[Fail Loud] Failed to read latest manifest "${latestFile}": ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

let cachedFacts: SiteFacts | null = null;

export function resetSiteFactsCache(): void {
  cachedFacts = null;
}

export function getSiteFacts(): SiteFacts {
  if (cachedFacts) {
    return cachedFacts;
  }

  const manifest = loadLatestManifest();
  const dev = readJsonFile<DevelopmentArtifact>("artifacts/experiments/development-v1.json");
  const holdout = readJsonFile<HoldoutArtifact>("artifacts/experiments/holdout-v1.1.json");
  const selection = readJsonFile<SelectionArtifact>("configs/experiments/selection-v1.json");
  const featureConfig = readJsonFile<FeatureConfigArtifact>("configs/features/v1.json");
  const correctionsPayload = readJsonFile<{
    corrections: SourceCorrection[];
  }>("configs/data/source-corrections.json");

  // Feature count calculation per §C3-4
  const rollingWindows = featureConfig.rolling_windows;
  const ewmHalflives = featureConfig.ewm_halflives;
  const frequencyCount = 2 + 2 * rollingWindows.length + ewmHalflives.length;
  const totalFeatureCount =
    frequencyCount +
    FIXED_FEATURE_GROUP_COUNTS.gap +
    FIXED_FEATURE_GROUP_COUNTS.context +
    FIXED_FEATURE_GROUP_COUNTS.cooccurrence;

  const cvYears = dev.cv_validation_years;
  if (!Array.isArray(cvYears) || cvYears.length === 0) {
    throw new Error("[Fail Loud] cv_validation_years must be non-empty array");
  }

  const devRuns = dev.runs ?? [];
  const devFoldCount = devRuns.reduce((sum, run) => sum + (run.folds?.length ?? 0), 0);

  const seeds = selection.areas.area1.seeds;

  cachedFacts = {
    dataset: {
      draw_count: manifest.draw_count,
      date_min: manifest.date_min,
      date_max: manifest.date_max,
      date_min_year: manifest.date_min.slice(0, 4),
      date_max_year: manifest.date_max.slice(0, 4),
      sha256: manifest.sha256,
      fetched_at: manifest.fetched_at,
    },
    frozenDataset: {
      draw_count: dev.draw_count,
      sha256: dev.data_sha256,
    },
    cv: {
      years: cvYears,
      roundCount: cvYears.length,
      startYear: String(cvYears[0]),
      endYear: String(cvYears[cvYears.length - 1]),
      rangeText: `${cvYears[0]}–${cvYears[cvYears.length - 1]}`,
    },
    holdout,
    holdoutStartYear: holdout.holdout_start.slice(0, 4),
    selection,
    selectionSeeds: seeds,
    ensembleSeedCount: seeds.length,
    bootstrapResamples: selection.bootstrap_resamples,
    dev,
    devRunCount: devRuns.length,
    devFoldCount,
    features: {
      config: featureConfig,
      rolling_windows: rollingWindows,
      rolling_windows_min: rollingWindows[0],
      rolling_windows_max: rollingWindows[rollingWindows.length - 1],
      ewm_halflives: ewmHalflives,
      frequency_count: frequencyCount,
      total_count: totalFeatureCount,
    },
    sourceCorrections: correctionsPayload.corrections ?? [],
    game: GAME,
    schedule: SCHEDULE,
  };

  return cachedFacts;
}
