import React from "react";
import { numberifyCitations } from "./numberifyCitations";

const renderBold = (text) => {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: "#e2e8f0", fontWeight: 600 }}>{p}</strong>
      : p
  );
};

// Rendert een tekststuk met klikbare citaat-nummers en gewone links
export const renderSegment = (text, key) => {
  // ([n](url))  →  blauw nummer-badge
  // [text](url) →  gewone link
  // bare url    →  gewone link
  const re = /\(\[([^\]]+)\]\((https?:\/\/[^)]+?)\)\)|\[([^\]]+)\]\((https?:\/\/[^)]+?)\)|(https?:\/\/[^\s<>")\]]+)/g;
  const parts = [];
  let last = 0, m;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last)
      parts.push(<span key={`t${last}`}>{renderBold(text.slice(last, m.index))}</span>);

    if (m[1] && m[2]) {
      // ([n](url)) — citaatnummer badge
      const isNum = /^\d+$/.test(m[1].trim());
      parts.push(
        <a key={`c${m.index}`} href={m[2]} target="_blank" rel="noopener noreferrer"
          style={{
            display: "inline-block", marginLeft: isNum ? 1 : 3,
            padding: isNum ? "0px 4px" : "1px 6px",
            background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.35)",
            borderRadius: isNum ? 3 : 4,
            color: "#60a5fa", fontSize: isNum ? "0.72em" : "0.78em",
            fontWeight: 600, textDecoration: "none", cursor: "pointer",
            verticalAlign: "super", lineHeight: "1.6",
          }}>
          {isNum ? m[1].trim() : m[1]}
        </a>
      );
    } else if (m[3] && m[4]) {
      // [text](url) — gewone link
      parts.push(
        <a key={`a${m.index}`} href={m[4]} target="_blank" rel="noopener noreferrer"
          style={{ color: "#60a5fa", textDecoration: "underline", cursor: "pointer", fontWeight: 500 }}>
          {m[3]}
        </a>
      );
    } else if (m[5]) {
      const url = m[5].replace(/[.,;:!?]+$/, "");
      parts.push(
        <a key={`u${m.index}`} href={url} target="_blank" rel="noopener noreferrer"
          style={{ color: "#60a5fa", textDecoration: "underline", cursor: "pointer", fontSize: "0.9em", wordBreak: "break-all" }}>
          {url.length > 55 ? url.slice(0, 52) + "\u2026" : url}
        </a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length)
    parts.push(<span key={`t${last}`}>{renderBold(text.slice(last))}</span>);

  return <span key={key}>{parts.length ? parts : renderBold(text)}</span>;
};

export const renderReport = (rawText) => {
  const { text } = numberifyCitations(rawText);
  const lines    = text.split("\n");
  const elements = [];
  let inSources  = false;
  let srcCounter = 0; // verwachte nummervolgorde in bronnenlijst

  lines.forEach((line, i) => {
    if (line.startsWith("## ")) {
      inSources  = /bron|referentie|literature|source/i.test(line);
      srcCounter = 0;
      elements.push(
        <h3 key={i} style={{
          fontSize: 13, fontWeight: 700, color: "#f59e0b", margin: "22px 0 8px",
          textTransform: "uppercase", letterSpacing: 1,
          borderBottom: "1px solid rgba(245,158,11,0.2)", paddingBottom: 6,
        }}>
          {line.slice(3)}
        </h3>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} style={{ height: 6 }} />);
    } else if (inSources) {
      // Detecteer "[n] " prefix
      const numMatch = line.match(/^\[(\d+)\]\s+/);
      const nr       = numMatch ? parseInt(numMatch[1]) : null;
      const rest     = numMatch ? line.slice(numMatch[0].length) : line.trim();
      const hasLink  = /https?:\/\//.test(rest);

      elements.push(
        <div key={i} style={{
          display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8,
          padding: "8px 12px",
          background: hasLink ? "rgba(96,165,250,0.07)" : "rgba(255,255,255,0.025)",
          borderRadius: 7,
          borderLeft: hasLink ? "2px solid rgba(96,165,250,0.4)" : "2px solid rgba(255,255,255,0.06)",
        }}>
          {/* Nummer badge */}
          {nr != null && (
            <span style={{
              flexShrink: 0, minWidth: 22, height: 18, borderRadius: 3,
              background: "rgba(96,165,250,0.18)", border: "1px solid rgba(96,165,250,0.35)",
              color: "#60a5fa", fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginTop: 1,
            }}>
              {nr}
            </span>
          )}
          {nr == null && (
            <span style={{ color: hasLink ? "#60a5fa" : "#475569", flexShrink: 0, marginTop: 1, fontSize: 13 }}>
              {hasLink ? "\ud83d\udd17" : "\ud83d\udcc4"}
            </span>
          )}
          <span style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.65 }}>
            {renderSegment(rest, i)}
          </span>
        </div>
      );
    } else {
      elements.push(
        <p key={i} style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.85, margin: "3px 0" }}>
          {renderSegment(line, i)}
        </p>
      );
    }
  });

  return elements;
};
