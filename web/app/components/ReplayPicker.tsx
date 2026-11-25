"use client";

import { useState } from "react";
import {
  Tickets,
  versionLabel,
  type Draw,
  type Prediction,
} from "./RollingTables";

type Row = { actual: Draw; predictions: Record<string, Prediction> };

export function ReplayPicker({ rows }: { rows: Row[] }) {
  const [date, setDate] = useState(rows[0]?.actual.draw_date);
  const selected = rows.find((row) => row.actual.draw_date === date);
  if (!selected) return null;

  return (
    <section className="rolling-picker">
      <div className="rolling-picker-head">
        <h3>查看單期選號與開獎結果</h3>
        <label className="rolling-picker-control">
          <span>開獎日</span>
          <select
            className="lab-select"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          >
            {rows.map((row) => (
              <option key={row.actual.draw_date}>{row.actual.draw_date}</option>
            ))}
          </select>
        </label>
      </div>
      {Object.entries(selected.predictions).map(([version, prediction]) => (
        <details
          key={version}
          className="rolling-details"
          open={version === "rolling-v2"}
        >
          <summary>{versionLabel(version)} 選號與開獎結果</summary>
          <Tickets prediction={prediction} actual={selected.actual} />
        </details>
      ))}
    </section>
  );
}
