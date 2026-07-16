import type { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function Metric({ value, label, note }: { value: string; label: string; note?: string }) {
  return <article className="metric"><strong>{value}</strong><span>{label}</span>{note && <small>{note}</small>}</article>;
}

export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <header className="page-intro"><Eyebrow>{eyebrow}</Eyebrow><h1>{title}</h1><div className="lede">{children}</div></header>;
}

export function Callout({ tone = "neutral", title, children }: { tone?: "neutral" | "warning" | "good"; title: string; children: ReactNode }) {
  return <aside className={`callout ${tone}`}><strong>{title}</strong><div>{children}</div></aside>;
}

export function Steps({ items }: { items: Array<[string, string, ReactNode]> }) {
  return <ol className="steps">{items.map(([index, title, copy]) => <li key={index}><span>{index}</span><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol>;
}
