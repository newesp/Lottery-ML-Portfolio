import Link from "next/link";

const links = [
  ["/", "Overview"], ["/data", "Data"], ["/features", "Features"],
  ["/experiments", "ML Lab"], ["/evaluation", "Evaluation"],
  ["/findings", "Findings"], ["/reproducibility", "Reproduce"],
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
