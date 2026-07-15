import type { Metadata } from "next";
import "./globals.css";
import "./responsive-fixes.css";
import { SiteNav } from "./components/SiteNav";

export const metadata: Metadata = {
  title: "Lottery ML Lab｜台灣威力彩機器學習案例",
  description: "從可驗證資料管線、Time Series CV 到誠實負結果的 ML case study。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        <a className="skip-link" href="#main">跳至主要內容</a>
        <SiteNav />
        <main id="main">{children}</main>
        <footer className="site-footer">
          <p>Lottery ML Lab · 可重現的 ML case study，不是投注建議。</p>
          <a href="https://github.com/newesp/Lottery-ML-Portfolio">GitHub 原始碼 ↗</a>
        </footer>
      </body>
    </html>
  );
}
