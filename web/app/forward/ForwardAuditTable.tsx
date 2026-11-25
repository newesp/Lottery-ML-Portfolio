"use client";

import { useMemo, useState } from "react";
import { NumberBall } from "../components/NumberBall";
import type { ForwardEntry } from "../lib/forward";

const PAGE_SIZE = 10;

export function ForwardAuditTable({ entries }: { entries: ForwardEntry[] }) {
  const [page, setPage] = useState(1);

  const sorted = useMemo(
    () =>
      [...entries].sort(
        (a, b) =>
          b.assumed_target_date.localeCompare(a.assumed_target_date) ||
          b.cutoff_draw_id.localeCompare(a.cutoff_draw_id)
      ),
    [entries]
  );

  if (sorted.length === 0) {
    return <p className="muted">目前尚無歷史盲測紀錄。</p>;
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(startIdx, startIdx + PAGE_SIZE);
  const startNum = startIdx + 1;
  const endNum = startIdx + pageItems.length;

  return (
    <div className="audit-table-wrap">
      <div className="table-scroll">
        <table className="lab-table audit-table">
          <thead>
            <tr>
              <th scope="col">目標開獎日</th>
              <th scope="col">狀態</th>
              <th scope="col">實際開獎號碼</th>
              <th scope="col">模型預測選號</th>
              <th scope="col">模型命中</th>
              <th scope="col">歷史頻率選號</th>
              <th scope="col">歷史頻率命中</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((entry) => {
              const actualA1 = entry.actual ? entry.actual.area1 : [];
              const actualA2 = entry.actual ? entry.actual.area2 : null;
              const isResolved = entry.status === "resolved";

              return (
                <tr
                  key={entry.cutoff_draw_id}
                  className={isResolved ? "resolved-row" : "pending-row"}
                >
                  <td>
                    <strong>{entry.assumed_target_date}</strong>
                    {!entry.target_date_matched && (
                      <span className="audit-warning-text">
                        （實際開獎日 {entry.target_draw_id}）
                      </span>
                    )}
                    {entry.input_data_changed && (
                      <span className="audit-warning-text">
                        （歷史資料曾修正）
                      </span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`status-pill ${isResolved ? "resolved" : "pending"}`}
                    >
                      {isResolved ? "已開獎結算" : "待開獎"}
                    </span>
                  </td>
                  <td>
                    {entry.actual ? (
                      <div className="ball-group">
                        {actualA1.map((n) => (
                          <NumberBall
                            key={n}
                            number={n}
                            area="area1"
                            size="sm"
                          />
                        ))}
                        <span className="ball-sep" aria-hidden="true">
                          +
                        </span>
                        {actualA2 !== null && (
                          <NumberBall number={actualA2} area="area2" size="sm" />
                        )}
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="ball-group">
                      {entry.picks.model.area1.map((n) => (
                        <NumberBall
                          key={n}
                          number={n}
                          area="area1"
                          isHit={actualA1.includes(n)}
                          size="sm"
                        />
                      ))}
                      <span className="ball-sep" aria-hidden="true">
                        +
                      </span>
                      <NumberBall
                        number={entry.picks.model.area2[0]}
                        area="area2"
                        isHit={actualA2 === entry.picks.model.area2[0]}
                        size="sm"
                      />
                    </div>
                  </td>
                  <td>
                    {entry.hits ? (
                      <span className="hits-tag">
                        第一區 <b>{entry.hits.model.area1}</b> 顆／第二區{" "}
                        <b>{entry.hits.model.area2}</b> 顆
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="ball-group">
                      {entry.picks.historical_frequency.area1.map((n) => (
                        <NumberBall
                          key={n}
                          number={n}
                          area="area1"
                          isHit={actualA1.includes(n)}
                          size="sm"
                        />
                      ))}
                      <span className="ball-sep" aria-hidden="true">
                        +
                      </span>
                      <NumberBall
                        number={entry.picks.historical_frequency.area2[0]}
                        area="area2"
                        isHit={
                          actualA2 === entry.picks.historical_frequency.area2[0]
                        }
                        size="sm"
                      />
                    </div>
                  </td>
                  <td>
                    {entry.hits ? (
                      <span className="hits-tag">
                        第一區 <b>{entry.hits.historical_frequency.area1}</b>{" "}
                        顆／第二區{" "}
                        <b>{entry.hits.historical_frequency.area2}</b> 顆
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="audit-pagination" role="navigation" aria-label="盲測紀錄分頁">
        <span className="audit-pagination-meta">
          顯示第 {startNum}–{endNum} 筆，共 {sorted.length} 筆（依目標開獎日由新到舊，每頁 {PAGE_SIZE} 筆）
        </span>
        {totalPages > 1 && (
          <div className="audit-pagination-controls">
            <button
              type="button"
              className="audit-page-btn"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一頁
            </button>
            <span className="audit-page-indicator">
              第 {currentPage}／{totalPages} 頁
            </span>
            <button
              type="button"
              className="audit-page-btn"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一頁
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
