import type { ReactNode } from "react";
import { AlertTriangleIcon, CheckCircleIcon, ExternalLinkIcon, InfoIcon } from "./Icons";

const REPOSITORY_URL = "https://github.com/newesp/Lottery-ML-Portfolio";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function Metric({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <article className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
      {note && <small>{note}</small>}
    </article>
  );
}

export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <header className="page-intro">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1>{title}</h1>
      <div className="lede">{children}</div>
    </header>
  );
}

export function Callout({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "neutral" | "warning" | "good";
  title: string;
  children: ReactNode;
}) {
  const icon =
    tone === "warning" ? (
      <AlertTriangleIcon size={20} />
    ) : tone === "good" ? (
      <CheckCircleIcon size={20} />
    ) : (
      <InfoIcon size={20} />
    );

  return (
    <aside className={`callout ${tone}`} role="region" aria-label={title}>
      <div className="callout-header">
        <span className="callout-icon" aria-hidden="true">
          {icon}
        </span>
        <strong>{title}</strong>
      </div>
      <div className="callout-content">{children}</div>
    </aside>
  );
}

export function Steps({ items }: { items: Array<[string, string, ReactNode]> }) {
  return (
    <ol className="steps">
      {items.map(([index, title, copy]) => (
        <li key={index}>
          <span className="step-num" aria-hidden="true">{index}</span>
          <div className="step-body">
            <h3>{title}</h3>
            <p>{copy}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="text-link" href={href} target="_blank" rel="noopener noreferrer">
      <span>{children}</span>
      <ExternalLinkIcon />
      <span className="sr-only">（在新分頁開啟外部網站）</span>
    </a>
  );
}

export function RepoLink({ path, children, directory = false }: { path: string; children: ReactNode; directory?: boolean }) {
  const view = directory ? "tree" : "blob";
  return <ExternalLink href={`${REPOSITORY_URL}/${view}/main/${path}`}>{children}</ExternalLink>;
}
