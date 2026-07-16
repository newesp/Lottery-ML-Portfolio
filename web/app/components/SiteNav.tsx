import Link from "next/link";

const links = [
  ["/", "總覽"], ["/data", "資料"], ["/features", "特徵工程"],
  ["/experiments", "實驗室"], ["/evaluation", "最終評估"],
  ["/findings", "結論與限制"], ["/reproducibility", "重現方法"],
] as const;

export function SiteNav() {
  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link className="brand" href="/" aria-label="Lottery ML Lab 首頁">
          <span className="brand-mark">L</span><span>Lottery <b>ML Lab</b></span>
        </Link>
        <nav aria-label="主要導覽">
          {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
      </div>
    </header>
  );
}
