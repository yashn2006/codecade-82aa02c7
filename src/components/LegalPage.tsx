import type { ReactElement, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/**
 * Minimal, dependency-free markdown renderer for our legal pages.
 * Supports: # / ## / ### headings, paragraphs, blank lines, unordered
 * lists (- ...), ordered lists (1. ...), simple GFM tables, **bold**,
 * _italics_, and horizontal rules (---).
 */
function renderMarkdown(src: string): JSX.Element[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: JSX.Element[] = [];
  let i = 0;
  let key = 0;
  const inline = (s: string) => {
    // escape then apply bold/italic
    const parts: (string | JSX.Element)[] = [];
    let rest = s;
    let idx = 0;
    const re = /\*\*(.+?)\*\*|_(.+?)_/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest))) {
      if (m.index > idx) parts.push(rest.slice(idx, m.index));
      parts.push(
        m[1] ? <strong key={`b${key++}`}>{m[1]}</strong> : <em key={`i${key++}`}>{m[2]}</em>,
      );
      idx = m.index + m[0].length;
    }
    if (idx < rest.length) parts.push(rest.slice(idx));
    return parts;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith("### ")) { out.push(<h3 key={key++} className="mt-6 mb-2 text-lg font-semibold">{inline(line.slice(4))}</h3>); i++; continue; }
    if (line.startsWith("## ")) { out.push(<h2 key={key++} className="mt-8 mb-3 text-xl font-bold">{inline(line.slice(3))}</h2>); i++; continue; }
    if (line.startsWith("# ")) { out.push(<h1 key={key++} className="mb-4 text-3xl font-extrabold text-gradient-hot">{inline(line.slice(2))}</h1>); i++; continue; }
    if (/^---+$/.test(line.trim())) { out.push(<hr key={key++} className="my-6 border-border/60" />); i++; continue; }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) { items.push(lines[i].slice(2)); i++; }
      out.push(<ul key={key++} className="my-3 list-disc space-y-1 pl-6">{items.map((t, n) => <li key={n}>{inline(t)}</li>)}</ul>);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, "")); i++; }
      out.push(<ol key={key++} className="my-3 list-decimal space-y-1 pl-6">{items.map((t, n) => <li key={n}>{inline(t)}</li>)}</ol>);
      continue;
    }
    if (line.startsWith("| ")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("| ")) { rows.push(lines[i]); i++; }
      const parse = (r: string) => r.slice(1, -1).split("|").map(c => c.trim());
      const header = parse(rows[0]);
      const body = rows.slice(2).map(parse);
      out.push(
        <div key={key++} className="my-4 overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40"><tr>{header.map((h, n) => <th key={n} className="px-3 py-2 text-left font-semibold">{inline(h)}</th>)}</tr></thead>
            <tbody>{body.map((r, n) => <tr key={n} className="border-t border-border/40">{r.map((c, m) => <td key={m} className="px-3 py-2">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    // paragraph: collect consecutive non-empty non-special lines
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#|-|\d+\.\s|\||---)/.test(lines[i])) { para.push(lines[i]); i++; }
    out.push(<p key={key++} className="my-3 leading-relaxed text-muted-foreground">{inline(para.join(" "))}</p>);
  }
  return out;
}

export function LegalPage({ title, markdown }: { title: string; markdown: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <article className="rounded-2xl border border-border/60 bg-card/40 p-6 shadow-pop backdrop-blur-xl sm:p-8">
          <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.28em] text-primary">Legal</div>
          <h1 className="sr-only">{title}</h1>
          {renderMarkdown(markdown)}
        </article>
      </div>
    </div>
  );
}
