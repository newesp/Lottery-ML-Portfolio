"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitHubIcon } from "./Icons";

type NavLinkItem = {
  href: string;
  label: string;
  hasLiveBadge?: boolean;
};

const links: readonly NavLinkItem[] = [
  { href: "/", label: "專案總覽" },
  { href: "/data", label: "開獎資料" },
  { href: "/features", label: "特徵工程" },
  { href: "/experiments", label: "互動實驗室" },
  { href: "/evaluation", label: "盲測驗收" },
  { href: "/forward", label: "前瞻盲測", hasLiveBadge: true },
  { href: "/findings", label: "結論與限制" },
  { href: "/reproducibility", label: "重現步驟" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="nav-shell">
        <div className="brand-group">
          <Link className="brand" href="/" aria-label="Lottery ML Lab 首頁">
            <span className="brand-mark">L</span>
            <span className="brand-text">
              Lottery <b>ML Lab</b>
            </span>
          </Link>
        </div>

        <nav className="site-nav" aria-label="主要導覽">
          {links.map(({ href, label, hasLiveBadge }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`nav-link ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {label}
                {hasLiveBadge && (
                  <span className="nav-live-dot" title="前瞻盲測進行中" aria-label="盲測進行中">
                    <span className="nav-live-ping" />
                    <span className="nav-live-core" />
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="nav-actions">
          <a
            href="https://github.com/newesp/Lottery-ML-Portfolio"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-github-btn"
            aria-label="查看 GitHub 原始碼（新分頁）"
          >
            <GitHubIcon size={16} />
            <span className="nav-github-text">GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}
