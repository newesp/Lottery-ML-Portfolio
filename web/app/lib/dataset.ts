import fs from "node:fs";
import path from "node:path";
import development from "../../public/artifacts/development-v1.json";

export interface DatasetSummary {
  draw_count: number;
  date_min: string;
  date_max: string;
  sha256: string;
  fetched_at?: string;
}

export function getLatestDatasetSummary(): DatasetSummary {
  try {
    const manifestCandidates = [
      path.resolve(process.cwd(), "../data/manifests"),
      path.resolve(process.cwd(), "data/manifests"),
    ];

    const manifestDir = manifestCandidates.find((dir) => fs.existsSync(dir));
    if (manifestDir) {
      const files = fs
        .readdirSync(manifestDir)
        .filter((file) => file.endsWith(".json"))
        .sort();

      if (files.length > 0) {
        const latestFile = path.join(manifestDir, files[files.length - 1]);
        const manifest = JSON.parse(fs.readFileSync(latestFile, "utf-8"));
        if (
          typeof manifest.draw_count === "number" &&
          typeof manifest.date_min === "string" &&
          typeof manifest.date_max === "string" &&
          typeof manifest.sha256 === "string"
        ) {
          return {
            draw_count: manifest.draw_count,
            date_min: manifest.date_min,
            date_max: manifest.date_max,
            sha256: manifest.sha256,
            fetched_at: typeof manifest.fetched_at === "string" ? manifest.fetched_at : undefined,
          };
        }
      }
    }

    // Fallback: read canonical dataset if manifest is unavailable
    const canonicalCandidates = [
      path.resolve(process.cwd(), "../data/processed/power-lottery.json"),
      path.resolve(process.cwd(), "data/processed/power-lottery.json"),
    ];
    const canonicalFile = canonicalCandidates.find((f) => fs.existsSync(f));
    if (canonicalFile) {
      const payload = JSON.parse(fs.readFileSync(canonicalFile, "utf-8"));
      if (Array.isArray(payload.draws) && payload.draws.length > 0) {
        return {
          draw_count: payload.draws.length,
          date_min: payload.draws[0].draw_date ?? "2008-01-24",
          date_max: payload.draws[payload.draws.length - 1].draw_date ?? "2026-07-13",
          sha256: development.data_sha256,
        };
      }
    }
  } catch (err) {
    console.warn("Failed to read latest dataset info, falling back to development defaults", err);
  }

  return {
    draw_count: development.draw_count,
    date_min: "2008-01-24",
    date_max: "2026-07-13",
    sha256: development.data_sha256,
  };
}
