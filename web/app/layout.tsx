import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "./responsive-fixes.css";
import { SiteNav } from "./components/SiteNav";
import { ExternalLinkIcon, GitHubIcon, ShieldCheckIcon } from "./components/Icons";

export const metadata: Metadata = {
  title: "Lottery ML Lab｜台灣威力彩機器學習實測",
  description: "以台灣威力彩為題的可重現機器學習案例：從防竄改資料管線、時間序列驗證到盲測負結果的完整工程實錄。",
  keywords: ["Machine Learning", "Taiwan SuperLotto", "Data Lineage", "Time Series Cross Validation", "Reproducible AI"],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        <a className="skip-link" href="#main">跳至主要內容</a>
        <SiteNav />
        <main id="main">{children}</main>
        
        <footer className="site-footer">
          <div className="footer-shell">
            <div className="footer-top">
              <div className="footer-brand">
                <div className="footer-logo">
                  <span className="brand-mark">L</span>
                  <span className="brand-name">Lottery <b>ML Lab</b></span>
                </div>
                <p className="footer-tagline">
                  可重現、可檢驗、坦然面對隨機性的機器學習工程案例。
                </p>
                <div className="footer-badges">
                  <span className="tech-badge">
                    <ShieldCheckIcon size={14} />
                    SHA-256 Verified
                  </span>
                  <span className="tech-badge">Python 3.12+ · Next.js 16</span>
                  <span className="tech-badge">MIT License</span>
                </div>
              </div>

              <div className="footer-nav-col">
                <h4 className="footer-col-title">專案導覽</h4>
                <ul className="footer-links">
                  <li><Link href="/">專案總覽</Link></li>
                  <li><Link href="/data">開獎資料管線</Link></li>
                  <li><Link href="/features">防洩漏特徵工程</Link></li>
                  <li><Link href="/experiments">互動實驗室</Link></li>
                  <li><Link href="/evaluation">封存盲測驗收</Link></li>
                  <li><Link href="/forward">前瞻盲測帳本</Link></li>
                </ul>
              </div>

              <div className="footer-nav-col">
                <h4 className="footer-col-title">技術文件與規範</h4>
                <ul className="footer-links">
                  <li><a href="https://github.com/newesp/Lottery-ML-Portfolio/blob/main/docs/system-design.md" target="_blank" rel="noopener noreferrer">系統架構設計 <ExternalLinkIcon size={11} /></a></li>
                  <li><a href="https://github.com/newesp/Lottery-ML-Portfolio/blob/main/docs/ml-methodology.md" target="_blank" rel="noopener noreferrer">ML 方法與評估 <ExternalLinkIcon size={11} /></a></li>
                  <li><a href="https://github.com/newesp/Lottery-ML-Portfolio/blob/main/docs/model-card.md" target="_blank" rel="noopener noreferrer">Model Card 模型卡 <ExternalLinkIcon size={11} /></a></li>
                  <li><a href="https://github.com/newesp/Lottery-ML-Portfolio/blob/main/docs/data-pipeline.md" target="_blank" rel="noopener noreferrer">資料管線合約 <ExternalLinkIcon size={11} /></a></li>
                  <li><a href="https://github.com/newesp/Lottery-ML-Portfolio" target="_blank" rel="noopener noreferrer">GitHub 原始碼 <ExternalLinkIcon size={11} /></a></li>
                </ul>
              </div>
            </div>

            <div className="footer-bottom">
              <p className="footer-disclaimer">
                免責聲明：本專案純屬機器學習工程與統計驗證展示，並非投注建議。彩券開獎應視為獨立隨機事件，過往出現頻率不會改變未來開獎機率。
              </p>
              <div className="footer-copy-row">
                <span>© {new Date().getFullYear()} Lottery ML Lab · All rights reserved.</span>
                <a
                  href="https://github.com/newesp/Lottery-ML-Portfolio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-repo-link"
                >
                  <GitHubIcon size={15} />
                  <span>View on GitHub</span>
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
