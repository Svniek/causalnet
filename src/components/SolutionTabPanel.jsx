import { useState, useRef, useEffect } from "react";
import { SOLUTION_TYPES, uid } from "../constants";
import { renderReport } from "../utils/renderReport";
import useForceLayout from "../hooks/useForceLayout";

const SOL_W = 800;
const SOL_H = 500;

function SolutionGraph({ nodes, edges, influence }) {
  const containerRef = useRef(null);
  const [W, setW] = useState(SOL_W);
  const [H, setH] = useState(SOL_H);
  const { positions, onDragNode } = useForceLayout(nodes, edges, influence, W, H);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const didDragRef = useRef(false);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setW(containerRef.current.clientWidth || SOL_W);
        setH(containerRef.current.clientHeight || SOL_H);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const toSvgCoords = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (W / rect.width),
      y: (clientY - rect.top) * (H / rect.height),
    };
  };

  const handleMouseDown = (e, nodeId) => {
    e.stopPropagation();
    const coords = toSvgCoords(e.clientX, e.clientY);
    const pos = positions[nodeId];
    if (!pos) return;
    didDragRef.current = false;
    dragRef.current = { nodeId, startX: coords.x, startY: coords.y, origX: pos.x, origY: pos.y };
  };

  const handleMouseMove = (e) => {
    if (!dragRef.current) return;
    const { nodeId, startX, startY, origX, origY } = dragRef.current;
    const coords = toSvgCoords(e.clientX, e.clientY);
    const dx = coords.x - startX, dy = coords.y - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
    onDragNode(nodeId,
      Math.max(20, Math.min(W - 20, origX + dx)),
      Math.max(20, Math.min(H - 20, origY + dy))
    );
  };

  const handleMouseUp = () => { dragRef.current = null; };

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg
        ref={svgRef}
        width={W} height={H}
        style={{ display: "block", width: "100%", height: "100%" }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <filter id="sol-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="cb" />
            <feMerge><feMergeNode in="cb" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {edges.map(e => {
          const fp = positions[e.from], tp = positions[e.to];
          if (!fp || !tp) return null;
          const fromNode = nodes.find(n => n.id === e.from);
          const col = SOLUTION_TYPES[fromNode?.type]?.color || "#64748b";
          const corr = e.correlation ?? 0.3;
          const dx = tp.x - fp.x, dy = tp.y - fp.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          const cx = (fp.x + tp.x) / 2 - (dy / d) * 20;
          const cy = (fp.y + tp.y) / 2 + (dx / d) * 20;
          return (
            <path
              key={e.id}
              d={`M${fp.x},${fp.y} Q${cx},${cy} ${tp.x},${tp.y}`}
              fill="none"
              stroke={col}
              strokeWidth={1 + corr * 3}
              strokeOpacity={0.45}
              strokeDasharray="5 4"
              strokeLinecap="round"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(n => {
          const p = positions[n.id];
          if (!p) return null;
          const t = SOLUTION_TYPES[n.type] || { color: "#64748b", label: n.type };
          const inf = influence?.[n.label] ?? 0.5;
          const r = 8 + inf * 20;

          const words = n.label.split(" ");
          const lines = [];
          let cur = "";
          words.forEach(w => {
            if ((cur + " " + w).trim().length <= 14) {
              cur = (cur + " " + w).trim();
            } else {
              if (cur) lines.push(cur);
              cur = w;
            }
          });
          if (cur) lines.push(cur);

          return (
            <g
              key={n.id}
              onMouseDown={e => handleMouseDown(e, n.id)}
              onMouseEnter={ev => setTooltip({ x: ev.clientX, y: ev.clientY, text: `${n.label} · ${t.label} · ${(inf * 100).toFixed(0)}%` })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: "grab" }}
            >
              <circle cx={p.x} cy={p.y} r={r + 12} fill={t.color} opacity={0.08} />
              <circle
                cx={p.x} cy={p.y} r={r}
                fill={t.color} fillOpacity={0.9}
                stroke="rgba(255,255,255,0.25)" strokeWidth={1.5}
                filter="url(#sol-glow)"
              />
              <text
                textAnchor="middle"
                fontFamily="sans-serif"
                fontSize={9}
                fill="#e2e8f0"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {lines.map((l, li) => (
                  <tspan key={li} x={p.x} y={p.y + r + 12 + li * 11}>{l}</tspan>
                ))}
                <tspan x={p.x} y={p.y + r + 12 + lines.length * 11} fontSize={8} fill={t.color} opacity={0.9} fontWeight="600">
                  {(inf * 100).toFixed(0)}%
                </tspan>
              </text>
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div style={{
          position: "fixed", left: tooltip.x + 12, top: tooltip.y - 8,
          background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 6, padding: "4px 9px", fontSize: 11, color: "#e2e8f0",
          pointerEvents: "none", zIndex: 999, whiteSpace: "nowrap"
        }}>
          {tooltip.text}
        </div>
      )}

      {/* Solution type legend */}
      <div style={{
        position: "absolute", bottom: 10, left: 10,
        background: "rgba(8,13,26,0.88)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8, padding: "10px 14px", fontSize: 10, color: "#475569", userSelect: "none"
      }}>
        <div style={{ marginBottom: 7, color: "#64748b", fontWeight: 600, letterSpacing: 0.5, fontSize: 9, textTransform: "uppercase" }}>Legenda</div>
        {Object.entries(SOLUTION_TYPES).map(([key, { label, color }]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SolutionTabPanel({ sub, problem, apiKey, onMergeToggle, onVisibleToggle, onClose }) {
  const [innerTab, setInnerTab] = useState("network");

  if (!sub) return null;

  const typeColors = {
    maingoal: "#f59e0b", goal: "#34d399", risk: "#f87171",
    protective: "#60a5fa", amplifying: "#a78bfa",
    interventie: "#10b981", beleid: "#8b5cf6", omgeving: "#f97316", gedrag: "#06b6d4",
  };
  const factorColor = typeColors[sub.factorType] || "#64748b";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#080d1a" }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        background: "rgba(245,158,11,0.04)",
        borderBottom: "1px solid rgba(245,158,11,0.12)",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap"
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{
              fontSize: 10, padding: "2px 7px", borderRadius: 12,
              background: factorColor + "22", color: factorColor, border: `1px solid ${factorColor}44`,
              fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0
            }}>
              {sub.factorType}
            </span>
            <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>
              🔍 Oplossingen voor: {sub.factorLabel}
            </span>
          </div>
          {sub.analysed && (
            <div style={{ fontSize: 10, color: "#475569" }}>
              {sub.nodes.length} oplossingen · {sub.edges.length} correlaties
            </div>
          )}
        </div>

        {/* Merge / visible controls */}
        {sub.analysed && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <button
              onClick={onMergeToggle}
              style={{
                padding: "6px 12px", fontSize: 11, borderRadius: 8, cursor: "pointer", fontWeight: 600,
                background: sub.merged ? "rgba(52,211,153,0.15)" : "rgba(245,158,11,0.12)",
                border: `1px solid ${sub.merged ? "rgba(52,211,153,0.4)" : "rgba(245,158,11,0.3)"}`,
                color: sub.merged ? "#34d399" : "#f59e0b",
              }}
            >
              📌 {sub.merged ? "Verwijder uit hoofdnetwerk" : "Voeg toe aan hoofdnetwerk"}
            </button>
            {sub.merged && (
              <button
                onClick={onVisibleToggle}
                style={{
                  padding: "6px 12px", fontSize: 11, borderRadius: 8, cursor: "pointer", fontWeight: 600,
                  background: sub.subVisible ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${sub.subVisible ? "rgba(96,165,250,0.35)" : "rgba(255,255,255,0.1)"}`,
                  color: sub.subVisible ? "#60a5fa" : "#475569",
                }}
              >
                👁 {sub.subVisible ? "Zichtbaar" : "Verborgen"}
              </button>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            padding: "4px 8px", background: "none", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6, color: "#475569", fontSize: 14, cursor: "pointer", flexShrink: 0
          }}
        >
          ×
        </button>
      </div>

      {/* Inner tabs */}
      {sub.analysed && (
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "0 16px" }}>
          {[["network", "🕸 Netwerk"], ["analysis", "📋 Analyse"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setInnerTab(key)}
              style={{
                padding: "10px 16px", background: "none", border: "none",
                borderBottom: `2px solid ${innerTab === key ? "#f59e0b" : "transparent"}`,
                color: innerTab === key ? "#f59e0b" : "#334155",
                fontSize: 12, cursor: "pointer", marginBottom: -1
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Loading state */}
        {!sub.analysed && sub.steps.length > 0 && (
          <div style={{ padding: 24 }}>
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: 16, marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Oplossingen analyseren voor "{sub.factorLabel}"…
              </div>
              {sub.steps.map((st, i) => (
                <div key={st.id || i} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: st.done ? "#34d399" : "#f59e0b", boxShadow: st.done ? "0 0 7px #34d399" : "0 0 7px #f59e0b" }} />
                  <span style={{ fontSize: 12, color: st.done ? "#334155" : "#e2e8f0" }}>{st.txt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {sub.error && (
          <div style={{ padding: 24 }}>
            <div style={{ padding: 14, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, color: "#f87171", fontSize: 13 }}>
              ⚠️ Fout: {sub.error}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!sub.analysed && !sub.error && sub.steps.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{ fontSize: 44 }}>🔍</div>
            <p style={{ color: "#334155", fontSize: 13, marginTop: 10 }}>Oplossingen worden geladen…</p>
          </div>
        )}

        {/* Network tab */}
        {sub.analysed && innerTab === "network" && sub.nodes.length > 0 && (
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center,#0d1630,#080d1a)" }}>
            <SolutionGraph nodes={sub.nodes} edges={sub.edges} influence={sub.influence} />
          </div>
        )}

        {sub.analysed && innerTab === "network" && sub.nodes.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{ fontSize: 36 }}>🕸</div>
            <p style={{ color: "#334155", fontSize: 13, marginTop: 10 }}>Geen netwerk beschikbaar.</p>
          </div>
        )}

        {/* Analysis tab */}
        {sub.analysed && innerTab === "analysis" && (
          <div style={{ position: "absolute", inset: 0, overflow: "auto", padding: 24 }}>
            {sub.report ? (
              renderReport(sub.report)
            ) : (
              <div style={{ color: "#334155", fontSize: 13 }}>Geen analyse beschikbaar.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
